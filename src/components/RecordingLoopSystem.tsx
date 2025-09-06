'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Howl, Howler } from 'howler';
import { chordDefinitions } from '@/lib/chords';

interface RecordingLoopSystemProps {
  isRecording: boolean;
  detectedChords: Array<{ chord: string; timestamp: number }>;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onClearRecording: () => void;
  onUpdateChord: (timestamp: number, newChord: string) => void;
  onPlaybackChordChange: (chord: string | null) => void;
}

const RecordingLoopSystem: React.FC<RecordingLoopSystemProps> = ({
  isRecording,
  detectedChords,
  onStartRecording,
  onStopRecording,
  onClearRecording,
  onUpdateChord,
  onPlaybackChordChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [metronomeBPM, setMetronomeBPM] = useState(120);
  const [volume, setVolume] = useState(1);
  const [detailsVisible, setDetailsVisible] = useState(false);
  
  // Audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Silence detection settings - much more guitar-friendly
  const [silenceThreshold, setSilenceThreshold] = useState(0.001); // Lower threshold for guitar
  const [silenceDuration, setSilenceDuration] = useState(2000); // Wait 2 seconds for natural decay
  const [trimSilenceThreshold, setTrimSilenceThreshold] = useState(0.0005); // Very low for trimming
  
  const playbackRef = useRef<number | null>(null);
  const metronomeRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioUrlRef = useRef<string | null>(null);
  
  // --- REDESIGNED AUDIO STATE for drift-free looping ---
  const [isAudioReady, setIsAudioReady] = useState(false);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioStartTimeRef = useRef<number>(0); // Tracks start time of the *current* loop iteration
  const pauseTimeRef = useRef<number>(0); // Tracks position within the loop when paused
  const scheduleNextLoopRef = useRef<NodeJS.Timeout | null>(null);
  // --- End of redesigned state ---
  
  const [editingChord, setEditingChord] = useState<{ chord: string; timestamp: number } | null>(null);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const lastEmittedPlaybackChordRef = useRef<string | null>(null);

  // --- START: DRIFT-FREE LOOPING LOGIC ---

  // Stop Web Audio loop
  const stopWebAudioLoop = useCallback(() => {
    if (scheduleNextLoopRef.current) {
      clearTimeout(scheduleNextLoopRef.current);
      scheduleNextLoopRef.current = null;
    }
    if (audioSourceNodeRef.current) {
      try {
        audioSourceNodeRef.current.stop();
      } catch (e) {
        // Can ignore errors if the source is already stopped
      }
      audioSourceNodeRef.current.disconnect();
      audioSourceNodeRef.current = null;
    }
  }, []);

  const startWebAudioLoop = useCallback((startTime = 0) => {
    if (!audioContextRef.current || !audioBufferRef.current) return;
    
    stopWebAudioLoop(); // Stop any existing loop first

    const audioContext = audioContextRef.current;
    const audioBuffer = audioBufferRef.current;
    const loopDuration = (loopEnd - loopStart) / 1000;

    if (loopDuration <= 0) return;

    const playChunk = (timeOffset: number) => {
      if (!audioContextRef.current) return; // Guard against context being closed
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      const durationToPlay = loopDuration - timeOffset;
      source.start(0, (loopStart / 1000) + timeOffset, durationToPlay);
      audioSourceNodeRef.current = source;
      
      // Crucial part: track the start of this specific chunk for drift-free animation
      audioStartTimeRef.current = audioContext.currentTime - timeOffset;
      
      // Schedule the next loop iteration just before this one ends
      scheduleNextLoopRef.current = setTimeout(() => {
        playChunk(0); // Next iteration starts from the beginning of the loop
      }, durationToPlay * 1000);
    };

    playChunk(startTime);
  }, [loopStart, loopEnd, stopWebAudioLoop]);

  // Pause Web Audio loop
  const pauseWebAudioLoop = useCallback(() => {
    if (audioSourceNodeRef.current && audioContextRef.current) {
      const loopDuration = (loopEnd - loopStart) / 1000;
      if (loopDuration > 0) {
        const elapsedTime = audioContextRef.current.currentTime - audioStartTimeRef.current;
        pauseTimeRef.current = elapsedTime % loopDuration;
      }
      stopWebAudioLoop();
    }
  }, [loopEnd, loopStart, stopWebAudioLoop]);
  
  // Resume Web Audio loop
  const resumeWebAudioLoop = useCallback(() => {
    if (audioBufferRef.current && audioContextRef.current) {
      startWebAudioLoop(pauseTimeRef.current);
    }
  }, [startWebAudioLoop]);

  // --- END: DRIFT-FREE LOOPING LOGIC ---


  const handlePlayPause = () => {
    // The useEffect hook will handle the playback logic based on the isPlaying state.
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    pauseTimeRef.current = 0; // Reset pause state
    lastEmittedPlaybackChordRef.current = null;
    onPlaybackChordChange(null);
    
    // Stop all audio systems
    stopWebAudioLoop();
  };

  const handleLoopToggle = () => {
    if (loopStart === 0 && loopEnd === totalDuration) {
      // Set a custom loop (e.g., 8 bars at 120 BPM = 16 seconds)
      const customLoopDuration = Math.min(16000, totalDuration); // 16 seconds max
      setLoopStart(0);
      setLoopEnd(customLoopDuration);
      console.log('Custom loop set:', { start: 0, end: customLoopDuration, duration: customLoopDuration });
    } else {
      // Reset to full recording
      setLoopStart(0);
      setLoopEnd(totalDuration);
      console.log('Full loop set:', { start: 0, end: totalDuration, duration: totalDuration });
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCurrentChord = (timeMs: number) => {
    if (detectedChords.length === 0) return null;
    
    const adjustedTime = timeMs + loopStart;
    const chord = detectedChords.find((event, index) => {
      const nextEvent = detectedChords[index + 1];
      // Ensure each chord has at least 1 second duration, or until next chord
      const eventStart = getRelativeTimestamp(event.timestamp);
      const eventEnd = nextEvent ? getRelativeTimestamp(nextEvent.timestamp) : totalDuration;
      return adjustedTime >= eventStart && adjustedTime < eventEnd;
    });
    
    return chord?.chord || null;
  };

  // Helper function to get relative timestamp
  const getRelativeTimestamp = (timestamp: number) => {
    if (detectedChords.length === 0) return 0;
    return timestamp - Math.min(...detectedChords.map(e => e.timestamp));
  };

  const totalDuration = useMemo(() => {
    if (detectedChords.length === 0) return 0;
    const timestamps = detectedChords.map(event => event.timestamp);
    return (Math.max(...timestamps) - Math.min(...timestamps)) + 2000; // Add 2 seconds buffer
  }, [detectedChords]);

  const processedChords = useMemo(() => {
    if (detectedChords.length < 1) return [];

    // 1. Consolidate consecutive identical chords
    const consolidated = detectedChords.reduce<Array<{ chord: string; timestamp: number }>>((acc, current) => {
      if (acc.length === 0 || acc[acc.length - 1].chord !== current.chord) {
        acc.push({
          chord: current.chord,
          timestamp: current.timestamp,
        });
      }
      return acc;
    }, []);

    const minTimestamp = detectedChords[0].timestamp;

    // 2. Calculate start, end, and duration for each consolidated block
    return consolidated.map((event, index) => {
      const nextEvent = consolidated[index + 1];

      const start = event.timestamp - minTimestamp;
      // The end time of the last chord should be the total duration of the loop
      const end = nextEvent ? nextEvent.timestamp - minTimestamp : totalDuration;
      
      return {
        ...event,
        start,
        end,
        duration: end - start,
      };
    });
  }, [detectedChords, totalDuration]);

  const chordColorMap = useMemo(() => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
      'bg-orange-500', 'bg-cyan-500', 'bg-lime-500', 'bg-rose-500'
    ];
    const uniqueChords = [...new Set(processedChords.map(c => c.chord))];
    const map = new Map<string, string>();
    uniqueChords.forEach((chord, index) => {
      map.set(chord, colors[index % colors.length]);
    });
    return map;
  }, [processedChords]);

  const getChordColor = (chord: string) => {
    return chordColorMap.get(chord) || 'bg-gray-500';
  };

  const currentChord = getCurrentChord(currentTime + loopStart);

  // Debug logging
  useEffect(() => {
    if (detectedChords.length > 0) {
      console.log('Detected Chords:', detectedChords);
      console.log('Total Duration:', totalDuration);
      console.log('Max Timestamp:', Math.max(...detectedChords.map(event => event.timestamp)));
      console.log('Min Timestamp:', Math.min(...detectedChords.map(event => event.timestamp)));
      console.log('Relative Duration:', Math.max(...detectedChords.map(event => event.timestamp)) - Math.min(...detectedChords.map(event => event.timestamp)));
    }
  }, [detectedChords, totalDuration]);

  // Initialize loop end to total duration
  useEffect(() => {
    if (totalDuration > 0) {
      // Always start loop from 0 (beginning of recording)
      setLoopStart(0);
      setLoopEnd(totalDuration);
    }
  }, [totalDuration]);

  // Reset current time when loop changes
  useEffect(() => {
    if (currentTime > loopEnd - loopStart) {
      setCurrentTime(0);
    }
  }, [loopStart, loopEnd, currentTime]);

  // Metronome logic
  useEffect(() => {
    if (!metronomeEnabled || !isPlaying) {
      if (metronomeRef.current) {
        clearInterval(metronomeRef.current);
        metronomeRef.current = null;
      }
      return;
    }

    const interval = (60 / metronomeBPM) * 1000;
    metronomeRef.current = setInterval(() => {
      // Create a metronome click sound
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    }, interval);

    return () => {
      if (metronomeRef.current) {
        clearInterval(metronomeRef.current);
      }
    };
  }, [metronomeEnabled, isPlaying, metronomeBPM]);

  // Cleanup object URL when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      // Cleanup countdown
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, []);

  // Playback logic
  useEffect(() => {
    if (!isPlaying) {
      if (playbackRef.current) {
        cancelAnimationFrame(playbackRef.current);
        playbackRef.current = null;
      }
      
      // Stop Web Audio loop if active
      stopWebAudioLoop();
      return;
    }

    const animate = () => {
      if (!isPlaying) {
        if(playbackRef.current) cancelAnimationFrame(playbackRef.current);
        playbackRef.current = null;
        return;
      }
    
      let positionInLoopMs;
      const loopDurationMs = loopEnd - loopStart;
    
      if (audioContextRef.current && audioStartTimeRef.current > 0 && loopDurationMs > 0) {
        // THIS IS THE DRIFT-FREE CALCULATION
        const elapsedSec = audioContextRef.current.currentTime - audioStartTimeRef.current;
        positionInLoopMs = elapsedSec * 1000;
      }
    
      if (positionInLoopMs !== undefined && positionInLoopMs >= 0) {
        setCurrentTime(positionInLoopMs);
        
        // Find and report the current chord
        const currentChordAtTime = getCurrentChord(positionInLoopMs);
        if(currentChordAtTime !== lastEmittedPlaybackChordRef.current) {
          onPlaybackChordChange(currentChordAtTime);
          lastEmittedPlaybackChordRef.current = currentChordAtTime;
        }
      }
    
      playbackRef.current = requestAnimationFrame(animate);
    };

    playbackRef.current = requestAnimationFrame(animate);

    // Start audio playback with ultra-low-latency Web Audio API
    if (audioBufferRef.current && audioContextRef.current) {
      console.log('Using Web Audio API for ultra-low-latency looping');
      if (pauseTimeRef.current > 0) {
        resumeWebAudioLoop();
      } else {
        startWebAudioLoop(0);
      }
    }

    return () => {
      if (playbackRef.current) {
        cancelAnimationFrame(playbackRef.current);
      }
      
      // Stop Web Audio loop if active
      stopWebAudioLoop();
    };
  }, [isPlaying, loopStart, loopEnd, playbackSpeed]);

  const startAudioRecording = async () => {
    try {
      setIsRecordingAudio(true);
      
      // Get microphone access with optimal settings for guitar
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 1
        }
      });

      // Create audio context for real-time analysis
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Set up MediaRecorder with high quality
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });
      
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      // Smart silence detection that accounts for guitar decay
      let hasDetectedSound = false;
      let silenceStartTime: number | null = null;
      const lastSoundLevel = 0;
      const countdownClearTime = Date.now() + 1000; // Wait 1 second after countdown to start detection
      
      const detectSilence = () => {
        if (!isRecordingAudio || !analyser) return;
        
        // Don't start detecting until countdown audio has cleared
        if (Date.now() < countdownClearTime) {
          if (isRecordingAudio) {
            requestAnimationFrame(detectSilence);
          }
          return;
        }
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate RMS (Root Mean Square) for better volume detection
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += (dataArray[i] / 255) ** 2;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const currentLevel = rms;
        
        // Detect if we've heard actual sound (not just background noise)
        if (currentLevel > silenceThreshold && !hasDetectedSound) {
          hasDetectedSound = true;
          silenceStartTime = null;
          console.log('Sound detected, starting recording');
        }
        
        // Only start silence detection after we've heard actual sound
        if (hasDetectedSound) {
          // Check if current level is below threshold
          if (currentLevel < silenceThreshold) {
            if (silenceStartTime === null) {
              silenceStartTime = Date.now();
              console.log('Silence detected, starting timer');
            } else {
              const silenceElapsed = Date.now() - silenceStartTime;
              
              // Wait for natural decay - don't stop immediately
              if (silenceElapsed > silenceDuration) {
                console.log('Silence duration reached, stopping recording');
                stopAudioRecording();
                return;
              }
            }
          } else {
            // Reset silence timer if we hear sound again
            silenceStartTime = null;
          }
        }
        
        // Continue monitoring
        if (isRecordingAudio) {
          requestAnimationFrame(detectSilence);
        }
      };

      // Start recording and silence detection
      mediaRecorder.start(100); // 100ms chunks for real-time processing
      requestAnimationFrame(detectSilence);
      
      // Handle recording stop
      mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped');
        setIsRecordingAudio(false);
        
        // --- START: CRITICAL FIX for AudioContext Lifecycle ---

        // 1. First, clean up the old analysis context and resources
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        if (analyserRef.current) {
          analyserRef.current = null;
        }
        stream.getTracks().forEach(track => track.stop());

        // --- END: CRITICAL FIX ---
        
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        // Trim silence from the recorded audio
        console.log('Trimming silence from recorded audio...');
        setIsProcessingAudio(true);
        
        try {
          const trimmedBlob = await trimAudioSilence(audioBlob);
          
          // Create object URL for Howler.js
          const audioUrl = URL.createObjectURL(trimmedBlob);
          audioUrlRef.current = audioUrl;
          
          // Also create AudioBuffer for Web Audio API (ultra-low-latency)
          try {
            // 2. Now, create a NEW, persistent context for playback
            const webAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const arrayBuffer = await trimmedBlob.arrayBuffer();
            const buffer = await webAudioContext.decodeAudioData(arrayBuffer);
            
            audioBufferRef.current = buffer;
            audioContextRef.current = webAudioContext;
            setIsAudioReady(true);
            
            console.log('Web Audio API buffer created for ultra-low-latency looping');
          } catch (webAudioError) {
            console.warn('Web Audio API not available, falling back to Howler.js:', webAudioError);
          } finally {
            setIsProcessingAudio(false);
          }
          
        } catch (error) {
          console.error('Error trimming audio:', error);
          setIsProcessingAudio(false);
        }
      };
      
      console.log('Audio recording started with smart silence detection');
      
    } catch (error) {
      console.error('Error starting audio recording:', error);
      setIsRecordingAudio(false);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      console.log('Stopping audio recording...');
      mediaRecorderRef.current.stop();
      
      // Clear any silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      
      // Stop all tracks
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current = null;
      }
    }
  };

  // Manual stop recording (for user control)
  const handleStopRecording = () => {
    if (isRecording) {
      onStopRecording();
      stopAudioRecording();
      
      // Clear any existing recording data
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      setIsAudioReady(false);
      audioBufferRef.current = null;
      
      console.log('Recording stopped and cleaned up');
    }
  };

  // Function to trim silence from audio
  const trimAudioSilence = async (audioBlob: Blob): Promise<Blob> => {
    try {
      // Create offline audio context for processing
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0); // Mono channel
      const sampleRate = audioBuffer.sampleRate;
      
      // More sophisticated silence detection for guitar
      const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
      let startSample = 0;
      let endSample = channelData.length - 1;
      
      // Find start of actual sound (ignore beginning silence)
      for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
        let windowSum = 0;
        for (let j = 0; j < windowSize; j++) {
          windowSum += Math.abs(channelData[i + j]);
        }
        const windowAverage = windowSum / windowSize;
        
        if (windowAverage > trimSilenceThreshold) {
          startSample = Math.max(0, i - Math.floor(sampleRate * 0.05)); // Start 50ms before first sound
          break;
        }
      }
      
      // Find end of actual sound (account for natural decay)
      for (let i = channelData.length - windowSize; i >= startSample; i -= windowSize) {
        let windowSum = 0;
        for (let j = 0; j < windowSize; j++) {
          windowSum += Math.abs(channelData[i + j]);
        }
        const windowAverage = windowSum / windowSize;
        
        if (windowAverage > trimSilenceThreshold) {
          // Add extra time for natural decay
          endSample = Math.min(channelData.length - 1, i + Math.floor(sampleRate * 0.5)); // Add 500ms for decay
          break;
        }
      }
      
      // Ensure we have a minimum duration
      const minDuration = Math.floor(sampleRate * 0.5); // At least 500ms
      if (endSample - startSample < minDuration) {
        endSample = Math.min(channelData.length - 1, startSample + minDuration);
      }
      
      console.log('Audio trimming:', {
        originalLength: channelData.length,
        startSample,
        endSample,
        trimmedLength: endSample - startSample,
        startTime: startSample / sampleRate,
        endTime: endSample / sampleRate
      });
      
      // Create new audio buffer with trimmed data
      const trimmedBuffer = audioContext.createBuffer(1, endSample - startSample, sampleRate);
      const trimmedChannelData = trimmedBuffer.getChannelData(0);
      
      for (let i = 0; i < trimmedChannelData.length; i++) {
        trimmedChannelData[i] = channelData[startSample + i];
      }
      
      // Convert to WAV format
      const wavBlob = audioBufferToWav(trimmedBuffer);
      
      // Cleanup
      audioContext.close();
      
      return wavBlob;
      
    } catch (error) {
      console.error('Error trimming audio silence:', error);
      throw error;
    }
  };

  // Helper function to convert AudioBuffer to WAV format
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert audio data to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const uniqueChordsInLoop = useMemo(() => {
    const chords = detectedChords.map(e => e.chord);
    return [...new Set(chords)];
  }, [detectedChords]);

  const allChords = useMemo(() => Object.keys(chordDefinitions), []);

  const handleChordUpdate = (newChord: string) => {
    if (editingChord) {
      onUpdateChord(editingChord.timestamp, newChord);
      setEditingChord(null); // Close modal
    }
  };
  
  // Start ULTIMATE circular looping with zero latency
  const startCircularLoop = () => {
    if (!audioBufferRef.current || !audioContextRef.current || !isPlaying) return;
    
    try {
      // Stop any existing sources
      if (audioSourceNodeRef.current) {
        audioSourceNodeRef.current.stop();
        audioSourceNodeRef.current.disconnect();
      }
      
      // Create circular buffer
      // This function is removed as per the new state
      // const circularBuffer = createCircularBuffer();
      // if (!circularBuffer) {
      //   console.warn('Failed to create circular buffer, falling back to regular');
      //   startWebAudioLoop();
      //   return;
      // }
      
      // Create a single source that plays the circular buffer
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current; // Use the trimmed audio buffer directly
      source.connect(audioContextRef.current.destination);
      
      // Calculate loop parameters
      const loopStartSeconds = loopStart / 1000;
      const loopEndSeconds = loopEnd / 1000;
      const loopDuration = loopEndSeconds - loopStartSeconds;
      
      // Enable native looping on the circular buffer
      source.loop = true;
      source.loopStart = 0; // Start from beginning of circular buffer
      source.loopEnd = loopDuration; // Loop at the end of first copy
      
      // Start playing immediately
      source.start();
      
      // Store references
      // setCircularSource(source); // This line is removed as per the new state
      // setIsCircularActive(true); // This line is removed as per the new state
      
      console.log('ULTIMATE circular loop started with zero latency');
      
    } catch (error) {
      console.error('Error starting circular loop:', error);
      // setIsCircularActive(false); // This line is removed as per the new state
      // Fallback to regular Web Audio
      startWebAudioLoop();
    }
  };

  // Recording countdown system
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const countdownAudioContextRef = useRef<AudioContext | null>(null);
  
  // Create countdown click sound
  const playCountdownClick = (isFinalClick: boolean = false) => {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies for countdown vs final click
      const frequency = isFinalClick ? 1200 : 800; // Higher pitch for final click
      const volume = isFinalClick ? 0.5 : 0.3; // Louder for final click
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      
      // Cleanup
      setTimeout(() => {
        audioContext.close();
      }, 300);
      
    } catch (error) {
      console.error('Error playing countdown click:', error);
    }
  };
  
  // Start 3-second countdown
  const startCountdown = () => {
    setCountdownActive(true);
    setCountdownValue(3);
    
    // Play first click immediately
    playCountdownClick();
    
    // Countdown timer
    countdownRef.current = setTimeout(() => {
      setCountdownValue(2);
      playCountdownClick();
      
      countdownRef.current = setTimeout(() => {
        setCountdownValue(1);
        playCountdownClick();
        
        countdownRef.current = setTimeout(() => {
          setCountdownValue(0);
          playCountdownClick(true); // Final click (different sound)
          
          // Start recording immediately after final click
          setTimeout(() => {
            setCountdownActive(false);
            startAudioRecording();
          }, 100); // Small delay to let final click play
          
        }, 1000);
      }, 1000);
    }, 1000);
  };
  
  // Stop countdown if user cancels
  const stopCountdown = () => {
    if (countdownRef.current) {
      clearTimeout(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdownActive(false);
    setCountdownValue(3);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">
        Recording & Loop System
      </h3>
      
      {/* Recording Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        {!isRecording ? (
          <button
            onClick={() => {
              startCountdown();
              onStartRecording();
            }}
            disabled={countdownActive}
            className={`bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center space-x-2 ${
              countdownActive ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span>🎤</span>
            <span>{countdownActive ? `Recording in ${countdownValue}...` : 'Start Recording'}</span>
          </button>
        ) : (
          <button
            onClick={handleStopRecording}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center space-x-2"
          >
            <span>⏹</span>
            <span>Stop Recording</span>
          </button>
        )}
        
        <button
          onClick={() => {
            if (audioUrlRef.current) {
              URL.revokeObjectURL(audioUrlRef.current);
              audioUrlRef.current = null;
            }
            onClearRecording();
            setIsAudioReady(false);
            audioBufferRef.current = null;
          }}
          disabled={isRecording || detectedChords.length === 0}
          className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Clear Recording
        </button>

        {/* Recording Status */}
        {countdownActive && (
          <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center justify-center space-x-4">
              <div className="w-4 h-4 bg-purple-500 rounded-full animate-pulse"></div>
              <span className="text-lg font-bold text-purple-800">
                Recording starts in: {countdownValue}
              </span>
              <div className="w-4 h-4 bg-purple-500 rounded-full animate-pulse"></div>
            </div>
            <p className="text-xs text-purple-600 mt-2 text-center">
              Get ready! Click sounds will guide you to the start
            </p>
          </div>
        )}

        {isRecordingAudio && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-blue-800">
                Recording Audio...
              </span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Smart silence detection active - waiting for natural chord decay
            </p>
          </div>
        )}

        {isProcessingAudio && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-yellow-800">
                Processing Audio...
              </span>
            </div>
            <p className="text-xs text-yellow-600 mt-1">
              Trimming silence and optimizing for playback
            </p>
          </div>
        )}
        {/* Audio System Status */}
        {isAudioReady && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-800">
                Audio Ready
              </span>
            </div>
            <p className="text-xs text-green-600 mt-1">
              Using Web Audio API for ultra-low-latency looping
            </p>
          </div>
        )}
      </div>

      {/* Playback Controls */}
      {detectedChords.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <button
              onClick={handlePlayPause}
              disabled={detectedChords.length === 0 || !isAudioReady}
              className={`font-semibold py-2 px-4 rounded-lg transition-colors ${
                isPlaying
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } ${!isAudioReady ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            
            <button
              onClick={handleStop}
              disabled={detectedChords.length === 0}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              ⏹ Stop
            </button>
            
            <button
              onClick={handleLoopToggle}
              disabled={detectedChords.length === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              🔄 Toggle Loop
            </button>
            
            {/* Audio Status */}
            <div className="flex items-center space-x-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${isAudioReady ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-slate-600 dark:text-slate-400">
                {isAudioReady ? 'Audio Ready' : 'No Audio'}
              </span>
            </div>
          </div>

          {/* Current Chord Display */}
          <div className="mb-6">
            <h4 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">
              Current Chord
            </h4>
            <div className="text-3xl font-bold text-slate-800 dark:text-slate-200">
              {currentChord || 'No chord detected'}
            </div>
          </div>

          {/* Chord Timeline Visualization */}
          <div className="mb-6">
            <h4 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-3">
              Chord Timeline
            </h4>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
              {processedChords.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                  No chords recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Chord Sections Bar */}
                  <div className="relative bg-slate-200 dark:bg-slate-600 rounded-lg h-16 overflow-hidden">
                    {processedChords.map((event, index) => {
                      const eventWidth = (event.duration / totalDuration) * 100;
                      const eventLeft = (event.start / totalDuration) * 100;
                      
                      // Determine if this chord section is currently playing
                      const adjustedTime = currentTime + loopStart;
                      const isCurrentlyPlaying = adjustedTime >= event.start && adjustedTime < event.end;
                      
                      return (
                        <div
                          key={index}
                          className={`absolute h-full flex items-center justify-center text-white text-lg font-bold transition-all duration-200 cursor-pointer hover:opacity-80 ${
                            isCurrentlyPlaying ? 'ring-4 ring-white ring-opacity-90 z-10' : ''
                          } ${getChordColor(event.chord)}`}
                          style={{
                            left: `${eventLeft}%`,
                            width: `${eventWidth}%`,
                          }}
                          title={`Click to edit ${event.chord} (${formatTime(event.start)} - ${formatTime(event.end)})`}
                          onClick={() => setEditingChord(event)}
                        >
                          <span className="px-2 text-center truncate">
                            {event.chord}
                          </span>
                        </div>
                      );
                    })}
                    
                    {/* Playback position indicator */}
                    <div 
                      className="absolute w-1 bg-white h-full rounded-full shadow-lg z-10"
                      style={{ 
                        left: `${((currentTime + loopStart) / totalDuration) * 100}%`,
                        transform: 'translateX(-50%)'
                      }}
                    />
                  </div>
                  
                  <div className="text-center mt-2">
                    <button onClick={() => setDetailsVisible(!detailsVisible)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      {detailsVisible ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>

                  {/* Chord Section Details */}
                  {detailsVisible && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                      {processedChords.map((event, index) => {
                        // Determine if this chord section is currently playing
                        const adjustedTime = currentTime + loopStart;
                        const isCurrentlyPlaying = adjustedTime >= event.start && adjustedTime < event.end;
                        
                        return (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:border-blue-400 ${
                              isCurrentlyPlaying
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}
                            onClick={() => setEditingChord(event)}
                          >
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">
                              {event.chord}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                              <div>Duration: {formatTime(event.duration)}</div>
                              <div>Start: {formatTime(event.start)}</div>
                              <div>End: {formatTime(event.end)}</div>
                              {isCurrentlyPlaying && (
                                <div className="text-blue-600 dark:text-blue-400 font-semibold mt-2">
                                  Currently Playing
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recording Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Recording Settings</h4>
              
              {/* Silence Threshold */}
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Silence Sensitivity: {silenceThreshold.toFixed(4)}
                </label>
                <input
                  type="range"
                  min="0.0001"
                  max="0.01"
                  step="0.0001"
                  value={silenceThreshold}
                  onChange={(e) => setSilenceThreshold(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Lower = more sensitive to quiet sounds (guitar decay)
                </p>
              </div>

              {/* Auto-stop Duration */}
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Auto-stop after: {silenceDuration / 1000}s of silence
                </label>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  step="100"
                  value={silenceDuration}
                  onChange={(e) => setSilenceDuration(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  How long to wait for natural chord decay
                </p>
              </div>

              {/* Trim Sensitivity */}
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Trim Sensitivity: {trimSilenceThreshold.toFixed(4)}
                </label>
                <input
                  type="range"
                  min="0.0001"
                  max="0.01"
                  step="0.0001"
                  value={trimSilenceThreshold}
                  onChange={(e) => setTrimSilenceThreshold(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Lower = more aggressive silence trimming
                </p>
              </div>
            </div>

            {/* Playback Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Playback Settings</h4>
              
              {/* Playback Speed */}
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Playback Speed: {playbackSpeed}x
                </label>
                <input
                  type="range"
                  min="0.25"
                  max="2"
                  step="0.25"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Volume Control */}
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Volume: {Math.round(volume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => {
                    const newVolume = parseFloat(e.target.value);
                    setVolume(newVolume);
                  }}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Metronome */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Metronome
                </label>
                <input
                  type="checkbox"
                  checked={metronomeEnabled}
                  onChange={(e) => setMetronomeEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                />
              </div>
              
              {metronomeEnabled && (
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="60"
                    max="200"
                    value={metronomeBPM}
                    onChange={(e) => setMetronomeBPM(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400 min-w-[3rem]">
                    {metronomeBPM} BPM
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {editingChord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setEditingChord(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-200">Override Chord: {editingChord.chord}</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                  Suggestions from this loop
                </h4>
                <div className="flex flex-wrap gap-2">
                  {uniqueChordsInLoop.map(chord => (
                    <button
                      key={chord}
                      onClick={() => handleChordUpdate(chord)}
                      className="px-3 py-1 text-sm rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-900"
                    >
                      {chord}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                  All Chords
                </h4>
                <div className="max-h-60 overflow-y-auto pr-2">
                  <select
                    onChange={(e) => handleChordUpdate(e.target.value)}
                    className="w-full p-2 rounded border border-slate-300 dark:bg-slate-700 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                    value={editingChord.chord}
                  >
                    {allChords.map(chord => (
                      <option key={chord} value={chord}>{chord}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={() => setEditingChord(null)}
              className="mt-6 w-full bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500 font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordingLoopSystem;
