'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Guitar to avoid SSR issues
const Guitar = dynamic(() => import('react-guitar'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
      <div className="text-gray-500 dark:text-gray-400">Loading fretboard...</div>
    </div>
  ),
});

interface FretboardComponentProps {
  strings: number[];
  className?: string;
  highlightedNotes?: string[]; // Notes to highlight on the fretboard
  highlightMode?: 'chord' | 'progression' | 'both';
  rootNotes?: string[]; // Root notes to distinguish with different styling
}

const FretboardComponent: React.FC<FretboardComponentProps> = ({
  strings,
  className = '',
  highlightedNotes = [],
  highlightMode = 'both',
  rootNotes = [],
}) => {
  const [isClient, setIsClient] = useState(false);
  const fretboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className={`fretboard-container ${className}`}>
        <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">Loading fretboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fretboard-container ${className}`}>
      {/* Enhanced Guitar Fretboard using react-guitar with Scale Note Overlay */}
      <div className="mb-4 relative">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Guitar Fretboard with Full Scale Notes
        </h4>
        
        {/* React Guitar Component - Simple Full Width Approach */}
        <div className="relative w-full" ref={fretboardRef}>
          <style jsx>{`
            .fretboard-wrapper {
              max-width: 100%;
              width: 100%;
              overflow: hidden;
            }
            .fretboard-wrapper :global(.guitar) {
              width: 100% !important;
              max-width: 100% !important;
              overflow: hidden !important;
            }
            .fretboard-wrapper :global(.frets) {
              width: 100% !important;
              max-width: 100% !important;
              overflow: hidden !important;
              display: grid !important;
              grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr !important;
            }
            .fretboard-wrapper :global(.fret) {
              width: 100% !important;
              min-width: unset !important;
              max-width: unset !important;
            }
            .fretboard-wrapper :global(.fret.nut) {
              width: 100% !important;
              min-width: unset !important;
              max-width: unset !important;
            }
            .fretboard-wrapper.scale-mode :global(.guitar),
            .fretboard-wrapper.scale-mode :global(.frets),
            .fretboard-wrapper.scale-mode :global(.fret) {
              pointer-events: none !important;
            }
            .fretboard-wrapper :global(.fret-hover),
            .fretboard-wrapper :global(.fret-hover-indicator),
            .fretboard-wrapper :global([data-hover]),
            .fretboard-wrapper :global(.hover),
            .fretboard-wrapper :global(.hover-indicator),
            .fretboard-wrapper :global(.fret:hover::after),
            .fretboard-wrapper :global(.fret:hover::before),
            .fretboard-wrapper :global(.fret[data-hover]),
            .fretboard-wrapper :global(.fret[data-hover]::after),
            .fretboard-wrapper :global(.fret[data-hover]::before) {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
            .scale-overlay {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
              grid-template-rows: 3.33125em 3.33125em 3.33125em 3.33125em 3.33125em 3.33125em;
              pointer-events: none;
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              width: 100%;
            }
            .scale-note {
              width: 2.5em;
              height: 2.5em;
              background: #3b82f6;
              color: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 1.1em;
              font-weight: bold;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              z-index: 10;
            }
            .scale-note.root-note {
              background: #dc2626;
              border: 3px solid white;
              box-shadow: 0 3px 6px rgba(0,0,0,0.4);
            }
          `}</style>
          
          <div className={`fretboard-wrapper ${highlightedNotes.length > 0 ? 'scale-mode' : ''}`}>
            <Guitar
              key={highlightedNotes.length > 0 ? 'scale-mode' : strings.join(',')}
              strings={highlightedNotes.length > 0 ? [-1, -1, -1, -1, -1, -1] : strings}
              center={false}
              frets={{ from: 0, amount: 12 }}
              className="w-full"
            />
            
            {/* Scale Note Overlay */}
            {highlightedNotes.length > 0 && (
              <div className="scale-overlay">
                {highlightedNotes.map((note) => {
                  const positions = findNotePositions(note);
                  const isRootNote = rootNotes.includes(note);
                  return positions.map((pos, posIndex) => (
                    <div
                      key={`${note}-${pos.string}-${pos.fret}-${posIndex}`}
                      className={`scale-note ${isRootNote ? 'root-note' : ''}`}
                      style={{
                        gridColumn: pos.fret === 0 ? 1 : pos.fret + 1,
                        gridRow: pos.string + 1,
                        justifySelf: 'center',
                        alignSelf: 'center',
                      }}
                      title={`${note} on ${getStringName(pos.string)} string, fret ${pos.fret}${isRootNote ? ' (Root Note)' : ''}`}
                    >
                      {note}
                    </div>
                  ));
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scale Notes Display */}
      {highlightedNotes.length > 0 && (
        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {highlightMode === 'chord' ? 'Scale Notes for Current Chord' : 
             highlightMode === 'progression' ? 'Progression Scale Notes' : 
             'Highlighted Scale Notes'}
          </h4>
          <div className="flex flex-wrap gap-2">
            {highlightedNotes.map((note, index) => {
              const isRootNote = rootNotes.includes(note);
              const rootNote = rootNotes[0]; // Use the first root note for interval calculation
              const interval = calculateInterval(note, rootNote);
              return (
                <span
                  key={index}
                  className={`px-2 py-1 rounded text-sm font-mono border ${
                    isRootNote 
                      ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                  }`}
                  title={`${note} - ${interval} from ${rootNote}`}
                >
                  {note} ({interval})
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Find all positions of a note across the fretboard
 */
function findNotePositions(note: string): Array<{ string: number; fret: number }> {
  const positions: Array<{ string: number; fret: number }> = [];
  const openNotes = ['E', 'A', 'D', 'G', 'B', 'E']; // 6th to 1st string
  
  openNotes.forEach((openNote, stringIndex) => {
    for (let fret = 0; fret <= 12; fret++) {
      const calculatedNote = calculateNoteAtFret(openNote, fret);
      if (calculatedNote === note) {
        positions.push({ string: stringIndex, fret });
      }
    }
  });
  
  return positions;
}

/**
 * Get string name for display
 */
function getStringName(stringIndex: number): string {
  const stringNames = ['6th (E)', '5th (A)', '4th (D)', '3rd (G)', '2nd (B)', '1st (E)'];
  return stringNames[stringIndex];
}

/**
 * Calculate the note at a specific fret on a given string
 */
function calculateNoteAtFret(openNote: string, fret: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const openNoteIndex = notes.indexOf(openNote);
  if (openNoteIndex === -1) return openNote;
  
  const noteIndex = (openNoteIndex + fret) % 12;
  return notes[noteIndex];
}

/**
 * Calculate the interval from the root note
 */
function calculateInterval(note: string, rootNote: string): string {
  if (!rootNote || note === rootNote) return 'Root';
  
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const rootIndex = notes.indexOf(rootNote);
  const noteIndex = notes.indexOf(note);
  
  if (rootIndex === -1 || noteIndex === -1) return '';
  
  const semitones = (noteIndex - rootIndex + 12) % 12;
  
  const intervals = [
    'Root', 'm2', 'M2', 'm3', 'M3', 'P4', 
    '♯4/♭5', 'P5', 'm6', 'M6', 'm7', 'M7'
  ];
  
  return intervals[semitones];
}

export default FretboardComponent;
