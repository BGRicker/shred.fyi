'use client';

import React, { useState, useMemo, useEffect } from 'react';
import FretboardComponent from '@/components/FretboardComponent';
import ChordSelector from '@/components/ChordSelector';
import ScaleSuggestions from '@/components/ScaleSuggestions';
import ChordProgression from '@/components/ChordProgression';
import { chordDefinitions } from '@/lib/chords';
import { getScaleSuggestions } from '@/lib/musicTheory';
import { useAudioRecording } from '@/hooks/useAudioRecording';

export default function Home() {
  const [selectedChord, setSelectedChord] = useState<string>('Am');
  const [mode, setMode] = useState<'manual' | 'recording'>('manual');

  // Audio recording hook
  const { state: audioState, startRecording, stopRecording, clearChords } = useAudioRecording();

  const currentChordData = chordDefinitions[selectedChord];
  
  // Use detected chord if recording, otherwise use manually selected chord
  const activeChord = mode === 'recording' && audioState.currentChord 
    ? audioState.currentChord 
    : selectedChord;
    
  const activeChordData = chordDefinitions[activeChord] || currentChordData;
  
  // Get scale suggestions for the active chord
  const scaleSuggestions = useMemo(() => {
    if (activeChordData?.symbol) {
      return getScaleSuggestions(activeChordData.symbol);
    }
    return [];
  }, [activeChordData?.symbol]);

  const handleChordChange = (chordKey: string) => {
    setSelectedChord(chordKey);
  };

  const handleStartRecording = async () => {
    setMode('recording');
    clearChords();
    await startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
    setMode('manual');
  };

  // Auto-update selected chord when recording detects a chord
  useEffect(() => {
    if (mode === 'recording' && audioState.currentChord) {
      setSelectedChord(audioState.currentChord);
    }
  }, [audioState.currentChord, mode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Shredly
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-lg">
            Guitar Practice Assistant
          </p>
        </header>

        {/* Controls */}
        <div className="flex justify-center flex-wrap gap-4 mb-8">
          {!audioState.isRecording ? (
            <button 
              onClick={handleStartRecording}
              disabled={audioState.isInitializing}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center space-x-2"
            >
              <span>🎤</span>
              <span>{audioState.isInitializing ? 'Initializing...' : 'Start Recording'}</span>
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
            onClick={clearChords}
            disabled={audioState.isRecording}
            className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Clear Progression
          </button>
          
          <button 
            onClick={() => {
              setSelectedChord('Am');
              setMode('manual');
            }}
            className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Reset to Manual
          </button>
        </div>

        {/* Main Content */}
        <main className="space-y-8">
          {/* Mode Indicator and Current Chord */}
          <div className="text-center">
            <div className="flex justify-center items-center space-x-4 mb-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                mode === 'manual' 
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              }`}>
                {mode === 'manual' ? '🎸 Manual Mode' : '🎤 Recording Mode'}
              </div>
              {audioState.isRecording && (
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-red-600 dark:text-red-400 font-medium">Recording</span>
                </div>
              )}
            </div>
            
            <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-200 mb-2">
              {mode === 'recording' ? 'Detected Chord' : 'Current Chord'}
            </h2>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {activeChordData?.name || 'Unknown'}
            </div>
            
            {/* Error Display */}
            {audioState.error && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
                {audioState.error}
              </div>
            )}
          </div>

          {/* Chord Progression (when recording or when there are detected chords) */}
          {(mode === 'recording' || audioState.detectedChords.length > 0) && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">
                Chord Progression {mode === 'recording' ? '(Recording)' : '(Last Recording)'}
              </h3>
              <ChordProgression 
                chords={audioState.detectedChords}
                currentChord={audioState.currentChord}
              />
            </div>
          )}

          {/* Chord Selector (when in manual mode) */}
          {mode === 'manual' && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">
                Select Chord
              </h3>
              <ChordSelector
                selectedChord={selectedChord}
                onChordChange={handleChordChange}
              />
            </div>
          )}

          {/* Fretboard */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">
              Fretboard
            </h3>
            <div className="overflow-x-auto">
              <FretboardComponent strings={activeChordData?.fingering || [-1, -1, -1, -1, -1, -1]} />
            </div>
          </div>

          {/* Scale Suggestions */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">
              Suggested Scales for {activeChordData?.name || 'Unknown Chord'}
            </h3>
            <ScaleSuggestions suggestions={scaleSuggestions} />
          </div>


        </main>
      </div>
    </div>
  );
}
