'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioAnalyzer, ChordDetectionEvent } from '@/lib/audioAnalysis';

export interface RecordingState {
  isRecording: boolean;
  isInitializing: boolean;
  error: string | null;
  hasPermission: boolean;
  detectedChords: ChordDetectionEvent[];
  currentChord: string | null;
}

export interface UseAudioRecordingReturn {
  state: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearChords: () => void;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isInitializing: false,
    error: null,
    hasPermission: false,
    detectedChords: [],
    currentChord: null,
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
    console.log('Hook received chord detection:', event);
    setState(prev => {
      const newState = {
        ...prev,
        detectedChords: [...prev.detectedChords, event],
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

  return {
    state,
    startRecording,
    stopRecording,
    clearChords,
  };
}
