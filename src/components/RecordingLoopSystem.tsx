'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Howl, Howler } from 'howler';

interface ChordEvent {
  chord: string;
  timestamp: number;
  duration: number;
  audioData?: Blob; // Store actual audio data
}

interface RecordingLoopSystemProps {
  isRecording: boolean;
  detectedChords: Array<{ chord: string; timestamp: number }>;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onClearRecording: () => void;
}

const RecordingLoopSystem: React.FC<RecordingLoopSystemProps> = ({
  isRecording,
  detectedChords,
  onStartRecording,
  onStopRecording,
  onClearRecording,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [metronomeBPM, setMetronomeBPM] = useState(120);
  const [volume, setVolume] = useState(1);
  
  // Audio recording state
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
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
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [howlInstance, setHowlInstance] = useState<Howl | null>(null);
  
  // Ultra-low-latency audio playback state
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioSource, setAudioSource] = useState<AudioBufferSourceNode | null>(null);
  const [isUsingWebAudio, setIsUsingWebAudio] = useState(false);
  
  // Web Audio pause/resume state
  const [isPaused, setIsPaused] = useState(false);
  const [pauseTime, setPauseTime] = useState(0);
  const audioStartTimeRef = useRef<number>(0);
  
  // True gapless audio system for zero-latency looping
  const [audioSources, setAudioSources] = useState<AudioBufferSourceNode[]>([]);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [isGaplessActive, setIsGaplessActive] = useState(false);
  
  // ULTIMATE NUCLEAR OPTION: Pre-buffered circular audio system
  const [circularBuffer, setCircularBuffer] = useState<AudioBuffer | null>(null);
  const [isCircularActive, setIsCircularActive] = useState(false);
  const [circularSource, setCircularSource] = useState<AudioBufferSourceNode | null>(null);
  const createGaplessBuffer = () => {
    if (!audioBuffer || !audioContext) return null;
    
    try {
      const loopStartSeconds = loopStart / 1000;
      const loopEndSeconds = loopEnd / 1000;
      const loopDuration = loopEndSeconds - loopStartSeconds;
      
      // Create a buffer that's 3x the loop duration for seamless looping
      const totalDuration = loopDuration * 3;
      const sampleRate = audioBuffer.sampleRate;
      const totalSamples = Math.floor(totalDuration * sampleRate);
      
      // Create new buffer
      const gaplessBuffer = audioContext.createBuffer(1, totalSamples, sampleRate);
      const originalData = audioBuffer.getChannelData(0);
      const newData = gaplessBuffer.getChannelData(0);
      
      // Fill the buffer with 3 copies of the loop section
      for (let i = 0; i < 3; i++) {
        const startSample = Math.floor(loopStartSeconds * sampleRate);
        const endSample = Math.floor(loopEndSeconds * sampleRate);
        const loopSamples = endSample - startSample;
        const targetStart = i * loopSamples;
        
        for (let j = 0; j < loopSamples; j++) {
          if (startSample + j < originalData.length) {
            newData[targetStart + j] = originalData[startSample + j];
          }
        }
      }
      
      console.log('Created gapless buffer:', {
        originalDuration: audioBuffer.duration,
        loopDuration,
        totalDuration,
        totalSamples
      });
      
      return gaplessBuffer;
    } catch (error) {
      console.error('Error creating gapless buffer:', error);
      return null;
    }
  };
  
  // Start true gapless looping
  const startGaplessLoop = () => {
    if (!audioBuffer || !audioContext || !isPlaying) return;
    
    try {
      // Stop any existing sources
      if (audioSources.length > 0) {
        audioSources.forEach(source => {
          try {
            source.stop();
          } catch (e) {
            // Source might already be stopped
          }
        });
        setAudioSources([]);
      }
      
      // Create gapless buffer
      const gaplessBuffer = createGaplessBuffer();
      if (!gaplessBuffer) {
        console.warn('Failed to create gapless buffer, falling back to regular');
        startWebAudioLoop();
        return;
      }
      
      // Create 3 pre-allocated sources
      const sources: AudioBufferSourceNode[] = [];
      const loopStartSeconds = loopStart / 1000;
      const loopEndSeconds = loopEnd / 1000;
      const loopDuration = loopEndSeconds - loopStartSeconds;
      
      for (let i = 0; i < 3; i++) {
        const source = audioContext.createBufferSource();
        source.buffer = gaplessBuffer;
        source.connect(audioContext.destination);
        sources.push(source);
      }
      
      setAudioSources(sources);
      setCurrentSourceIndex(0);
      setIsGaplessActive(true);
      
      // Start first source
      const now = audioContext.currentTime;
      sources[0].start(now, 0, loopDuration);
      
      // Schedule next sources to start exactly when previous ends
      for (let i = 1; i < sources.length; i++) {
        const startTime = now + (i * loopDuration);
        sources[i].start(startTime, 0, loopDuration);
      }
      
      // Set up the chain for infinite looping
      sources.forEach((source, index) => {
        source.onended = () => {
          if (isPlaying && isGaplessActive) {
            // Immediately start the next iteration
            const nextIndex = (index + 1) % sources.length;
            const nextSource = sources[nextIndex];
            const nextStartTime = audioContext.currentTime;
            
            // Restart this source immediately
            nextSource.start(nextStartTime, 0, loopDuration);
            
            // Update current source index
            setCurrentSourceIndex(nextIndex);
          }
        };
      });
      
      console.log('True gapless loop started with zero latency');
      
    } catch (error) {
      console.error('Error starting gapless loop:', error);
      setIsGaplessActive(false);
      // Fallback to regular Web Audio
      startWebAudioLoop();
    }
  };
  
  // Simple and reliable zero-latency Web Audio API looping
  const startWebAudioLoop = () => {
    if (!audioBuffer || !audioContext || !isPlaying) return;
    
    try {
      // Stop any existing source
      if (audioSource) {
        audioSource.stop();
        audioSource.disconnect();
      }
      
      // Create new source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Calculate loop parameters
      const loopStartSeconds = loopStart / 1000;
      const loopEndSeconds = loopEnd / 1000;
      const loopDuration = loopEndSeconds - loopStartSeconds;
      
      // Enable native looping for zero latency
      source.loop = true;
      source.loopStart = loopStartSeconds;
      source.loopEnd = loopEndSeconds;
      
      // Connect to output
      source.connect(audioContext.destination);
      
      // Start playing immediately
      source.start();
      
      // Store reference
      setAudioSource(source);
      audioStartTimeRef.current = audioContext.currentTime; // Initialize start time
      
      console.log('Web Audio loop started with native looping:', {
        loopStartSeconds,
        loopEndSeconds,
        loopDuration
      });
      
    } catch (error) {
      console.error('Error starting Web Audio loop:', error);
      // Fallback to Howler.js
      setIsUsingWebAudio(false);
    }
  };
  
  // Stop Web Audio loop
  const stopWebAudioLoop = () => {
    if (audioSource) {
      audioSource.stop();
      audioSource.disconnect();
      setAudioSource(null);
      audioStartTimeRef.current = 0; // Reset start time
    }
  };

  // Pause Web Audio loop
  const pauseWebAudioLoop = () => {
    if (audioSource && isPlaying) {
      try {
        // Calculate current position using our stored start time
        const currentTime = audioContext!.currentTime;
        const elapsed = currentTime - audioStartTimeRef.current;
        const loopStartSeconds = loopStart / 1000;
        const loopEndSeconds = loopEnd / 1000;
        const loopDuration = loopEndSeconds - loopStartSeconds;
        
        // Calculate position within the loop
        const positionInLoop = (elapsed % loopDuration) + loopStartSeconds;
        setPauseTime(positionInLoop);
        
        // Stop the source
        audioSource.stop();
        audioSource.disconnect();
        setAudioSource(null);
        setIsPaused(true);
        
        console.log('Web Audio loop paused at:', positionInLoop);
      } catch (error) {
        console.error('Error pausing Web Audio loop:', error);
      }
    }
  };
  
  // Resume Web Audio loop
  const resumeWebAudioLoop = () => {
    if (isPaused && audioBuffer && audioContext && isPlaying) {
      try {
        // Create new source
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        // Calculate loop parameters
        const loopStartSeconds = loopStart / 1000;
        const loopEndSeconds = loopEnd / 1000;
        const loopDuration = loopEndSeconds - loopStartSeconds;
        
        // Enable native looping for zero latency
        source.loop = true;
        source.loopStart = loopStartSeconds;
        source.loopEnd = loopEndSeconds;
        
        // Connect to output
        source.connect(audioContext.destination);
        
        // Start from where we paused
        const startTime = audioContext.currentTime;
        source.start(startTime, pauseTime, loopDuration);
        
        // Store reference
        setAudioSource(source);
        setIsPaused(false);
        
        console.log('Web Audio loop resumed from:', pauseTime);
      } catch (error) {
        console.error('Error resuming Web Audio loop:', error);
      }
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      // Pause audio playback
      if (isUsingWebAudio) {
        pauseWebAudioLoop();
      } else if (howlInstance) {
        howlInstance.pause();
      }
    } else {
      setIsPlaying(true);
      // Resume audio playback
      if (isUsingWebAudio && isPaused) {
        resumeWebAudioLoop();
      }
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setIsPaused(false); // Reset pause state
    
    // Stop all audio systems
    if (isUsingWebAudio) {
      // Stop regular source
      stopWebAudioLoop();
    }
    if (howlInstance) {
      howlInstance.stop();
    }
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

  const getCurrentChord = () => {
    if (detectedChords.length === 0) return null;
    
    const adjustedTime = currentTime + loopStart;
    const chord = detectedChords.find((event, index) => {
      const nextEvent = detectedChords[index + 1];
      // Ensure each chord has at least 1 second duration, or until next chord
      const eventStart = getRelativeTimestamp(event.timestamp);
      const eventEnd = nextEvent ? getRelativeTimestamp(nextEvent.timestamp) : eventStart + 1000;
      return adjustedTime >= eventStart && adjustedTime < eventEnd;
    });
    
    return chord?.chord || null;
  };

  // Helper function to get relative timestamp
  const getRelativeTimestamp = (timestamp: number) => {
    if (detectedChords.length === 0) return 0;
    return timestamp - Math.min(...detectedChords.map(e => e.timestamp));
  };

  // Calculate total duration of the recording
  const totalDuration = detectedChords.length > 0 
    ? (Math.max(...detectedChords.map(event => event.timestamp)) - Math.min(...detectedChords.map(event => event.timestamp))) + 2000 // Add 2 seconds buffer
    : 0;

  const currentChord = getCurrentChord();

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
      if (isUsingWebAudio) {
        // Stop circular source
        if (circularSource) {
          circularSource.stop();
          circularSource.disconnect();
        }
        
        // Stop gapless sources
        if (audioSources.length > 0) {
          audioSources.forEach(source => {
            try {
              source.stop();
            } catch (e) {
              // Source might already be stopped
            }
          });
          setAudioSources([]);
        }
        
        // Stop regular source
        stopWebAudioLoop();
      }
      
      // Stop Howler.js if active
      if (howlInstance) {
        howlInstance.stop();
      }
      return;
    }

    const animate = (currentTimeMs: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTimeMs;
      }

      const elapsed = (currentTimeMs - startTimeRef.current) * playbackSpeed;
      const newTime = (loopStart + elapsed) % (loopEnd - loopStart);

      setCurrentTime(newTime);

      if (isPlaying) {
        playbackRef.current = requestAnimationFrame(animate);
      }
    };

    startTimeRef.current = 0;
    playbackRef.current = requestAnimationFrame(animate);

    // Start audio playback with ultra-low-latency Web Audio API
    if (isUsingWebAudio && audioBuffer && audioContext) {
      console.log('Using Web Audio API for ultra-low-latency looping');
      
      // Try circular looping first for TRUE zero latency
      if (!isCircularActive) {
        startCircularLoop();
      } else if (!isGaplessActive) {
        startGaplessLoop();
      } else {
        startWebAudioLoop();
      }
    } else if (howlInstance) {
      // Fallback to Howler.js
      console.log('Using Howler.js for audio playback');
      
      const loopDuration = (loopEnd - loopStart) / 1000; // Convert to seconds
      const loopStartSeconds = loopStart / 1000;
      
      console.log('Audio playback:', {
        loopStart,
        loopEnd,
        loopStartSeconds,
        loopDuration,
        totalDuration,
        howlInstanceDuration: howlInstance.duration()
      });
      
      // INSTANT LOOPING: Use Howler's built-in looping with custom boundaries
      howlInstance.loop(true);
      
      // Pre-buffer the audio for instant restart
      howlInstance.on('load', () => {
        console.log('Audio pre-buffered for instant looping');
      });
      
      // Start playing from the loop start position
      howlInstance.seek(loopStartSeconds);
      howlInstance.play();
      
      // Monitor playback position for instant loop boundaries
      const checkLoopPosition = () => {
        if (!isPlaying || !howlInstance) return;
        
        const currentPosition = howlInstance.seek();
        const loopEndSeconds = loopEnd / 1000;
        
        // INSTANT LOOP: Jump back immediately when reaching loop end
        if (currentPosition >= loopEndSeconds) {
          howlInstance.seek(loopStartSeconds);
          // Force immediate restart with no delay
          howlInstance.stop();
          howlInstance.play();
        }
        
        // Continue monitoring at maximum frequency for instant response
        if (isPlaying) {
          requestAnimationFrame(checkLoopPosition);
        }
      };
      
      // Start high-frequency monitoring for instant loop detection
      requestAnimationFrame(checkLoopPosition);
    }

    return () => {
      if (playbackRef.current) {
        cancelAnimationFrame(playbackRef.current);
      }
      
      // Stop Web Audio loop if active
      if (isUsingWebAudio) {
        // Stop circular source
        if (circularSource) {
          circularSource.stop();
          circularSource.disconnect();
        }
        
        // Stop gapless sources
        if (audioSources.length > 0) {
          audioSources.forEach(source => {
            try {
              source.stop();
            } catch (e) {
              // Source might already be stopped
            }
          });
          setAudioSources([]);
        }
        
        // Stop regular source
        stopWebAudioLoop();
      }
      
      // Stop Howler.js if active
      if (howlInstance) {
        howlInstance.stop();
      }
    };
  }, [isPlaying, loopStart, loopEnd, playbackSpeed, howlInstance, isUsingWebAudio, audioBuffer, audioContext, isGaplessActive]);

  const startAudioRecording = async () => {
    try {
      setIsRecordingAudio(true);
      setRecordingStartTime(Date.now());
      
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
      let lastSoundLevel = 0;
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
            lastSoundLevel = currentLevel;
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
        
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        setAudioChunks(chunks);
        
        // Trim silence from the recorded audio
        console.log('Trimming silence from recorded audio...');
        setIsProcessingAudio(true);
        
        try {
          const trimmedBlob = await trimAudioSilence(audioBlob);
          
          // Create object URL for Howler.js
          const audioUrl = URL.createObjectURL(trimmedBlob);
          audioUrlRef.current = audioUrl;
          
          // Create Howl instance with trimmed audio
          const howl = new Howl({
            src: [audioUrl],
            format: ['wav'], // Now using WAV format
            html5: false,
            preload: true,
            onload: () => {
              console.log('Howl audio loaded successfully');
              setHowlInstance(howl);
              setIsProcessingAudio(false);
            },
            onloaderror: (id, error) => {
              console.error('Howl audio load error:', error);
              setIsProcessingAudio(false);
            }
          });
          
          // Also create AudioBuffer for Web Audio API (ultra-low-latency)
          try {
            const webAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const arrayBuffer = await trimmedBlob.arrayBuffer();
            const buffer = await webAudioContext.decodeAudioData(arrayBuffer);
            
            setAudioBuffer(buffer);
            setAudioContext(webAudioContext);
            setIsUsingWebAudio(true);
            
            console.log('Web Audio API buffer created for ultra-low-latency looping');
          } catch (webAudioError) {
            console.warn('Web Audio API not available, falling back to Howler.js:', webAudioError);
            setIsUsingWebAudio(false);
          }
          
        } catch (error) {
          console.error('Error trimming audio:', error);
          setIsProcessingAudio(false);
        }
        
        // Cleanup audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        if (analyserRef.current) {
          analyserRef.current = null;
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      console.log('Audio recording started with smart silence detection');
      
    } catch (error) {
      console.error('Error starting audio recording:', error);
      setIsRecordingAudio(false);
      setRecordingStartTime(null);
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
      setRecordedAudio(null);
      setHowlInstance(null);
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      
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

  // Create a true circular buffer that repeats the loop section seamlessly
  const createCircularBuffer = () => {
    if (!audioBuffer || !audioContext) return null;
    
    try {
      const loopStartSeconds = loopStart / 1000;
      const loopEndSeconds = loopEnd / 1000;
      const loopDuration = loopEndSeconds - loopStartSeconds;
      
      // Create a buffer that's exactly 2x the loop duration for perfect circular playback
      const totalDuration = loopDuration * 2;
      const sampleRate = audioBuffer.sampleRate;
      const totalSamples = Math.floor(totalDuration * sampleRate);
      
      // Create new buffer
      const circularBuffer = audioContext.createBuffer(1, totalSamples, sampleRate);
      const originalData = audioBuffer.getChannelData(0);
      const newData = circularBuffer.getChannelData(0);
      
      // Fill the buffer with 2 copies of the loop section
      for (let i = 0; i < 2; i++) {
        const startSample = Math.floor(loopStartSeconds * sampleRate);
        const endSample = Math.floor(loopEndSeconds * sampleRate);
        const loopSamples = endSample - startSample;
        const targetStart = i * loopSamples;
        
        for (let j = 0; j < loopSamples; j++) {
          if (startSample + j < originalData.length) {
            newData[targetStart + j] = originalData[startSample + j];
          }
        }
      }
      
      console.log('Created circular buffer:', {
        originalDuration: audioBuffer.duration,
        loopDuration,
        totalDuration,
        totalSamples
      });
      
      return circularBuffer;
    } catch (error) {
      console.error('Error creating circular buffer:', error);
      return null;
    }
  };
  
  // Start ULTIMATE circular looping with zero latency
  const startCircularLoop = () => {
    if (!audioBuffer || !audioContext || !isPlaying) return;
    
    try {
      // Stop any existing sources
      if (circularSource) {
        circularSource.stop();
        circularSource.disconnect();
      }
      if (audioSources.length > 0) {
        audioSources.forEach(source => {
          try {
            source.stop();
          } catch (e) {
            // Source might already be stopped
          }
        });
        setAudioSources([]);
      }
      
      // Create circular buffer
      const circularBuffer = createCircularBuffer();
      if (!circularBuffer) {
        console.warn('Failed to create circular buffer, falling back to regular');
        startWebAudioLoop();
        return;
      }
      
      // Create a single source that plays the circular buffer
      const source = audioContext.createBufferSource();
      source.buffer = circularBuffer;
      source.connect(audioContext.destination);
      
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
      setCircularSource(source);
      setCircularBuffer(circularBuffer);
      setIsCircularActive(true);
      
      console.log('ULTIMATE circular loop started with zero latency');
      
    } catch (error) {
      console.error('Error starting circular loop:', error);
      setIsCircularActive(false);
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
            setRecordedAudio(null);
            setAudioChunks([]);
            setIsProcessingAudio(false);
            if (audioUrlRef.current) {
              URL.revokeObjectURL(audioUrlRef.current);
              audioUrlRef.current = null;
            }
            if (howlInstance) {
              howlInstance.stop();
              howlInstance.unload();
              setHowlInstance(null);
            }
            onClearRecording();
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
        {howlInstance && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-800">
                Audio Ready
              </span>
            </div>
            <p className="text-xs text-green-600 mt-1">
              {isUsingWebAudio 
                ? 'Using Web Audio API for ultra-low-latency looping'
                : 'Using Howler.js for audio playback'
              }
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
              disabled={detectedChords.length === 0 || !howlInstance}
              className={`font-semibold py-2 px-4 rounded-lg transition-colors ${
                isPlaying
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } ${!howlInstance ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              <span className={`w-2 h-2 rounded-full ${howlInstance ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-slate-600 dark:text-slate-400">
                {howlInstance ? 'Audio Ready' : 'No Audio'}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
              <span>Current: {formatTime(currentTime)}</span>
              <span>Total: {formatTime(totalDuration)}</span>
            </div>
            
            <div className="relative bg-slate-200 dark:bg-slate-700 rounded-lg h-6">
              {/* Chord section backgrounds */}
              {detectedChords.map((event, index) => {
                const nextEvent = detectedChords[index + 1];
                const eventStart = event.timestamp - Math.min(...detectedChords.map(e => e.timestamp));
                const eventEnd = nextEvent ? nextEvent.timestamp - Math.min(...detectedChords.map(e => e.timestamp)) : eventStart + 1000;
                const eventWidth = (eventEnd - eventStart) / totalDuration * 100;
                const eventLeft = eventStart / totalDuration * 100;
                
                // Get chord color based on chord type
                const getChordColor = (chord: string) => {
                  if (chord.includes('7')) return 'bg-blue-400';
                  if (chord.includes('m')) return 'bg-green-400';
                  if (chord.includes('dim')) return 'bg-red-400';
                  if (chord.includes('aug')) return 'bg-yellow-400';
                  return 'bg-purple-400';
                };
                
                return (
                  <div
                    key={`bg-${index}`}
                    className={`absolute h-full ${getChordColor(event.chord)} opacity-30`}
                    style={{
                      left: `${eventLeft}%`,
                      width: `${eventWidth}%`,
                    }}
                  />
                );
              })}
              
              {/* Loop region */}
              {loopStart > 0 || loopEnd < totalDuration ? (
                <div 
                  className="absolute bg-purple-400 h-full rounded-lg opacity-60"
                  style={{ 
                    left: `${(loopStart / totalDuration) * 100}%`,
                    width: `${((loopEnd - loopStart) / totalDuration) * 100}%`
                  }}
                />
              ) : null}
              
              {/* Chord markers */}
              {detectedChords.map((event, index) => (
                <div
                  key={index}
                  className="absolute w-2 h-6 bg-green-500 rounded-full -mt-1"
                  style={{ 
                    left: `${((event.timestamp - Math.min(...detectedChords.map(e => e.timestamp))) / totalDuration) * 100}%`,
                    transform: 'translateX(-50%)'
                  }}
                  title={`${event.chord} at ${formatTime(event.timestamp - Math.min(...detectedChords.map(e => e.timestamp)))}`}
                />
              ))}
              
              {/* Progress bar */}
              <div 
                className="absolute bg-blue-500 h-full rounded-lg transition-all duration-100"
                style={{ 
                  left: `${(currentTime / totalDuration) * 100}%`,
                  width: '4px'
                }}
              />
            </div>
            
            {/* Chord labels below timeline */}
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mt-2">
              {detectedChords.map((event, index) => {
                const nextEvent = detectedChords[index + 1];
                const eventStart = event.timestamp - Math.min(...detectedChords.map(e => e.timestamp));
                const eventEnd = nextEvent ? nextEvent.timestamp - Math.min(...detectedChords.map(e => e.timestamp)) : eventStart + 1000;
                const eventCenter = (eventStart + eventEnd) / 2;
                const eventLeft = (eventCenter / totalDuration) * 100;
                
                return (
                  <div
                    key={index}
                    className="absolute text-center"
                    style={{
                      left: `${eventLeft}%`,
                      transform: 'translateX(-50%)',
                      minWidth: '3rem'
                    }}
                  >
                    <div className="font-semibold">{event.chord}</div>
                    <div className="text-xs opacity-75">
                      {formatTime(eventEnd - eventStart)}
                    </div>
                  </div>
                );
              })}
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
              {detectedChords.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                  No chords recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Chord Sections Bar */}
                  <div className="relative bg-slate-200 dark:bg-slate-600 rounded-lg h-8 overflow-hidden">
                    {detectedChords.map((event, index) => {
                      const nextEvent = detectedChords[index + 1];
                      const eventStart = event.timestamp - Math.min(...detectedChords.map(e => e.timestamp));
                      // Ensure each chord has at least 1 second duration
                      const eventEnd = nextEvent ? nextEvent.timestamp - Math.min(...detectedChords.map(e => e.timestamp)) : eventStart + 1000;
                      const eventDuration = eventEnd - eventStart;
                      const eventWidth = (eventDuration / totalDuration) * 100;
                      const eventLeft = (eventStart / totalDuration) * 100;
                      
                      // Determine if this chord section is currently playing
                      const adjustedTime = currentTime + loopStart;
                      const isCurrentlyPlaying = adjustedTime >= eventStart && adjustedTime < eventEnd;
                      
                      // Get chord color based on chord type
                      const getChordColor = (chord: string) => {
                        if (chord.includes('7')) return 'bg-blue-500';
                        if (chord.includes('m')) return 'bg-green-500';
                        if (chord.includes('dim')) return 'bg-red-500';
                        if (chord.includes('aug')) return 'bg-yellow-500';
                        return 'bg-purple-500';
                      };
                      
                      return (
                        <div
                          key={index}
                          className={`absolute h-full flex items-center justify-center text-white text-xs font-bold transition-all duration-200 ${
                            isCurrentlyPlaying ? 'ring-2 ring-white ring-opacity-80' : ''
                          } ${getChordColor(event.chord)}`}
                          style={{
                            left: `${eventLeft}%`,
                            width: `${eventWidth}%`,
                          }}
                          title={`${event.chord} (${formatTime(eventStart)} - ${formatTime(eventEnd)})`}
                        >
                          <span className="px-1 text-center truncate">
                            {event.chord}
                          </span>
                        </div>
                      );
                    })}
                    
                    {/* Playback position indicator */}
                    <div 
                      className="absolute w-1 bg-white h-full rounded-full shadow-lg z-10 transition-all duration-100"
                      style={{ 
                        left: `${(currentTime / totalDuration) * 100}%`,
                        transform: 'translateX(-50%)'
                      }}
                    />
                  </div>
                  
                  {/* Chord Section Details */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {detectedChords.map((event, index) => {
                      const nextEvent = detectedChords[index + 1];
                      const eventStart = event.timestamp - Math.min(...detectedChords.map(e => e.timestamp));
                      const eventEnd = nextEvent ? nextEvent.timestamp - Math.min(...detectedChords.map(e => e.timestamp)) : eventStart + 1000;
                      const eventDuration = eventEnd - eventStart;
                      
                      // Determine if this chord section is currently playing
                      const adjustedTime = currentTime + loopStart;
                      const isCurrentlyPlaying = adjustedTime >= eventStart && adjustedTime < eventEnd;
                      
                      return (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                            isCurrentlyPlaying
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800'
                          }`}
                        >
                          <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">
                            {event.chord}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                            <div>Duration: {formatTime(eventDuration)}</div>
                            <div>Start: {formatTime(eventStart)}</div>
                            <div>End: {formatTime(eventEnd)}</div>
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
                    if (howlInstance) {
                      howlInstance.volume(newVolume);
                    }
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

          {/* Chord Progression List */}
          <div className="mt-6">
            <h4 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-3">
              Recorded Progression
            </h4>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
              {detectedChords.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                  No chords recorded yet. Start recording to capture your progression.
                </p>
              ) : (
                <div className="space-y-2">
                  {detectedChords.map((event, index) => (
                    <div
                      key={index}
                      className={`flex justify-between items-center p-2 rounded ${
                        currentChord === event.chord && isPlaying
                          ? 'bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700'
                          : 'bg-white dark:bg-slate-800'
                      }`}
                    >
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {event.chord}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RecordingLoopSystem;
