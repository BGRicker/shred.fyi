'use client';

import React from 'react';
import { ChordDetectionEvent } from '@/lib/audioAnalysis';

interface ChordProgressionProps {
  chords: ChordDetectionEvent[];
  currentChord: string | null;
  className?: string;
}

const ChordProgression: React.FC<ChordProgressionProps> = ({
  chords,
  currentChord,
  className = '',
}) => {
  // Helper function to find the most frequent chord in a group
  const getMostFrequentChord = React.useCallback((chordGroup: ChordDetectionEvent[]) => {
    const chordCounts: Record<string, { count: number; totalConfidence: number }> = {};
    
    chordGroup.forEach((event) => {
      if (!chordCounts[event.chord]) {
        chordCounts[event.chord] = { count: 0, totalConfidence: 0 };
      }
      chordCounts[event.chord].count++;
      chordCounts[event.chord].totalConfidence += event.confidence;
    });

    let maxCount = 0;
    let mostFrequent = '';
    let avgConfidence = 0;

    Object.entries(chordCounts).forEach(([chord, data]) => {
      if (data.count > maxCount) {
        maxCount = data.count;
        mostFrequent = chord;
        avgConfidence = data.totalConfidence / data.count;
      }
    });

    return { chord: mostFrequent, avgConfidence };
  }, []);

  // Group chords by time windows (every 2 seconds)
  const groupedChords = React.useMemo(() => {
    if (chords.length === 0) return [];

    const groups: { chord: string; startTime: number; confidence: number }[] = [];
    const windowSize = 4000; // 4 seconds (2 bars at 120 BPM)

    let currentGroup: ChordDetectionEvent[] = [];
    let windowStart = 0;

    chords.forEach((chord) => {
      const relativeTime = chord.timestamp - (chords[0]?.timestamp || 0);
      const windowIndex = Math.floor(relativeTime / windowSize);
      const expectedWindowStart = windowIndex * windowSize;

      if (windowStart !== expectedWindowStart) {
        // Process previous group
        if (currentGroup.length > 0) {
          const mostFrequentChord = getMostFrequentChord(currentGroup);
          groups.push({
            chord: mostFrequentChord.chord,
            startTime: windowStart,
            confidence: mostFrequentChord.avgConfidence,
          });
        }
        
        // Start new group
        currentGroup = [chord];
        windowStart = expectedWindowStart;
      } else {
        currentGroup.push(chord);
      }
    });

    // Process final group
    if (currentGroup.length > 0) {
      const mostFrequentChord = getMostFrequentChord(currentGroup);
      groups.push({
        chord: mostFrequentChord.chord,
        startTime: windowStart,
        confidence: mostFrequentChord.avgConfidence,
      });
    }

    return groups;
  }, [chords, getMostFrequentChord]);

  if (chords.length === 0) {
    return (
      <div className={`chord-progression ${className}`}>
        <div className="text-center py-8">
          <p className="text-slate-500 dark:text-slate-400">
            No chord progression recorded yet. Start recording to see detected chords!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`chord-progression ${className}`}>
      <div className="space-y-4">
        {/* Current Chord Indicator */}
        {currentChord && (
          <div className="bg-green-100 dark:bg-green-900 rounded-lg p-4 border border-green-200 dark:border-green-700">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-800 dark:text-green-200 font-semibold">
                Currently detecting: {currentChord}
              </span>
            </div>
          </div>
        )}

        {/* Progression Timeline */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
            Chord Progression ({groupedChords.length} chords)
          </h4>
          
          <div className="flex flex-wrap gap-2">
            {groupedChords.map((group, index) => {
              const confidenceColor = group.confidence > 0.7 
                ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700'
                : group.confidence > 0.5
                ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700'
                : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700';

              return (
                <div
                  key={index}
                  className={`
                    px-3 py-2 rounded-lg border text-sm font-medium
                    ${confidenceColor}
                  `}
                  title={`Confidence: ${(group.confidence * 100).toFixed(1)}%`}
                >
                  <div className="flex flex-col items-center">
                    <span className="font-semibold">{group.chord}</span>
                    <span className="text-xs opacity-75">
                      {Math.floor(group.startTime / 1000)}s
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progression Summary */}
        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Progression Summary
          </h5>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {groupedChords.map(g => g.chord).join(' → ')}
          </p>
          {chords.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Total duration: {Math.floor((chords[chords.length - 1]?.timestamp - chords[0]?.timestamp) / 1000)}s
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChordProgression;