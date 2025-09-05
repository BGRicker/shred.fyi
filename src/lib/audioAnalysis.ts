/**
 * Real-Time Audio Analysis Library for Guitar Practice Assistant
 * 
 * Implements live chord detection using Web Audio API and Essentia.js.
 * Analyzes microphone input to detect musical chords in real-time.
 */

import { Chord } from 'tonal';

const A4 = 440;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// --- Chord Generation ---
const CHORD_ROOTS = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
const CHORD_QUALITIES = [
  // Basic Triads
  '', 'm',
  // Seventh Chords
  '7', 'maj7', 'm7',
  // Extended & Altered
  'sus2', 'sus4', 'add9', '6', 'm6', '5' // Power Chord
];

const CHORD_MATCH_THRESHOLD = 0.6;
const HARMONIC_RATIO_TOLERANCE = 0.1;

// Generate a comprehensive list of chords to detect.
const CHORD_DEFINITIONS = CHORD_ROOTS.flatMap(root => 
  CHORD_QUALITIES.map(quality => {
    const name = `${root}${quality}`;
    const chord = Chord.get(name);

    // Filter out invalid or unrecognized chords
    if (chord.empty || chord.notes.length < 2) {
      return null;
    }

    return {
      name: chord.symbol,
      logMessage: `🎸 Detected ${chord.symbol}`,
      notes: chord.notes
    };
  })
).filter((c): c is NonNullable<typeof c> => c !== null)
 .sort((a, b) => b.notes.length - a.notes.length); // IMPORTANT: check more specific chords first.

export interface AudioAnalysisResult {
  chords: string[];
  confidence: number;
  timestamp: number;
}

export interface ChordDetectionEvent {
  chord: string;
  confidence: number;
  timestamp: number;
}

export class AudioAnalyzer {
  private isInitialized = false;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isRecording = false;
  private onChordDetected?: (event: ChordDetectionEvent) => void;
  private analysisInterval?: number;
  
  // New state for improved, responsive chord detection logic.
  private lastEmittedChord: string | null = null;
  private candidateChord: string | null = null;
  private consecutiveDetections = 0;

  constructor() {
    this.initializeEssentia();
  }

  private async initializeEssentia() {
    try {
      // Only initialize in browser environment
      if (typeof window === 'undefined') {
        console.log('Skipping audio analyzer initialization on server side');
        return;
      }

      console.log('Initializing custom audio analyzer...');
      
      // Using custom frequency analysis
      console.log('Using custom frequency analysis');
      
      this.isInitialized = true;
      console.log('Custom audio analyzer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio analyzer:', error);
      this.isInitialized = true; // Still allow basic functionality
    }
  }

  async requestMicrophoneAccess(): Promise<MediaStream> {
    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });
      
      // Log microphone details
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        console.log('Microphone settings:', settings);
      }
      
      this.mediaStream = stream;
      return stream;
    } catch (error) {
      console.error('Failed to access microphone:', error);
      throw new Error('Microphone access denied or not available');
    }
  }

  async startRecording(onChordDetected: (event: ChordDetectionEvent) => void): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Audio analyzer not initialized');
    }

    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      // Get microphone access
      const stream = await this.requestMicrophoneAccess();
      
      // Set up audio context
      this.audioContext = new AudioContext({ sampleRate: 44100 });
      console.log('Audio context sample rate:', this.audioContext.sampleRate);
      
      const source = this.audioContext.createMediaStreamSource(stream);
      
      // Set up analyser node
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 8192;
      this.analyserNode.smoothingTimeConstant = 0.2; // Set to 0.2 for balance between responsiveness and stability.
      
      console.log('Analyser config:', {
        fftSize: this.analyserNode.fftSize,
        frequencyBinCount: this.analyserNode.frequencyBinCount,
        smoothingTimeConstant: this.analyserNode.smoothingTimeConstant,
        minDecibels: this.analyserNode.minDecibels,
        maxDecibels: this.analyserNode.maxDecibels
      });
      
      source.connect(this.analyserNode);
      
      this.onChordDetected = onChordDetected;
      this.isRecording = true;
      
      // Clear previous chord tracking data for new recording session
      this.lastEmittedChord = null;
      this.candidateChord = null;
      this.consecutiveDetections = 0;
      
      // Start analysis loop
      this.startAnalysisLoop();
      
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  private startAnalysisLoop() {
    if (!this.analyserNode) return;

    const bufferLength = this.analyserNode.frequencyBinCount;
    const frequencyData = new Float32Array(bufferLength);
    const timeData = new Uint8Array(this.analyserNode.fftSize);

    const analyze = () => {
      if (!this.isRecording || !this.analyserNode) return;

      // Get both frequency and time domain data
      this.analyserNode.getFloatFrequencyData(frequencyData);
      this.analyserNode.getByteTimeDomainData(timeData);
      
      try {
        // Perform chord detection
        const chordResult = this.detectChord(frequencyData, timeData);
        
        if (chordResult && this.onChordDetected) {
          this.onChordDetected(chordResult);
        }
      } catch (error) {
        console.error('Chord detection error:', error);
      }
      
      // Continue analysis
      if (this.isRecording) {
        this.analysisInterval = window.setTimeout(analyze, 500); // Analyze every 500ms
      }
    };

    analyze();
  }

  private detectChord(frequencyData: Float32Array, timeData: Uint8Array): ChordDetectionEvent | null {
    try {
      // Calculate actual audio energy from time domain (amplitude)
      const energy = this.calculateTimeDomainEnergy(timeData);
      
      if (energy < 0.00005) {
        // Reset detection state on silence to be ready for the next chord.
        this.candidateChord = null;
        this.consecutiveDetections = 0;
        return null;
      }
      
      const detectedChord = this.analyzeFrequenciesForChord(frequencyData);
      
      // --- New, More Responsive Debouncing Logic ---
      if (detectedChord) {
        if (detectedChord === this.candidateChord) {
          this.consecutiveDetections++;
        } else {
          this.candidateChord = detectedChord;
          this.consecutiveDetections = 1;
        }
      } else {
        this.candidateChord = null;
        this.consecutiveDetections = 0;
      }
      
      let chordToEmit: string | null = null;
      
      if (this.candidateChord) {
        // If this is the same chord we're already displaying, emit it immediately to keep UI active.
        if (this.candidateChord === this.lastEmittedChord) {
          chordToEmit = this.candidateChord;
        } 
        // If this is a new chord, wait for 2 consecutive detections to confirm it.
        else if (this.consecutiveDetections >= 2) {
          chordToEmit = this.candidateChord;
        }
      }

      if (chordToEmit && chordToEmit !== this.lastEmittedChord) {
        console.log(`✅ New chord confirmed: ${chordToEmit}`);
      }
      this.lastEmittedChord = chordToEmit;

      if (!chordToEmit) {
        if (this.candidateChord) {
          console.log(`⏳ Candidate chord: ${this.candidateChord} (${this.consecutiveDetections} detection(s))`);
        }
        return null; // Nothing to emit yet
      }

      const result = {
        chord: chordToEmit,
        confidence: Math.min(0.95, Math.max(0.4, energy * 20 + 0.3)),
        timestamp: Date.now(),
      };
      
      return result;
    } catch (error) {
      console.error('Chord detection failed:', error);
      return null;
    }
  }



  private analyzeFrequenciesForChord(frequencyData: Float32Array): string | null {
    // Convert frequency domain data to find fundamental frequencies
    const sampleRate = 44100;
    const nyquist = sampleRate / 2;
    const binSize = nyquist / frequencyData.length;
    
    // Find peaks in the frequency spectrum
    const peaks = this.findFrequencyPeaks(frequencyData, binSize);
    
    if (peaks.length < 2) {
      return null; // Need at least 2 notes for a chord
    }
    
    // Map frequencies to musical notes
    const notes = peaks.map(freq => this.frequencyToNote(freq)).filter((note): note is string => note !== null);
    
    if (notes.length < 2) {
      return null;
    }
    
    // Analyze the note combination to determine chord
    return this.identifyChordFromNotes(notes);
  }
  
  private findFrequencyPeaks(frequencyData: Float32Array, binSize: number): number[] {
    const peaks: { frequency: number; magnitude: number }[] = [];
    const threshold = -70; // A higher threshold to focus on more prominent notes.
    
    // A simpler local maxima check.
    for (let i = 1; i < frequencyData.length - 1; i++) {
      if (frequencyData[i] > threshold && 
          frequencyData[i] > frequencyData[i - 1] && 
          frequencyData[i] > frequencyData[i + 1]) {
        
        const frequency = i * binSize;
        if (frequency >= 80 && frequency <= 1200) { // Standard guitar range.
          peaks.push({ frequency, magnitude: frequencyData[i] });
        }
      }
    }
    
    if (peaks.length === 0) return [];

    // Sort by magnitude to find the strongest signals.
    peaks.sort((a, b) => b.magnitude - a.magnitude);
    const strongestPeaks = peaks.slice(0, 12); // Consider more peaks initially for harmonic analysis.

    // --- Harmonic Filtering ---
    // Remove peaks that are likely harmonics of stronger, lower-frequency peaks.
    const fundamentals: { frequency: number; magnitude: number }[] = [];
    for (const peak of strongestPeaks) {
      let isHarmonic = false;
      for (const fundamental of fundamentals) {
        const ratio = peak.frequency / fundamental.frequency;
        // Check if the peak's frequency is a near-integer multiple of a stronger fundamental.
        if (Math.abs(ratio - Math.round(ratio)) < HARMONIC_RATIO_TOLERANCE) { 
          isHarmonic = true;
          break;
        }
      }

      if (!isHarmonic) {
        fundamentals.push(peak);
      }
    }

    fundamentals.sort((a, b) => b.magnitude - a.magnitude);
    return fundamentals.slice(0, 6).map(p => p.frequency); // Return the 6 strongest fundamental frequencies.
  }

  private frequencyToNote(frequency: number): string | null {
    // A4 = 440Hz reference
    const semitones = Math.round(12 * Math.log2(frequency / A4));
    const noteIndex = (semitones + 9 + 120) % 12; // +9 to shift A to index 9, +120 to handle negatives
    
    // Calculate the expected frequency for this note
    const expectedFreq = A4 * Math.pow(2, semitones / 12);
    const cents = 1200 * Math.log2(frequency / expectedFreq);
    
    if (Math.abs(cents) > 50) {
      // console.log(`Frequency ${frequency.toFixed(1)}Hz rejected - ${Math.abs(cents).toFixed(1)} cents off from ${NOTE_NAMES[noteIndex]}`);
      return null;
    }
    
    const note = NOTE_NAMES[noteIndex];
    // console.log(`${frequency.toFixed(1)}Hz -> ${note} (${cents.toFixed(1)} cents)`);
    return note;
  }

  private identifyChordFromNotes(notes: string[]): string | null {
    const uniqueNotes = new Set(notes);
    if (uniqueNotes.size < 2) return null;
  
    const scoredChords: { name: string; score: number }[] = [];
  
    for (const chord of CHORD_DEFINITIONS) {
      const chordNotes = new Set(chord.notes);
      const matchedNotes = [...uniqueNotes].filter(note => chordNotes.has(note));
  
      if (matchedNotes.length < 2) continue;
  
      // Score based on how well the detected notes match the chord definition.
      const completeness = matchedNotes.length / chordNotes.size;
      const purity = matchedNotes.length / uniqueNotes.size; // Penalizes extraneous notes.
      const score = completeness * purity;
  
      if (score > 0) {
        scoredChords.push({ name: chord.name, score });
      }
    }
  
    if (scoredChords.length === 0) return null;

    scoredChords.sort((a, b) => b.score - a.score);
    const bestMatch = scoredChords[0];

    // Threshold for a confident match.
    if (bestMatch && bestMatch.score >= CHORD_MATCH_THRESHOLD) {
      return bestMatch.name;
    }
    
    return null;
  }

  private calculateTimeDomainEnergy(timeData: Uint8Array): number {
    let sum = 0;
    let min = 255;
    let max = 0;
    
    for (let i = 0; i < timeData.length; i++) {
      min = Math.min(min, timeData[i]);
      max = Math.max(max, timeData[i]);
      
      // Convert from 0-255 range to -1 to 1 range
      const sample = (timeData[i] - 128) / 128;
      sum += sample * sample;
    }
    
    const energy = Math.sqrt(sum / timeData.length);
    
    // Debug logging every 10th call to avoid spam
    if (Math.random() < 0.1) {
      console.log(`Time domain: min=${min}, max=${max}, range=${max-min}, energy=${energy.toFixed(6)}`);
    }
    
    return energy;
  }

  private calculateAudioEnergy(frequencyData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      const value = Math.pow(10, frequencyData[i] / 20); // Convert dB to linear
      sum += value * value;
    }
    return Math.sqrt(sum / frequencyData.length);
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
    
    // Reset chord history for next recording
    this.lastEmittedChord = null;
    this.candidateChord = null;
    this.consecutiveDetections = 0;
    
    console.log('Recording stopped');
  }

  isRecordingActive(): boolean {
    return this.isRecording;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  // Debug method to get current chord tracking state
  getChordTrackingState(): { lastEmittedChord: string | null; candidateChord: string | null; consecutiveDetections: number; } {
    return {
      lastEmittedChord: this.lastEmittedChord,
      candidateChord: this.candidateChord,
      consecutiveDetections: this.consecutiveDetections,
    };
  }
}

