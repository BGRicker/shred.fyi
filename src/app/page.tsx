'use client';

import React, { useState, useMemo, useEffect } from 'react';
import FretboardComponent from '@/components/FretboardComponent';
import ChordSelector from '@/components/ChordSelector';
import ChordProgression from '@/components/ChordProgression';
import ScaleSuggestions from '@/components/ScaleSuggestions';
import RecordingLoopSystem from '@/components/RecordingLoopSystem';
import { chordDefinitions } from '@/lib/chords';
import { getScaleSuggestions, analyzeProgression } from '@/lib/musicTheory';
import { useAudioRecording } from '@/hooks/useAudioRecording';

export default function Home() {
  const [selectedChord, setSelectedChord] = useState<string>('Am');
  const [mode, setMode] = useState<'manual' | 'recording'>('manual');
  const [highlightMode, setHighlightMode] = useState<'chord' | 'progression' | 'both'>('both');

  // Audio recording hook
  const { state: audioState, startRecording, stopRecording, clearChords, updateDetectedChord } = useAudioRecording();

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

  // Analyze the entire chord progression for progression-wide scales
  const progressionAnalysis = useMemo(() => {
    if (mode === 'recording' && audioState.detectedChords.length > 0) {
      // Extract chord symbols from detected chords
      const chordSymbols = audioState.detectedChords.map(event => event.chord);
      return analyzeProgression(chordSymbols);
    }
    return null;
  }, [audioState.detectedChords, mode]);

  // Get the notes to highlight on the fretboard
  const highlightedNotes = useMemo(() => {
    if (highlightMode === 'chord') {
      // Only show chord-specific scales
      return scaleSuggestions
        .filter(s => s.quality === 'perfect')
        .flatMap(s => s.notes)
        .filter((note, index, arr) => arr.indexOf(note) === index); // Remove duplicates
    } else if (highlightMode === 'progression') {
      // Show progression-wide scales if available, otherwise fall back to current chord scale
      if (progressionAnalysis?.progressionScales) {
        return progressionAnalysis.progressionScales
          .filter(s => s.quality === 'perfect')
          .flatMap(s => s.notes)
          .filter((note, index, arr) => arr.indexOf(note) === index);
      } else {
        // Fallback to current chord scale when no progression analysis
        return scaleSuggestions
          .filter(s => s.quality === 'perfect')
          .flatMap(s => s.notes)
          .filter((note, index, arr) => arr.indexOf(note) === index);
      }
    } else {
      // Show both, prioritizing perfect matches
      const chordNotes = scaleSuggestions
        .filter(s => s.quality === 'perfect')
        .flatMap(s => s.notes);
      
      const progressionNotes = progressionAnalysis?.progressionScales
        .filter(s => s.quality === 'perfect')
        .flatMap(s => s.notes) || [];
      
      // Combine and remove duplicates, prioritizing progression notes
      const allNotes = [...progressionNotes, ...chordNotes];
      return allNotes.filter((note, index, arr) => arr.indexOf(note) === index);
    }
  }, [scaleSuggestions, progressionAnalysis, highlightMode]);

  // Extract root notes from the active chord and progression
  const rootNotes = useMemo(() => {
    const roots: string[] = [];
    
    // Add root note from current chord
    if (activeChord) {
      const rootNote = activeChord.replace(/[^A-G#b]/g, ''); // Extract just the note part
      if (rootNote && !roots.includes(rootNote)) {
        roots.push(rootNote);
      }
    }
    
    // Add root notes from progression if available
    if (progressionAnalysis?.keySignature) {
      const keyRoot = progressionAnalysis.keySignature.replace(/[^A-G#b]/g, '');
      if (keyRoot && !roots.includes(keyRoot)) {
        roots.push(keyRoot);
      }
    }
    
    return roots;
  }, [activeChord, progressionAnalysis?.keySignature]);

  // Debug logging
  useEffect(() => {
    console.log('Fretboard Debug:', {
      highlightMode,
      activeChord,
      scaleSuggestions: scaleSuggestions.length,
      progressionAnalysis: progressionAnalysis ? 'exists' : 'null',
      highlightedNotes: highlightedNotes.length,
      rootNotes: rootNotes.length
    });
    
    if (highlightedNotes.length > 0) {
      console.log('Highlighted Notes:', highlightedNotes);
    }
  }, [highlightMode, activeChord, scaleSuggestions, progressionAnalysis, highlightedNotes, rootNotes]);

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

  const handleUpdateChord = (timestamp: number, newChord: string) => {
    updateDetectedChord(timestamp, newChord);
  };

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

        {/* Recording & Loop System */}
        <RecordingLoopSystem
          isRecording={audioState.isRecording}
          detectedChords={audioState.detectedChords}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onClearRecording={clearChords}
          onUpdateChord={handleUpdateChord}
        />

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
            
            {/* Reset to Manual Button */}
            <button 
              onClick={() => {
                setSelectedChord('Am');
                setMode('manual');
              }}
              className="mt-4 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Reset to Manual Mode
            </button>
            
            {/* Progression Analysis Info */}
            {progressionAnalysis && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <span className="font-semibold">Key:</span> {progressionAnalysis.keySignature} 
                  <span className="mx-2">•</span>
                  <span className="font-semibold">Type:</span> {progressionAnalysis.progressionType}
                </div>
              </div>
            )}
            
            {/* Error Display */}
            {audioState.error && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
                {audioState.error}
              </div>
            )}
          </div>

          {/* Fretboard Controls */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
                Fretboard & Scale Notes
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setHighlightMode('chord')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    highlightMode === 'chord'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  Chord Scale Notes
                </button>
                <button
                  onClick={() => setHighlightMode('progression')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    highlightMode === 'progression'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  Progression Scale
                </button>
                <button
                  onClick={() => setHighlightMode('both')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    highlightMode === 'both'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  Both Scales
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <FretboardComponent 
                strings={activeChordData?.fingering || [-1, -1, -1, -1, -1, -1]}
                highlightedNotes={highlightedNotes}
                highlightMode={highlightMode}
                rootNotes={rootNotes}
              />
            </div>
          </div>

          {/* Enhanced Scale Suggestions */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">
              Scale Recommendations
            </h3>
            
            {/* Chord-specific scales */}
            <div className="mb-6">
              <h4 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-3">
                🎸 Scales for Current Chord: {activeChordData?.name || 'Unknown'}
              </h4>
              <ScaleSuggestions suggestions={scaleSuggestions} />
            </div>
            
            {/* Progression-wide scales */}
            {progressionAnalysis && progressionAnalysis.progressionScales.length > 0 && (
              <div>
                <h4 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-3">
                  🎵 Scales for Entire Progression (Key: {progressionAnalysis.keySignature})
                </h4>
                <ScaleSuggestions suggestions={progressionAnalysis.progressionScales} />
              </div>
            )}
          </div>

          {/* Chord Selector (moved to bottom, when in manual mode) */}
          {mode === 'manual' && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">
                Manual Chord Selection
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">
                Use this to manually explore different chords and their scales. For real-time practice, use the recording feature above.
              </p>
              <ChordSelector
                selectedChord={selectedChord}
                onChordChange={handleChordChange}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
