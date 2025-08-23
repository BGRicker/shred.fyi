'use client';

import React, { useState, useMemo } from 'react';
import FretboardComponent from '@/components/FretboardComponent';
import ChordSelector from '@/components/ChordSelector';
import ScaleSuggestions from '@/components/ScaleSuggestions';
import { chordDefinitions } from '@/lib/chords';
import { getScaleSuggestions } from '@/lib/musicTheory';

export default function Home() {
  const [selectedChord, setSelectedChord] = useState<string>('Am');

  const currentChordData = chordDefinitions[selectedChord];
  
  // Get scale suggestions for the current chord
  const scaleSuggestions = useMemo(() => {
    if (currentChordData?.symbol) {
      return getScaleSuggestions(currentChordData.symbol);
    }
    return [];
  }, [currentChordData?.symbol]);

  const handleChordChange = (chordKey: string) => {
    setSelectedChord(chordKey);
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

        {/* Main Content */}
        <main className="space-y-8">
          {/* Current Chord Display */}
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Current Chord
            </h2>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {currentChordData?.name || 'Unknown'}
            </div>
          </div>

          {/* Chord Selector */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">
              Select Chord
            </h3>
            <ChordSelector
              selectedChord={selectedChord}
              onChordChange={handleChordChange}
            />
          </div>

          {/* Fretboard */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">
              Fretboard
            </h3>
            <div className="overflow-x-auto">
              <FretboardComponent strings={currentChordData?.fingering || [-1, -1, -1, -1, -1, -1]} />
            </div>
          </div>

          {/* Scale Suggestions */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-4">
              Suggested Scales for {currentChordData?.name || 'Unknown Chord'}
            </h3>
            <ScaleSuggestions suggestions={scaleSuggestions} />
          </div>

          {/* Controls */}
          <div className="flex justify-center space-x-4">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
              Start Recording
            </button>
            <button 
              className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              onClick={() => setSelectedChord('Am')}
            >
              Reset to A minor
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
