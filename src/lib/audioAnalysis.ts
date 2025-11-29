import Essentia from 'essentia.js/dist/essentia.js-core.es.js';
import EssentiaWASM from 'essentia.js/dist/essentia-wasm.web.js';
import { chordDefinitions } from '@/lib/chords';

type EssentiaVectorFloat = { delete(): void };
type EssentiaVectorVectorFloat = { push_back(value: EssentiaVectorFloat): void; delete(): void };
type EssentiaModuleWithVectors = { VectorVectorFloat: new () => EssentiaVectorVectorFloat };
type EssentiaWASMModule = {
  ready?: Promise<EssentiaWASMModule>;
  [key: string]: unknown;
};
type EssentiaWASMFactoryType =
  | ((config?: Record<string, unknown>) => Promise<EssentiaWASMModule> | EssentiaWASMModule)
  | EssentiaWASMModule;
export interface AudioAnalysisResult {
  chords: string[];
  confidence: number;
  timestamp: number;
}

export interface ChordDetectionEvent {
  chord: string;
  confidence: number;
  timestamp: number;
  rawChord?: string;
}

interface HPCPMatrixBundle {
  matrix: EssentiaVectorVectorFloat;
  vectors: EssentiaVectorFloat[];
}

const ROOT_NAME_CANDIDATES: string[][] = [
  ['A'],
  ['A#', 'Bb'],
  ['B', 'Cb'],
  ['C', 'B#'],
  ['C#', 'Db'],
  ['D'],
  ['D#', 'Eb'],
  ['E', 'Fb'],
  ['F', 'E#'],
  ['F#', 'Gb'],
  ['G'],
  ['G#', 'Ab'],
];
const NOTE_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

const DOMINANT_SEVENTH_INTERVAL = 10; // b7 relative to root

export class AudioAnalyzer {
  private isInitialized = false;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isRecording = false;
  private onChordDetected?: (event: ChordDetectionEvent) => void;
  private analysisInterval?: number;

  // Essentia instances
  private essentia: Essentia | null = null;

  // HPCP frame buffer for chord detection
  private hpcpBuffer: Float32Array[] = [];
  private readonly HPCP_BUFFER_SIZE = 5; // ~750ms of audio (5 * 150ms)
  private readonly ANALYSIS_INTERVAL_MS = 150;
  private readonly INITIAL_DETECTIONS_REQUIRED = 1;
  private readonly STABLE_DETECTIONS_REQUIRED = 2;
  private readonly HPCP_CHANGE_THRESHOLD = 0.15;
  private readonly SEGMENT_TIMEOUT_MS = 1200;

  // State for debouncing
  private lastEmittedChord: string | null = null;
  private candidateChord: string | null = null;
  private consecutiveDetections = 0;
  private spectralPeaksWarningCount = 0;
  private readonly MAX_SPECTRAL_PEAK_WARNINGS = 5;
  private lastSegmentHPCP: Float32Array | null = null;
  private lastSegmentTimestamp = 0;

  constructor() {
    this.initializeEssentia();
  }

  private getEssentiaVectorModule(): EssentiaModuleWithVectors | null {
    if (!this.essentia) return null;
    const module = (this.essentia as Essentia & { module?: EssentiaModuleWithVectors }).module;
    return module?.VectorVectorFloat ? module : null;
  }

  private async initializeEssentia() {
    if (typeof window === 'undefined') return;

    try {
      // Configure EssentiaWASM to find the .wasm file in the public directory
      const wasmConfig = {
        locateFile: (path: string, prefix: string) => {
          if (path.endsWith('.wasm')) {
            return '/wasm/essentia-wasm.web.wasm';
          }
          return prefix + path;
        }
      };

      // EssentiaWASM is a factory function that returns a promise
      // We need to call it and wait for the module to be ready
      const EssentiaWASMFactory = EssentiaWASM as EssentiaWASMFactoryType;

      let wasmModule: EssentiaWASMModule;
      if (typeof EssentiaWASMFactory === 'function') {
        // Call the factory function with config
        const modulePromise = EssentiaWASMFactory(wasmConfig);

        // The factory returns an object with a 'ready' promise
        if (modulePromise && modulePromise.ready) {
          wasmModule = await modulePromise.ready;
        } else {
          // Fallback: the promise itself might be the module
          wasmModule = await modulePromise;
        }
      } else {
        // Fallback for other build types
        wasmModule = EssentiaWASMFactory;
      }

      // Now wasmModule should have the EssentiaJS property
      this.essentia = new Essentia(wasmModule);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Essentia.js:', error);
    }
  }

  async requestMicrophoneAccess(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });
      this.mediaStream = stream;
      return stream;
    } catch (error) {
      console.error('Failed to access microphone:', error);
      throw new Error('Microphone access denied or not available');
    }
  }

  async startRecording(onChordDetected: (event: ChordDetectionEvent) => void): Promise<void> {
    if (!this.isInitialized || !this.essentia) {
      // Try initializing again if it failed or hasn't finished
      await this.initializeEssentia();
      if (!this.isInitialized) {
        throw new Error('Audio analyzer (Essentia) not initialized');
      }
    }

    if (this.isRecording) return;

    try {
      const stream = await this.requestMicrophoneAccess();
      this.audioContext = new AudioContext({ sampleRate: 44100 });
      const source = this.audioContext.createMediaStreamSource(stream);

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 4096; // Larger FFT for better resolution
      this.analyserNode.smoothingTimeConstant = 0.0; // We want raw data for Essentia

      source.connect(this.analyserNode);

      this.onChordDetected = onChordDetected;
      this.isRecording = true;

      this.startAnalysisLoop();
      console.log('Recording started with Essentia analysis');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  private startAnalysisLoop() {
    if (!this.analyserNode || !this.essentia) return;

    const bufferSize = this.analyserNode.fftSize;
    const timeData = new Float32Array(bufferSize);

    const analyze = () => {
      if (!this.isRecording || !this.analyserNode || !this.essentia) return;

      // Get time domain data (waveform)
      this.analyserNode.getFloatTimeDomainData(timeData);

      let timeDataVector: EssentiaVectorFloat | null = null;
      let spectrumVector: EssentiaVectorFloat | null = null;
      let frequenciesVector: EssentiaVectorFloat | null = null;
      let magnitudesVector: EssentiaVectorFloat | null = null;
      let hpcpVector: EssentiaVectorFloat | null = null;

      try {
        let skipFrame = false;
        // Convert Float32Array to Essentia's VectorFloat format
        timeDataVector = this.essentia.arrayToVector(timeData);

        // 1. Compute Spectrum
        const spectrumOut = this.essentia.Spectrum(timeDataVector);
        spectrumVector = spectrumOut.spectrum;

        // 2. Compute Spectral Peaks
        const peaksOut = this.essentia.SpectralPeaks(
          spectrumVector,
          0.001, // magnitudeThreshold to reduce noise
          3500, // maxFrequency
          120, // maxPeaks
          20, // minFrequency
          'frequency',
          this.audioContext?.sampleRate ?? 44100
        );
        frequenciesVector = peaksOut.frequencies;
        magnitudesVector = peaksOut.magnitudes;

        let freqArray: Float32Array | null = null;
        let magArray: Float32Array | null = null;
        try {
          freqArray = this.essentia.vectorToArray(frequenciesVector);
          magArray = this.essentia.vectorToArray(magnitudesVector);
        } catch (conversionError) {
          this.logSpectralPeaksWarning('SpectralPeaks conversion failed; skipping frame', conversionError);
          skipFrame = true;
        }

        if (!skipFrame && freqArray && magArray) {
          if (freqArray.length > 0 && this.hpcpBuffer.length === 0) {
            console.debug('SpectralPeaks warmup complete', { peaks: freqArray.length });
          }
          if (freqArray.length === 0 || magArray.length === 0) {
            this.logSpectralPeaksWarning('SpectralPeaks returned empty data; skipping frame');
            skipFrame = true;
          } else {
            this.spectralPeaksWarningCount = 0;
          }
        }

        if (!skipFrame) {
          // 3. Compute HPCP (Harmonic Pitch Class Profile)
          const hpcpOut = this.computeHPCP(frequenciesVector, magnitudesVector);
          if (!hpcpOut) {
            skipFrame = true;
          } else {
            hpcpVector = hpcpOut.hpcp;
            const hpcpArray = this.essentia.vectorToArray(hpcpVector);

            // Add HPCP to buffer
            this.hpcpBuffer.push(new Float32Array(hpcpArray));
            if (this.hpcpBuffer.length > this.HPCP_BUFFER_SIZE) {
              this.hpcpBuffer.shift(); // Remove oldest frame
            }
            console.log('HPCP buffer length', this.hpcpBuffer.length);

            // Only detect chords once we have enough frames
            if (this.hpcpBuffer.length >= this.HPCP_BUFFER_SIZE) {
              const averagedHPCP = this.averageHPCPBuffer();
              if (!averagedHPCP) {
                console.debug('Unable to average HPCP buffer; skipping chord detection');
              } else if (this.hasSignificantHPCPChange(averagedHPCP)) {
                const hpcpMatrixData = this.buildHPCPMatrix();
                if (!hpcpMatrixData) {
                  console.debug('Failed to construct HPCP matrix; skipping chord detection');
                } else {
                  const timing = this.getChordDetectionTiming();
                  const chordResult = this.runChordsDetection(hpcpMatrixData, timing);
                  if (chordResult.chords.length > 0) {
                    const rawEssentiaChord = chordResult.chords[chordResult.chords.length - 1];
                    const normalizedChord = this.normalizeEssentiaChord(rawEssentiaChord);
                    if (!normalizedChord) {
                      console.debug('Essentia returned unsupported chord label:', rawEssentiaChord);
                    } else {
                      const rms = this.calculateRMS(timeData);
                      if (rms <= 0.008) {
                        this.resetDetection();
                      } else {
                        const refinedChord = this.refineChordQuality(normalizedChord, averagedHPCP);
                        if (refinedChord !== normalizedChord) {
                          console.debug(`Refined chord: ${normalizedChord} -> ${refinedChord}`);
                        }

                        const rootName = this.extractRoot(refinedChord);
                        const rootIndex = this.getNoteIndex(rootName);
                        const strength = chordResult.strengths[0] ?? 0.5;
                        this.handleDetectedChord(
                          refinedChord,
                          strength,
                          rawEssentiaChord,
                          Array.from(averagedHPCP),
                          rootIndex >= 0 ? rootIndex : undefined
                        );
                      }
                    }
                  } else {
                    console.debug('Essentia did not return any chords for current buffer');
                  }
                }
              }
            }
          }
        }

      } catch (error) {
        console.error('Essentia analysis error:', error);
      } finally {
        if (timeDataVector) timeDataVector.delete();
        if (spectrumVector) spectrumVector.delete();
        if (frequenciesVector) frequenciesVector.delete();
        if (magnitudesVector) magnitudesVector.delete();
        if (hpcpVector) hpcpVector.delete();
      }

      if (this.isRecording) {
        // Essentia is fast, but let's not overload. 100ms - 200ms is good for chord updates.
        this.analysisInterval = window.setTimeout(analyze, this.ANALYSIS_INTERVAL_MS);
      }
    };

    analyze();
  }

  private logSpectralPeaksWarning(message: string, error?: unknown) {
    if (this.spectralPeaksWarningCount >= this.MAX_SPECTRAL_PEAK_WARNINGS) {
      return;
    }

    this.spectralPeaksWarningCount++;
    const prefix = `${message} (warning ${this.spectralPeaksWarningCount}/${this.MAX_SPECTRAL_PEAK_WARNINGS})`;
    if (error) {
      console.warn(prefix, error);
    } else {
      console.warn(prefix);
    }

    if (this.spectralPeaksWarningCount === this.MAX_SPECTRAL_PEAK_WARNINGS) {
      console.warn('Additional SpectralPeaks warnings suppressed until frames stabilize.');
    }
  }

  private calculateRMS(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  private computeHPCP(frequencies: EssentiaVectorFloat, magnitudes: EssentiaVectorFloat) {
    if (!this.essentia) return null;
    const sampleRate = this.audioContext?.sampleRate ?? 44100;
    try {
      return this.essentia.HPCP(
        frequencies,
        magnitudes,
        true, // bandPreset
        500, // bandSplitFrequency
        0, // harmonics
        5000, // maxFrequency
        false, // maxShifted
        40, // minFrequency
        false, // nonLinear
        'unitSum', // normalized for chord detection
        440, // referenceFrequency
        sampleRate,
        12, // size
        'squaredCosine',
        1
      );
    } catch (error) {
      console.warn('HPCP computation skipped due to error:', error);
      return null;
    }
  }

  private averageHPCPBuffer(): Float32Array | null {
    if (!this.hpcpBuffer.length) {
      return null;
    }

    const aggregate = new Float32Array(12);
    const totalFrames = this.hpcpBuffer.length;
    const weightDecay = 0.55;
    let weightTotal = 0;

    for (let index = 0; index < totalFrames; index++) {
      const frame = this.hpcpBuffer[index];
      const weight = Math.pow(weightDecay, totalFrames - index - 1);
      weightTotal += weight;
      for (let i = 0; i < aggregate.length && i < frame.length; i++) {
        aggregate[i] += frame[i] * weight;
      }
    }

    const maxEnergy = Math.max(...aggregate);
    if (maxEnergy <= 0) {
      return null;
    }

    for (let i = 0; i < aggregate.length; i++) {
      aggregate[i] /= maxEnergy;
    }
    return aggregate;
  }

  private hasSignificantHPCPChange(current: Float32Array): boolean {
    const now = Date.now();
    if (!this.lastSegmentHPCP) {
      this.lastSegmentHPCP = current;
      this.lastSegmentTimestamp = now;
      return true;
    }

    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < current.length; i++) {
      const a = current[i];
      const b = this.lastSegmentHPCP[i];
      dot += a * b;
      magA += a * a;
      magB += b * b;
    }
    const similarity = dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-6);
    const changed = similarity < 1 - this.HPCP_CHANGE_THRESHOLD;
    const timeoutElapsed = now - this.lastSegmentTimestamp > this.SEGMENT_TIMEOUT_MS;

    if (changed || timeoutElapsed) {
      this.lastSegmentHPCP = current;
      this.lastSegmentTimestamp = now;
      return true;
    }

    return false;
  }

  private buildHPCPMatrix(): HPCPMatrixBundle | null {
    if (!this.essentia) return null;
    const module = this.getEssentiaVectorModule();
    if (!module?.VectorVectorFloat) {
      console.warn('Essentia VectorVectorFloat constructor not available');
      return null;
    }

    const matrix = new module.VectorVectorFloat();
    const vectors: EssentiaVectorFloat[] = [];
    try {
      for (const frame of this.hpcpBuffer) {
        const vector = this.essentia.arrayToVector(frame);
        matrix.push_back(vector);
        vectors.push(vector);
      }
      return { matrix, vectors };
    } catch (error) {
      vectors.forEach(vec => vec.delete());
      matrix.delete();
      console.error('Failed to build HPCP matrix:', error);
      return null;
    }
  }

  private convertVectorString(vector: { size: () => number; get: (index: number) => string }): string[] {
    const result: string[] = [];
    const length = typeof vector.size === 'function' ? vector.size() : 0;
    for (let i = 0; i < length; i++) {
      result.push(vector.get(i));
    }
    return result;
  }

  private getChordDetectionTiming() {
    const sampleRate = this.audioContext?.sampleRate ?? 44100;
    const hopSize = Math.max(1024, Math.floor(sampleRate * (this.ANALYSIS_INTERVAL_MS / 1000)));
    const windowSize = (this.HPCP_BUFFER_SIZE * this.ANALYSIS_INTERVAL_MS) / 1000;
    return { hopSize, sampleRate, windowSize };
  }

  private runChordsDetection(hpcpMatrixData: HPCPMatrixBundle, timing: { hopSize: number; sampleRate: number; windowSize: number }) {
    if (!this.essentia) {
      throw new Error('Essentia module not initialized');
    }

    const { matrix, vectors } = hpcpMatrixData;
    try {
      const result = this.essentia.ChordsDetection(matrix, timing.hopSize, timing.sampleRate, timing.windowSize);
      const chordsVector = result.chords;
      const strengthsVector = result.strength;

      const chords = this.convertVectorString(chordsVector);
      const strengthsArray = this.essentia.vectorToArray(strengthsVector);
      const strengths = Array.from(strengthsArray);

      chordsVector.delete?.();
      strengthsVector.delete?.();

      return { chords, strengths };
    } finally {
      matrix.delete();
      vectors.forEach(vector => vector.delete());
    }
  }

  private normalizeEssentiaChord(rawChord: string): string | null {
    if (!rawChord || rawChord === 'N') {
      return null;
    }

    const isMinor = rawChord.endsWith('m');
    const root = isMinor ? rawChord.slice(0, -1) : rawChord;
    const normalizedRoot = this.normalizeNoteName(root);
    if (!normalizedRoot) {
      return null;
    }

    const chord = `${normalizedRoot}${isMinor ? 'm' : ''}`;
    if (!chordDefinitions[chord]) {
      console.debug('Essentia returned unsupported chord:', rawChord);
      return null;
    }
    return chord;
  }

  private normalizeNoteName(root: string): string | null {
    const match = root.match(/^([A-G])([#b]?)/);
    if (!match) return null;
    const [, base, accidental] = match;
    return accidental === 'b' ? this.flattenNote(`${base}${accidental}`) : `${base}${accidental || ''}`;
  }

  private flattenNote(note: string): string {
    switch (note) {
      case 'Cb':
        return 'B';
      case 'Db':
        return 'C#';
      case 'Eb':
        return 'D#';
      case 'Fb':
        return 'E';
      case 'Gb':
        return 'F#';
      case 'Ab':
        return 'G#';
      case 'Bb':
        return 'A#';
      default:
        return note.replace('b', '');
    }
  }

  private refineChordQuality(baseChord: string, hpcp: Float32Array): string {
    let root = this.extractRoot(baseChord);
    let rootIndex = this.getNoteIndex(root);
    if (!root || rootIndex === -1) {
      return baseChord;
    }

    let baseQuality = baseChord.slice(root.length); // '' or 'm'
    let isMinor = baseQuality === 'm';

    // Helper to calculate energy for a chord (Triad + optional b7)
    const getChordScore = (rIndex: number, minor: boolean) => {
      const thirdIndex = (rIndex + (minor ? 3 : 4)) % 12;
      const fifthIndex = (rIndex + 7) % 12;
      const b7Index = (rIndex + 10) % 12;

      const rootVal = hpcp[rIndex] || 0;
      const thirdVal = hpcp[thirdIndex] || 0;
      const fifthVal = hpcp[fifthIndex] || 0;
      const b7Val = hpcp[b7Index] || 0;

      // Base triad energy
      let score = rootVal + thirdVal + fifthVal;

      // Add b7 energy if it contributes significantly (potential 7th chord)
      // We weight it slightly less to avoid false positives from noise
      if (b7Val > 0.1) {
        score += b7Val * 0.8;
      }

      return score;
    };

    // 1. Root/Quality Validation & Correction
    let bestScore = getChordScore(rootIndex, isMinor);
    let bestRootIndex = rootIndex;
    let bestIsMinor = isMinor;

    // Candidates to check:
    // 1. Current root, opposite quality
    const oppositeQualityScore = getChordScore(rootIndex, !isMinor);
    if (oppositeQualityScore > bestScore * 1.1) {
      bestScore = oppositeQualityScore;
      bestIsMinor = !isMinor;
    }

    // 2. Perfect 4th (IV)
    const ivIndex = (rootIndex + 5) % 12;
    const ivMajorScore = getChordScore(ivIndex, false);
    const ivMinorScore = getChordScore(ivIndex, true);

    // Lowered to 1.05 to be very responsive
    const ROOT_SWITCH_THRESHOLD = 1.05;

    if (ivMajorScore > bestScore * ROOT_SWITCH_THRESHOLD) {
      bestScore = ivMajorScore;
      bestRootIndex = ivIndex;
      bestIsMinor = false;
    }
    if (ivMinorScore > bestScore * ROOT_SWITCH_THRESHOLD) {
      bestScore = ivMinorScore;
      bestRootIndex = ivIndex;
      bestIsMinor = true;
    }

    // 3. Perfect 5th (V)
    const vIndex = (rootIndex + 7) % 12;
    const vMajorScore = getChordScore(vIndex, false);
    const vMinorScore = getChordScore(vIndex, true);

    if (vMajorScore > bestScore * ROOT_SWITCH_THRESHOLD) {
      bestScore = vMajorScore;
      bestRootIndex = vIndex;
      bestIsMinor = false;
    }
    if (vMinorScore > bestScore * ROOT_SWITCH_THRESHOLD) {
      bestScore = vMinorScore;
      bestRootIndex = vIndex;
      bestIsMinor = true;
    }

    // Apply root change if needed
    if (bestRootIndex !== rootIndex || bestIsMinor !== isMinor) {
      const oldChord = `${root}${isMinor ? 'm' : ''}`;
      rootIndex = bestRootIndex;
      root = NOTE_NAMES[rootIndex];
      isMinor = bestIsMinor;
      const newChord = `${root}${isMinor ? 'm' : ''}`;
      console.log(`Refining Root: Switched from ${oldChord} to ${newChord} (Score: ${bestScore.toFixed(3)} vs ${getChordScore(this.getNoteIndex(this.extractRoot(baseChord)), baseChord.includes('m')).toFixed(3)})`);
    }

    // 2. Extension Detection (7th, maj7, add9) on the (possibly new) root
    const flatSeventh = hpcp[(rootIndex + 10) % 12] || 0;
    const majorSeventh = hpcp[(rootIndex + 11) % 12] || 0;
    const ninth = hpcp[(rootIndex + 2) % 12] || 0;
    const rootEnergy = hpcp[rootIndex] || 0;
    const thirdEnergy = hpcp[(rootIndex + (isMinor ? 3 : 4)) % 12] || 0;
    const fifthEnergy = hpcp[(rootIndex + 7) % 12] || 0;

    let suffix = isMinor ? 'm' : '';
    const triadEnergy = rootEnergy + thirdEnergy + fifthEnergy;
    // Use the maximum peak of the triad components for normalization
    // This avoids the "doubled note" penalty (e.g. A7 open chord has two Es)
    const maxTriadEnergy = Math.max(rootEnergy, thirdEnergy, fifthEnergy);

    // Log analysis data for debugging
    console.log(`Chord Analysis for ${root}${isMinor ? 'm' : ''}:`, JSON.stringify({
      root: rootEnergy.toFixed(3),
      third: thirdEnergy.toFixed(3),
      fifth: fifthEnergy.toFixed(3),
      b7: flatSeventh.toFixed(3),
      maj7: majorSeventh.toFixed(3),
      add9: ninth.toFixed(3),
      triadEnergy: triadEnergy.toFixed(3),
      maxTriadEnergy: maxTriadEnergy.toFixed(3)
    }));

    if (!isMinor) {
      // Major chords extensions

      // Dominant 7th (b7) - e.g. A7
      // Base Threshold: 0.05 absolute, 10% of MAX triad peak
      // Lowered from 15% to catch strummed chords
      let b7Threshold = 0.1;

      // Hysteresis: If we previously detected this 7th chord, make it easier to stick (8%)
      if (this.lastEmittedChord === `${root}7`) {
        b7Threshold = 0.08;
      }

      if (flatSeventh > 0.05 && flatSeventh > maxTriadEnergy * b7Threshold) {
        suffix = '7';
      }
      // Major 7th (maj7) - e.g. Cmaj7
      // Higher threshold (0.1 absolute, 25% of MAX peak) to avoid false positives
      else if (majorSeventh > 0.1 && majorSeventh > maxTriadEnergy * 0.25) {
        suffix = 'maj7';
      }
      // Add9 - e.g. Cadd9
      // Higher threshold (0.1 absolute, 25% of MAX peak)
      else if (ninth > 0.1 && ninth > maxTriadEnergy * 0.25) {
        suffix = 'add9';
      }
    }

    const candidate = `${root}${suffix}`;
    // Verify we have a definition for this chord
    if (!chordDefinitions[candidate]) {
      return `${root}${isMinor ? 'm' : ''}`;
    }
    return candidate;
  }

  private extractRoot(chord: string): string {
    const match = chord.match(/^([A-G](?:#|b)?)/);
    return match ? match[1] : chord;
  }

  private getNoteIndex(note: string): number {
    return NOTE_NAMES.indexOf(note);
  }


  private handleDetectedChord(
    chord: string,
    confidence: number,
    rawChord?: string,
    hpcpSnapshot?: number[],
    rootIndex?: number
  ) {
    // Normalize chord names if needed (Essentia might return "A#m" vs "Bbm")
    // For now, pass through.

    console.debug('Essentia detected chord (normalized):', chord, 'raw:', rawChord, 'confidence:', confidence.toFixed(2));

    // Debouncing logic
    if (chord === this.candidateChord) {
      this.consecutiveDetections++;
    } else {
      this.candidateChord = chord;
      this.consecutiveDetections = 1;
    }

    let chordToEmit: string | null = null;

    const requiredStableDetections = this.lastEmittedChord
      ? this.STABLE_DETECTIONS_REQUIRED
      : this.INITIAL_DETECTIONS_REQUIRED;

    // If it's the same as what we're showing, keep showing it (prevents flickering)
    if (this.candidateChord === this.lastEmittedChord) {
      chordToEmit = this.candidateChord;
    }
    // If it's a new chord, require a few stable frames (fewer on the initial detection)
    else if (this.consecutiveDetections >= requiredStableDetections) {
      chordToEmit = this.candidateChord;
    }

    if (chordToEmit && this.onChordDetected) {
      if (hpcpSnapshot) {
        const annotatedBins = hpcpSnapshot
          .map((value, index) => ({ note: NOTE_NAMES[index], index, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        console.debug('Chord detection snapshot', {
          chord: chordToEmit,
          rawChord,
          confidence: confidence.toFixed(2),
          topBins: annotatedBins,
          rootIndex,
        });
      }

      // Only emit when the chord changes
      if (chordToEmit !== this.lastEmittedChord) {
        this.lastEmittedChord = chordToEmit;
        console.log('handleDetectedChord emitting to UI', {
          chord: chordToEmit,
          rawChord,
          confidence: confidence.toFixed(2),
          consecutiveDetections: this.consecutiveDetections,
          rootIndex,
        });
        this.onChordDetected({
          chord: chordToEmit,
          rawChord,
          confidence: confidence,
          timestamp: Date.now()
        });
      }
    }
  }

  private resetDetection() {
    this.candidateChord = null;
    this.consecutiveDetections = 0;
    this.hpcpBuffer = [];
    this.lastSegmentHPCP = null;
  }

  stopRecording(): void {
    this.isRecording = false;
    if (this.analysisInterval) {
      clearTimeout(this.analysisInterval);
      this.analysisInterval = undefined;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyserNode = null;
    this.resetDetection();
    console.log('Recording stopped');
  }

  isRecordingActive(): boolean {
    return this.isRecording;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}
