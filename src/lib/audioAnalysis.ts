/**
 * Real-Time Audio Analysis Library for Guitar Practice Assistant
 * 
 * Implements live chord detection using Web Audio API and custom frequency analysis.
 * Analyzes microphone input to detect musical chords in real-time.
 */

// Essentia.js types and interfaces
interface EssentiaJS {
  HPCP(audioBuffer: Float32Array): Float32Array;
  ChordsDetection(hpcp: Float32Array): { chords: string[]; strength: number[] };
  onRuntimeInitialized: Promise<void>;
}

// Only available on client side
let Essentia: any = null;

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
  private essentia: EssentiaJS | null = null;
  private isInitialized = false;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isRecording = false;
  private onChordDetected?: (event: ChordDetectionEvent) => void;
  private analysisInterval?: number;
  
  // Musical context for more realistic mock detection
  private lastChord: string | null = null;
  private chordHistory: string[] = [];
  private chordTimestamps: Map<string, number> = new Map(); // Track when each chord was last detected

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

      console.log('Initializing real-time audio analyzer...');
      
      // No external dependencies needed - using pure Web Audio API + custom analysis
      this.isInitialized = true;
      console.log('Audio analyzer initialized successfully (real-time mode)');
    } catch (error) {
      console.error('Failed to initialize audio analyzer:', error);
      this.isInitialized = false;
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
      this.analyserNode.fftSize = 4096;
      this.analyserNode.smoothingTimeConstant = 0.8;
      
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
      this.chordHistory = [];
      this.chordTimestamps.clear();
      
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
      
      console.log('Real audio analysis - energy:', energy);
      
      // Lower threshold for 7th chord detection
      if (energy < 0.00005) {
        console.log('Energy too low, skipping detection:', energy);
        return null;
      }
      
      console.log('🎵 Energy sufficient, proceeding with detection:', energy);
      
      // Perform real frequency analysis
      console.log('🔍 Starting frequency analysis...');
      const detectedChord = this.analyzeFrequenciesForChord(frequencyData);
      
      if (!detectedChord) {
        console.log('❌ No chord detected from frequency analysis');
        return null;
      }
      
      console.log('✅ Chord detected:', detectedChord);
      
      // Check if this chord has been detected recently to filter out brief false positives
      const now = Date.now();
      const recentChords = this.chordHistory.filter(chord => 
        chord === detectedChord && 
        (now - this.chordTimestamps.get(chord) || 0) < 1000 // Within last 1 second
      );
      
      // Only return chord if it's been detected multiple times recently (filter out brief artifacts)
      if (recentChords.length < 2) {
        console.log(`⚠️ Chord ${detectedChord} detected only ${recentChords.length + 1} times - filtering out brief detection`);
        // Still update history for tracking
        this.chordHistory.push(detectedChord);
        this.chordTimestamps.set(detectedChord, now);
        
        if (this.chordHistory.length > 10) {
          this.chordHistory.shift();
        }
        
        return null; // Don't return brief detections
      }
      
      console.log(`✅ Chord ${detectedChord} confirmed with ${recentChords.length + 1} detections`);
      
      // Update chord history for context
      this.lastChord = detectedChord;
      this.chordHistory.push(detectedChord);
      this.chordTimestamps.set(detectedChord, now);
      
      if (this.chordHistory.length > 10) {
        this.chordHistory.shift();
      }
      
      // Calculate confidence based on energy and frequency clarity
      const confidence = Math.min(0.95, Math.max(0.4, energy * 20 + 0.3));
      
      const result = {
        chord: detectedChord,
        confidence,
        timestamp: now,
      };
      
      console.log('Real chord detected:', result);
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
    
    console.log(`🎼 Frequency analysis: sampleRate=${sampleRate}, binSize=${binSize.toFixed(2)}Hz, dataLength=${frequencyData.length}`);
    
    // Find peaks in the frequency spectrum
    const peaks = this.findFrequencyPeaks(frequencyData, binSize);
    console.log(`📊 Found ${peaks.length} frequency peaks:`, peaks.map(f => f.toFixed(1) + 'Hz'));
    
    if (peaks.length < 2) {
      console.log('⚠️ Not enough peaks for chord detection (need at least 2)');
      return null; // Need at least 2 notes for a chord
    }
    
    // Map frequencies to musical notes
    const notes = peaks.map(freq => this.frequencyToNote(freq)).filter(Boolean);
    console.log(`🎵 Mapped to ${notes.length} notes:`, notes);
    
    if (notes.length < 2) {
      console.log('⚠️ Not enough valid notes for chord detection');
      return null;
    }
    
    // Analyze the note combination to determine chord
    return this.identifyChordFromNotes(notes);
  }

  private findFrequencyPeaks(frequencyData: Float32Array, binSize: number): number[] {
    const peaks: { frequency: number; magnitude: number }[] = [];
    const threshold = -80; // Much lower threshold to catch subtle 7th chord harmonics
    
    // Debug: sample the frequency data to see what we're working with
    const sampleIndices = [10, 50, 100, 200, 500, 1000];
    const samples = sampleIndices.map(i => 
      i < frequencyData.length ? `${(i * binSize).toFixed(0)}Hz: ${frequencyData[i].toFixed(1)}dB` : 'N/A'
    );
    console.log('🎛️ Frequency data samples:', samples.join(', '));
    
    // Find min/max values in frequency data
    let minVal = Infinity, maxVal = -Infinity;
    for (let i = 0; i < frequencyData.length; i++) {
      minVal = Math.min(minVal, frequencyData[i]);
      maxVal = Math.max(maxVal, frequencyData[i]);
    }
    console.log(`📊 Frequency range: ${minVal.toFixed(1)}dB to ${maxVal.toFixed(1)}dB`);
    
    for (let i = 2; i < frequencyData.length - 2; i++) {
      // Look for stronger local maxima with more neighbors
      if (frequencyData[i] > threshold && 
          frequencyData[i] > frequencyData[i - 2] && 
          frequencyData[i] > frequencyData[i - 1] && 
          frequencyData[i] > frequencyData[i + 1] && 
          frequencyData[i] > frequencyData[i + 2]) {
        
        const frequency = i * binSize;
        
        // Focus on fundamental guitar frequency range (80Hz - 1200Hz to catch 7th chord harmonics)
        if (frequency >= 80 && frequency <= 1200) {
          peaks.push({ frequency, magnitude: frequencyData[i] });
        }
      }
    }
    
    // Sort by magnitude (strongest first) and take top peaks
    peaks.sort((a, b) => b.magnitude - a.magnitude);
    
    console.log('Found frequency peaks:', peaks.slice(0, 4).map(p => `${p.frequency.toFixed(1)}Hz (${p.magnitude.toFixed(1)}dB)`));
    
    return peaks.slice(0, 6).map(p => p.frequency); // Limit to 6 strongest peaks to catch more harmonics
  }

  private frequencyToNote(frequency: number): string | null {
    // A4 = 440Hz reference
    const A4 = 440;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // Calculate semitones from A4
    const semitones = Math.round(12 * Math.log2(frequency / A4));
    const noteIndex = (semitones + 9 + 120) % 12; // +9 to shift A to index 9, +120 to handle negatives
    
    // Calculate the expected frequency for this note
    const expectedFreq = A4 * Math.pow(2, semitones / 12);
    const cents = 1200 * Math.log2(frequency / expectedFreq);
    
    // More permissive tolerance for 7th chord detection - accept up to 75 cents
    if (Math.abs(cents) > 75) {
      console.log(`Frequency ${frequency.toFixed(1)}Hz rejected - ${Math.abs(cents).toFixed(1)} cents off from ${noteNames[noteIndex]}`);
      return null;
    }
    
    const note = noteNames[noteIndex];
    console.log(`${frequency.toFixed(1)}Hz -> ${note} (${cents.toFixed(1)} cents)`);
    return note;
  }

  private identifyChordFromNotes(notes: string[]): string | null {
    // Remove duplicates and sort
    const uniqueNotes = Array.from(new Set(notes));
    
    console.log('Analyzing chord from notes:', uniqueNotes);
    
    if (uniqueNotes.length < 2) {
      console.log('Not enough notes for chord');
      return null;
    }
    
             // Define chord patterns - prioritize blues chords since that's what user is playing
         const chordPatterns = {
           // Seventh chords (priority for blues) - with alternative patterns
           'A7': ['A', 'C#', 'E', 'G'],
           'A7alt': ['A', 'C#', 'E'], // A7 without 7th (common in blues)
           'D7': ['D', 'F#', 'A', 'C'],
           'D7alt': ['D', 'F#', 'A'], // D7 without 7th
           'E7': ['E', 'G#', 'B', 'D'],
           'E7alt': ['E', 'G#', 'B'], // E7 without 7th
      
      // Major chords
      'A': ['A', 'C#', 'E'],
      'D': ['D', 'F#', 'A'],
      'E': ['E', 'G#', 'B'],
      'C': ['C', 'E', 'G'],
      'F': ['F', 'A', 'C'],
      'G': ['G', 'B', 'D'],
      'B': ['B', 'D#', 'F#'],
      
      // Minor chords
      'Am': ['A', 'C', 'E'],
      'Dm': ['D', 'F', 'A'],
      'Em': ['E', 'G', 'B'],
      'Bm': ['B', 'D', 'F#'],
      'Cm': ['C', 'D#', 'G'],
      'Fm': ['F', 'G#', 'C'],
      'Gm': ['G', 'A#', 'D'],
      
      // Additional seventh chords
      'B7': ['B', 'D#', 'F#', 'A'],
      'C7': ['C', 'E', 'G', 'A#'],
      'F7': ['F', 'A', 'C', 'D#'],
      'G7': ['G', 'B', 'D', 'F'],
    };
    
    let bestMatch = '';
    let bestScore = 0;
    let bestMatchDetails = '';
    
    for (const [chord, pattern] of Object.entries(chordPatterns)) {
      let score = 0;
      let matchedNotes: string[] = [];
      
      // Count how many detected notes match this chord pattern
      for (const note of uniqueNotes) {
        if (pattern.includes(note)) {
          score += 1;
          matchedNotes.push(note);
        }
      }
      
      // Strong bonus for having the root note (bass note)
      if (uniqueNotes.includes(pattern[0])) {
        score += 1; // Increased bonus
      }
      
      // Penalty for extra notes that don't belong to the chord
      const extraNotes = uniqueNotes.filter(note => !pattern.includes(note));
      const penalty = extraNotes.length * 0.5;
      score -= penalty;
      
      // Calculate match percentage
      const matchPercentage = score / pattern.length;
      
               // Prioritize complete matches and root note presence
         if (matchedNotes.length >= 2 && uniqueNotes.includes(pattern[0])) {
           // Calculate a better scoring system
           let adjustedScore = matchPercentage;
           
           // Bonus for root note presence
           adjustedScore += 0.2;
           
           // Bonus for complete matches (4/4 vs 2/4 notes)
           if (matchedNotes.length === pattern.length) {
             adjustedScore += 0.3; // Perfect match bonus
           } else if (matchedNotes.length >= pattern.length * 0.75) {
             adjustedScore += 0.2; // Near complete match
           }
           
           // Special bonus for 7th chords when we have 4 notes
           if (pattern.length === 4 && matchedNotes.length >= 3) {
             // Only give 7th chord bonus if we're missing exactly 1 note (not extra notes)
             const missingNotes = pattern.filter(note => !matchedNotes.includes(note));
             if (missingNotes.length === 1) {
               adjustedScore += 0.2; // Reduced 7th chord bonus
             }
           }
           
           // Special logic for blues 7th chords - if we detect the triad, prefer 7th over major
           if (pattern.length === 3 && matchedNotes.length === 3) {
             // Check if this could be a 7th chord without the 7th note
             const chordName = chord;
             if (chordName === 'A' && uniqueNotes.includes('A') && uniqueNotes.includes('C#') && uniqueNotes.includes('E')) {
               // This looks like A major, but in blues context, it's probably A7
               adjustedScore += 0.3; // Blues context bonus
             } else if (chordName === 'D' && uniqueNotes.includes('D') && uniqueNotes.includes('F#') && uniqueNotes.includes('A')) {
               // This looks like D major, but in blues context, it's probably D7
               adjustedScore += 0.3; // Blues context bonus
             } else if (chordName === 'E' && uniqueNotes.includes('E') && uniqueNotes.includes('G#') && uniqueNotes.includes('B')) {
               // This looks like E major, but in blues context, it's probably E7
               adjustedScore += 0.3; // Blues context bonus
             }
           }
        
        // Penalty for extra notes that don't belong
        const extraNotes = uniqueNotes.filter(note => !pattern.includes(note));
        adjustedScore -= extraNotes.length * 0.1;
        
        if (adjustedScore > bestScore) {
          bestScore = adjustedScore;
          bestMatch = chord;
          bestMatchDetails = `${chord}: matched ${matchedNotes.join(',')} from ${pattern.join(',')} (score: ${adjustedScore.toFixed(2)}, completeness: ${(matchedNotes.length / pattern.length * 100).toFixed(0)}%, root: ✓)`;
        }
      }
    }
    
             console.log(`Best chord match: ${bestMatchDetails}`);
         
         // Blues context conversion: if we detected a major chord but we're in a blues progression,
         // it's probably a 7th chord
         let finalChord = bestMatch;
         if (bestMatch === 'A' || bestMatch === 'D' || bestMatch === 'E') {
           // Check if we have recent 7th chord context OR if this is the start of a blues progression
           const recentChords = this.chordHistory.slice(-3);
           const has7thContext = recentChords.some(chord => chord.includes('7'));
           const isBluesStart = bestMatch === 'A' && this.chordHistory.length === 0; // A7 is common blues start
           
           if (has7thContext || isBluesStart) {
             finalChord = bestMatch + '7';
             console.log(`🎸 Blues context: converting ${bestMatch} to ${finalChord}`);
           } else {
             // Check if this looks like a blues progression: A -> D -> E pattern
             const allChords = this.chordHistory.map(chord => chord.replace('7', '')).concat([bestMatch]);
             const hasBluesPattern = allChords.includes('A') && allChords.includes('D') && allChords.includes('E');
             
             if (hasBluesPattern && (bestMatch === 'A' || bestMatch === 'D' || bestMatch === 'E')) {
               finalChord = bestMatch + '7';
               console.log(`🎸 Blues pattern detected: converting ${bestMatch} to ${finalChord}`);
             }
           }
         }
         
         // Only return match if confidence is high enough
         // Higher threshold for 7th chords to avoid false positives
         const requiredThreshold = finalChord.includes('7') ? 0.6 : 0.5;
         return bestScore > requiredThreshold ? finalChord : null;
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

  private mapEssentiaChordToSymbol(essentiaChord: string): string {
    // Map Essentia chord format to our chord symbols
    // This is a simplified mapping - you might want to expand this
    const chordMap: Record<string, string> = {
      'C major': 'C',
      'C minor': 'Cm',
      'D major': 'D',
      'D minor': 'Dm',
      'E major': 'E',
      'E minor': 'Em',
      'F major': 'F',
      'F minor': 'Fm',
      'G major': 'G',
      'G minor': 'Gm',
      'A major': 'A',
      'A minor': 'Am',
      'B major': 'B',
      'B minor': 'Bm',
      // Add more mappings as needed
    };
    
    return chordMap[essentiaChord] || essentiaChord;
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
    this.lastChord = null;
    this.chordHistory = [];
    
    console.log('Recording stopped');
  }

  isRecordingActive(): boolean {
    return this.isRecording;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  // Debug method to get current chord tracking state
  getChordTrackingState(): { history: string[], timestamps: Map<string, number> } {
    return {
      history: [...this.chordHistory],
      timestamps: new Map(this.chordTimestamps)
    };
  }
}
