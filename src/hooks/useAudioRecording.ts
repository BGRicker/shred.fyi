'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioAnalyzer, ChordDetectionEvent } from '@/lib/audioAnalysis';
import { chordDefinitions } from '@/lib/chords';

const CHORD_SMOOTHING_WINDOW_MS = 1200;

const getChordRoot = (chord: string): string => {
  const match = chord.match(/^([A-G](?:#|b)?)/);
  return match ? match[1] : chord;
};

const preferExtendedChord = (a: string, b: string) => {
  const aHas7 = /7/.test(a);
  const bHas7 = /7/.test(b);
  if (aHas7 && !bHas7) return a;
  if (!aHas7 && bHas7) return b;
  return b; // prefer the newest chord otherwise
};

const mergeChordEvent = (
  events: ChordDetectionEvent[],
  newEvent: ChordDetectionEvent,
  windowMs: number
): ChordDetectionEvent[] => {
  if (events.length === 0) {
    return [newEvent];
  }

  const lastEvent = events[events.length - 1];
  const withinWindow = newEvent.timestamp - lastEvent.timestamp <= windowMs;
  const sameRoot = getChordRoot(lastEvent.chord) === getChordRoot(newEvent.chord);

  if (withinWindow && sameRoot) {
    const mergedChord = preferExtendedChord(lastEvent.chord, newEvent.chord);
    const mergedEvent: ChordDetectionEvent = {
      ...lastEvent,
      chord: mergedChord,
      rawChord: newEvent.rawChord || lastEvent.rawChord,
      confidence: Math.max(lastEvent.confidence, newEvent.confidence),
      timestamp: newEvent.timestamp,
    };
    return [...events.slice(0, -1), mergedEvent];
  }

  return [...events, newEvent];
};

export interface RecordingState {
  isRecording: boolean;
  isInitializing: boolean;
  error: string | null;
  hasPermission: boolean;
  detectedChords: ChordDetectionEvent[];
  currentChord: string | null;
  smoothingWindowMs: number;
}

export interface UseAudioRecordingReturn {
  state: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearChords: () => void;
  updateDetectedChord: (timestamp: number, newChord: string) => void;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isInitializing: false,
    error: null,
    hasPermission: false,
    detectedChords: [],
    currentChord: null,
    smoothingWindowMs: CHORD_SMOOTHING_WINDOW_MS,
  });

  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const currentChordTimeoutRef = useRef<number | undefined>(undefined);

  // Initialize audio analyzer (browser only)
  useEffect(() => {
    // Only initialize in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    setState(prev => ({ ...prev, isInitializing: true }));
    
    analyzerRef.current = new AudioAnalyzer();
    
    // Check if analyzer is ready
    const checkReady = () => {
      if (analyzerRef.current?.isReady()) {
        setState(prev => ({ ...prev, isInitializing: false }));
      } else {
        setTimeout(checkReady, 100);
      }
    };
    
    // Add a small delay to allow audio analyzer to initialize
    setTimeout(checkReady, 500);

    return () => {
      if (analyzerRef.current) {
        analyzerRef.current.stopRecording();
      }
      if (currentChordTimeoutRef.current) {
        clearTimeout(currentChordTimeoutRef.current);
      }
    };
  }, []);

  const handleChordDetected = useCallback((event: ChordDetectionEvent) => {
    console.log('Hook received chord detection:', {
      normalizedChord: event.chord,
      rawChord: event.rawChord,
      confidence: event.confidence.toFixed(2),
      timestamp: event.timestamp,
    });

    if (!event.chord || !chordDefinitions[event.chord]) {
      console.debug('Discarding unsupported chord event', event);
      return;
    }

    setState(prev => {
      const smoothedChords = mergeChordEvent(prev.detectedChords, event, prev.smoothingWindowMs);
      const newState = {
        ...prev,
        detectedChords: smoothedChords,
        currentChord: event.chord,
        error: null,
      };
      console.log('Updated state - detected chords count:', newState.detectedChords.length);
      return newState;
    });

    // Clear current chord after 3 seconds of no new detections
    if (currentChordTimeoutRef.current) {
      clearTimeout(currentChordTimeoutRef.current);
    }
    
    currentChordTimeoutRef.current = window.setTimeout(() => {
      setState(prev => ({ ...prev, currentChord: null }));
    }, 3000);
  }, []);

  const stopRecording = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.stopRecording();
    }
    
    setState(prev => ({
      ...prev,
      isRecording: false,
      currentChord: null,
    }));

    if (currentChordTimeoutRef.current) {
      clearTimeout(currentChordTimeoutRef.current);
    }
  }, []);

  const clearChords = useCallback(() => {
    setState(prev => ({
      ...prev,
      detectedChords: [],
      currentChord: null,
    }));
  }, []);

  const updateDetectedChord = useCallback((timestamp: number, newChord: string) => {
    setState(prev => {
      const updatedChords = prev.detectedChords.map(event => {
        if (event.timestamp === timestamp) {
          return { ...event, chord: newChord };
        }
        return event;
      });
      return { ...prev, detectedChords: updatedChords };
    });
  }, []);

  const startRecording = useCallback(async () => {
    if (!analyzerRef.current) {
      setState(prev => ({ ...prev, error: 'Audio analyzer not initialized' }));
      return;
    }

    console.log('Starting recording...');
    setState(prev => ({ ...prev, isInitializing: true, error: null }));

    try {
      await analyzerRef.current.startRecording(handleChordDetected);
      console.log('Recording started successfully');
      
      setState(prev => ({
        ...prev,
        isRecording: true,
        isInitializing: false,
        hasPermission: true,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setState(prev => ({
        ...prev,
        isRecording: false,
        isInitializing: false,
        hasPermission: false,
        error: errorMessage,
      }));
    }
  }, [handleChordDetected]);

  return {
    state,
    startRecording,
    stopRecording,
    clearChords,
    updateDetectedChord,
  };
}
