'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { chordDefinitions, getChordNames } from '@/lib/chords';

interface ChordSelectorProps {
  selectedChord: string;
  onChordChange: (chordKey: string) => void;
  className?: string;
}

const ChordSelector: React.FC<ChordSelectorProps> = ({
  selectedChord,
  onChordChange,
  className = '',
}) => {
  const chordNames = getChordNames();

  // Group chords by category for better organization
  const majorChords = chordNames.filter(key => chordDefinitions[key].category === 'major');
  const minorChords = chordNames.filter(key => chordDefinitions[key].category === 'minor');
  const seventhChords = chordNames.filter(key => chordDefinitions[key].category === 'seventh');

  return (
    <div className={`chord-selector ${className}`}>
      <div className="flex flex-col gap-4">
        {/* Major Chords */}
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Major Chords
          </h4>
          <div className="grid grid-cols-7 gap-2">
            {majorChords.map((chordKey) => (
              <Button
                key={chordKey}
                onClick={() => onChordChange(chordKey)}
                variant={selectedChord === chordKey ? 'default' : 'secondary'}
                size="sm"
                className={`w-full ${selectedChord === chordKey ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              >
                {chordKey}
              </Button>
            ))}
          </div>
        </div>

        {/* Minor Chords */}
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Minor Chords
          </h4>
          <div className="grid grid-cols-7 gap-2">
            {minorChords.map((chordKey) => (
              <Button
                key={chordKey}
                onClick={() => onChordChange(chordKey)}
                variant={selectedChord === chordKey ? 'default' : 'secondary'}
                size="sm"
                className={`w-full ${selectedChord === chordKey ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              >
                {chordKey}
              </Button>
            ))}
          </div>
        </div>

        {/* Seventh Chords */}
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
            7th Chords
          </h4>
          <div className="grid grid-cols-7 gap-2">
            {seventhChords.map((chordKey) => (
              <Button
                key={chordKey}
                onClick={() => onChordChange(chordKey)}
                variant={selectedChord === chordKey ? 'default' : 'secondary'}
                size="sm"
                className={`w-full ${selectedChord === chordKey ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              >
                {chordKey}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChordSelector;
