'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PlaybackControls } from './PlaybackControls';
import ChordProgression from './ChordProgression';

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
  const [loopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(0);
  const [adjustedChords, setAdjustedChords] = useState<Array<{ chord: string; timestamp: number }>>([]);
  const [timingAdjustments, setTimingAdjustments] = useState<Map<number, number>>(new Map());

  // Audio recording state
  const [, setIsRecordingAudio] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Silence detection settings
  const [trimSilenceThreshold] = useState(0.0005);

  const startTimeRef = useRef<number>(0);
  const audioUrlRef = useRef<string | null>(null);

  // --- REDESIGNED AUDIO STATE for drift-free looping ---
  const [isAudioReady, setIsAudioReady] = useState(false);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioStartTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const scheduleNextLoopRef = useRef<NodeJS.Timeout | null>(null);
  // --- End of redesigned state ---

  const lastEmittedPlaybackChordRef = useRef<string | null>(null);
  const MIN_SECTION_DURATION = 0.5;

  const buildSegments = useCallback((
    chords: Array<{ chord: string; timestamp: number }>,
    duration: number
  ): Array<{ chord: string; start: number; end: number }> => {
    if (chords.length === 0) return [];

    const sorted = [...chords].sort((a, b) => a.timestamp - b.timestamp);
    const startTimestamp = sorted[0].timestamp;
    const normalized = sorted.map(c => ({
      chord: c.chord,
      timestamp: (c.timestamp - startTimestamp) / 1000
    }));

    const segments: Array<{ chord: string; start: number; end: number }> = [];

    normalized.forEach((entry, idx) => {
      const prev = segments[segments.length - 1];
      if (prev && prev.chord === entry.chord) {
        // extend continuous identical chord
        prev.end = entry.timestamp;
      } else {
        segments.push({ chord: entry.chord, start: entry.timestamp, end: entry.timestamp });
      }

      const next = normalized[idx + 1];
      if (next) {
        segments[segments.length - 1].end = next.timestamp;
      }
    });

    if (segments.length > 0) {
      const total = duration > 0 ? duration : (segments[segments.length - 1].end + 2);
      segments[segments.length - 1].end = total;
    }

    return segments.map(seg => ({
      ...seg,
      end: Math.max(seg.end, seg.start + MIN_SECTION_DURATION)
    }));
  }, []);

  const applyTimingAdjustments = useCallback((
    segments: Array<{ chord: string; start: number; end: number }>,
    adjustments: Map<number, number>,
    duration: number
  ) => {
    if (segments.length === 0) return [];

    const adjusted = segments.map(seg => ({ ...seg }));
    const orderedAdjustments = Array.from(adjustments.entries()).sort((a, b) => a[0] - b[0]);

    orderedAdjustments.forEach(([boundaryIndex, newStartTime]) => {
      if (boundaryIndex < 0 || boundaryIndex >= adjusted.length - 1) return;

      const prev = adjusted[boundaryIndex];
      const next = adjusted[boundaryIndex + 1];
      const nextNext = adjusted[boundaryIndex + 2];

      const minStart = prev.start + MIN_SECTION_DURATION;
      const maxStart = nextNext ? nextNext.start - MIN_SECTION_DURATION : (duration > 0 ? duration - MIN_SECTION_DURATION : Infinity);
      const targetStart = Math.min(Math.max(newStartTime, minStart), maxStart);
      const delta = targetStart - next.start;

      if (delta !== 0) {
        for (let i = boundaryIndex + 1; i < adjusted.length; i++) {
          adjusted[i].start += delta;
          adjusted[i].end += delta;
        }
      }

      prev.end = targetStart;
      next.start = targetStart;
    });

    // Ensure final end does not exceed total duration
    if (duration > 0) {
      const overflow = adjusted[adjusted.length - 1].end - duration;
      if (overflow > 0) {
        adjusted[adjusted.length - 1].end = duration;
      }
    }

    return adjusted;
  }, []);

  // Keep a derived, normalized chord timeline that we can retime without touching detection state
  useEffect(() => {
    const duration = loopEnd > 0 ? loopEnd / 1000 : 0;
    const segments = buildSegments(detectedChords, duration);
    const adjustedSegments = applyTimingAdjustments(segments, timingAdjustments, duration);
    const flattened = adjustedSegments.map(seg => ({
      chord: seg.chord,
      timestamp: seg.start
    }));
    setAdjustedChords(flattened);
  }, [buildSegments, applyTimingAdjustments, detectedChords, timingAdjustments, loopEnd]);

  useEffect(() => {
    if (detectedChords.length === 0) {
      setTimingAdjustments(new Map());
      setAdjustedChords([]);
    }
  }, [detectedChords.length]);

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

    const playLoop = (offset: number) => {
      if (!audioContextRef.current) return;

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      // Calculate start time in audio context time
      const contextStartTime = audioContext.currentTime;
      audioStartTimeRef.current = contextStartTime - offset;

      source.start(contextStartTime, offset);
      audioSourceNodeRef.current = source;

      // Schedule next loop
      const timeRemaining = loopDuration - offset;
      scheduleNextLoopRef.current = setTimeout(() => {
        playLoop(0); // Start from beginning for next loop
      }, timeRemaining * 1000);
    };

    playLoop(startTime);
  }, [loopStart, loopEnd, stopWebAudioLoop]);

  // --- END: DRIFT-FREE LOOPING LOGIC ---

  // Initialize Audio Context
  useEffect(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return () => {
      stopWebAudioLoop();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopWebAudioLoop]);

  // Handle recording start
  const handleStartRecording = async () => {
    if (!audioContextRef.current) return;

    // Resume context if suspended
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;

        setIsProcessingAudio(true);

        // Process audio for looping
        const arrayBuffer = await blob.arrayBuffer();
        if (audioContextRef.current) {
          const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

          // Trim silence
          const trimmedBuffer = trimSilence(audioBuffer);
          audioBufferRef.current = trimmedBuffer;

          setLoopEnd(trimmedBuffer.duration * 1000);
          setIsAudioReady(true);
        }

        setIsProcessingAudio(false);
        setIsRecordingAudio(false);

        stream.getTracks().forEach(track => track.stop()); // Stop microphone stream
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecordingAudio(true);
      startTimeRef.current = Date.now();

      // Start external recording logic (chord detection)
      onStartRecording();

    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      onStopRecording();
    }
  };

  const trimSilence = (buffer: AudioBuffer) => {
    const data = buffer.getChannelData(0);
    let start = 0;
    let end = data.length;

    // Find start
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > trimSilenceThreshold) {
        start = i;
        break;
      }
    }

    // Find end
    for (let i = data.length - 1; i >= 0; i--) {
      if (Math.abs(data[i]) > trimSilenceThreshold) {
        end = i + 1;
        break;
      }
    }

    // Add some padding
    const padding = Math.floor(buffer.sampleRate * 0.1); // 100ms padding
    start = Math.max(0, start - padding);
    end = Math.min(data.length, end + padding);

    const length = end - start;
    if (length <= 0) return buffer; // Return original if invalid

    const newBuffer = audioContextRef.current!.createBuffer(
      buffer.numberOfChannels,
      length,
      buffer.sampleRate
    );

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      const channelData = buffer.getChannelData(i);
      newBuffer.copyToChannel(channelData.slice(start, end), i);
    }

    return newBuffer;
  };

  const handlePlayPause = () => {
    if (!isAudioReady) return;

    if (isPlaying) {
      // Pause
      stopWebAudioLoop();
      // Calculate pause position
      if (audioContextRef.current) {
        const elapsed = audioContextRef.current.currentTime - audioStartTimeRef.current;
        const duration = (loopEnd - loopStart) / 1000;
        pauseTimeRef.current = elapsed % duration;
      }
      setIsPlaying(false);
      onPlaybackChordChange(null);
    } else {
      // Play
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      startWebAudioLoop(pauseTimeRef.current);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    stopWebAudioLoop();
    pauseTimeRef.current = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    onPlaybackChordChange(null);
  };

  const handleReset = () => {
    handleStop();
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    audioBufferRef.current = null;
    setIsAudioReady(false);
    onClearRecording();
  };

  const handleTimingAdjust = useCallback((boundaryIndex: number, newBoundaryTime: number) => {
    setTimingAdjustments(prev => {
      const next = new Map(prev);
      next.set(boundaryIndex, newBoundaryTime);
      return next;
    });
  }, []);

  const handleChordUpdate = useCallback((relativeTimestamp: number, newChord: string) => {
    if (detectedChords.length === 0) return;

    const sorted = [...detectedChords].sort((a, b) => a.timestamp - b.timestamp);
    const startTimestamp = sorted[0].timestamp;

    let closestEvent = sorted[0];
    let closestDistance = Math.abs(((sorted[0].timestamp - startTimestamp) / 1000) - relativeTimestamp);

    sorted.forEach(event => {
      const relativeTime = (event.timestamp - startTimestamp) / 1000;
      const distance = Math.abs(relativeTime - relativeTimestamp);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestEvent = event;
      }
    });

    onUpdateChord(closestEvent.timestamp, newChord);
  }, [detectedChords, onUpdateChord]);

  // Update current time and chord during playback
  useEffect(() => {
    let animationFrame: number;

    const update = () => {
      if (isPlaying && audioContextRef.current && audioStartTimeRef.current > 0) {
        const elapsed = audioContextRef.current.currentTime - audioStartTimeRef.current;
        const duration = (loopEnd - loopStart) / 1000;

        if (duration > 0) {
          const currentLoopTime = elapsed % duration;
          setCurrentTime(currentLoopTime); // Keep in seconds for ChordProgression

          // Better chord finding logic
          if (adjustedChords.length > 0) {
            const relativeChords = adjustedChords;

            // Find chord that starts before current time and ends after (or is the last one before current time)
            let activeChord = null;
            for (let i = 0; i < relativeChords.length; i++) {
              if (relativeChords[i].timestamp <= currentLoopTime) {
                activeChord = relativeChords[i];
              } else {
                break;
              }
            }

            if (activeChord && activeChord.chord !== lastEmittedPlaybackChordRef.current) {
              lastEmittedPlaybackChordRef.current = activeChord.chord;
              onPlaybackChordChange(activeChord.chord);
            } else if (!activeChord && lastEmittedPlaybackChordRef.current !== null) {
              // If no active chord (e.g., before first chord starts)
              lastEmittedPlaybackChordRef.current = null;
              onPlaybackChordChange(null);
            }
          }
        }

        animationFrame = requestAnimationFrame(update);
      }
    };

    if (isPlaying) {
      update();
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, loopEnd, loopStart, adjustedChords, onPlaybackChordChange]);

  // Calculate total duration in seconds
  const totalDuration = loopEnd > 0 ? loopEnd / 1000 : 0;

  // Normalize chords for display (relative to start time)
  const displayChords = useMemo(() => {
    return adjustedChords;
  }, [adjustedChords]);

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-3xl p-8 shadow-2xl shadow-green-900/20 border-2 border-white">
      {/* Playback Controls at Top */}
      <PlaybackControls
        isRecording={isRecording}
        isPlaying={isPlaying}
        hasRecording={detectedChords.length > 0}
        onRecord={isRecording ? handleStopRecording : handleStartRecording}
        onPlay={handlePlayPause}
        onStop={handleStop}
        onReset={handleReset}
      />

      {isRecording && (
        <div className="mt-6 text-center">
          <span className="text-green-700 text-sm bg-green-50 py-2 px-4 rounded-full inline-block animate-pulse">
            Recording... Play your chord progression
          </span>
        </div>
      )}

      {isProcessingAudio && (
        <div className="mt-6 text-center">
          <span className="text-amber-700 text-sm bg-amber-50 py-2 px-4 rounded-full inline-block animate-pulse">
            Processing audio... Trimming silence
          </span>
        </div>
      )}

      {/* Chord Progression Display Below */}
      <div className="mt-8">
        <ChordProgression
          chords={displayChords}
          currentTime={currentTime}
          totalDuration={totalDuration}
          isPlaying={isPlaying}
          onChordUpdate={handleChordUpdate}
          onTimingAdjust={handleTimingAdjust}
        />
      </div>
    </div>
  );
};

export default RecordingLoopSystem;
