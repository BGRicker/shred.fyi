'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  progressionScaleName?: string;
  chordMomentScaleName?: string;
  chordMomentNotes?: string[];
}

const normalizeNoteToSharp = (note: string): string => {
  switch (note) {
    case 'Bb': return 'A#';
    case 'Db': return 'C#';
    case 'Eb': return 'D#';
    case 'Gb': return 'F#';
    case 'Ab': return 'G#';
    default: return note;
  }
};

const notePositionsCache = new Map<string, Array<{ string: number; fret: number }>>();
const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OPEN_NOTES = ['E', 'B', 'G', 'D', 'A', 'E']; // High E to Low E

function calculateNoteAtFret(openNote: string, fret: number): string {
  const openNoteIndex = ALL_NOTES.indexOf(openNote);
  if (openNoteIndex === -1) return openNote;
  const noteIndex = (openNoteIndex + fret) % 12;
  return ALL_NOTES[noteIndex];
}

function findNotePositions(note: string): Array<{ string: number; fret: number }> {
  if (notePositionsCache.has(note)) {
    return notePositionsCache.get(note)!;
  }

  const positions: Array<{ string: number; fret: number }> = [];
  OPEN_NOTES.forEach((openNote, stringIndex) => {
    for (let fret = 0; fret <= 12; fret++) {
      if (calculateNoteAtFret(openNote, fret) === note) {
        positions.push({ string: stringIndex, fret });
      }
    }
  });

  notePositionsCache.set(note, positions);
  return positions;
}

const FretboardComponent: React.FC<FretboardComponentProps> = ({
  strings,
  className = '',
  highlightedNotes: progressionNotes = [],
  highlightMode = 'both',
  rootNotes = [],
  progressionScaleName,
  chordMomentScaleName,
  chordMomentNotes = [],
}) => {
  const [isClient, setIsClient] = useState(false);
  const fretboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const normalizedProgressionNotes = useMemo(() => progressionNotes.map(normalizeNoteToSharp), [progressionNotes]);
  const normalizedChordMomentNotes = useMemo(() => chordMomentNotes.map(normalizeNoteToSharp), [chordMomentNotes]);
  const normalizedRootNotes = useMemo(() => rootNotes.map(normalizeNoteToSharp), [rootNotes]);

  const fretboardLayout = useMemo(() => {
    const layout: { note: string; state: 'none' | 'progression' | 'moment' | 'root' }[][] = Array(6)
      .fill(null)
      .map(() => Array(13).fill({ note: '', state: 'none' }));

    const progressionNotesSet = new Set(normalizedProgressionNotes);
    const momentNotesSet = new Set(normalizedChordMomentNotes);
    const rootNotesSet = new Set(normalizedRootNotes);
    
    for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
      for (let fretIdx = 0; fretIdx <= 12; fretIdx++) {
        const note = calculateNoteAtFret(OPEN_NOTES[stringIdx], fretIdx);
        let state: 'none' | 'progression' | 'moment' | 'root' = 'none';

        const isProgression = progressionNotesSet.has(note);
        const isMoment = momentNotesSet.has(note);
        const isRoot = rootNotesSet.has(note);

        if (highlightMode === 'both') {
          if (isMoment) {
            state = isRoot ? 'root' : 'moment';
          } else if (isProgression) {
            state = isRoot ? 'root' : 'progression';
          }
        } else if (highlightMode === 'progression') {
          if (isProgression) {
            state = isRoot ? 'root' : 'progression';
          }
        } else if (highlightMode === 'chord') {
          if (isMoment) {
            state = isRoot ? 'root' : 'moment';
          }
        }
        
        layout[stringIdx][fretIdx] = { note, state };
      }
    }
    return layout;
  }, [normalizedProgressionNotes, normalizedChordMomentNotes, normalizedRootNotes, highlightMode]);

  if (!isClient) {
    return (
      <div className={`fretboard-container ${className}`}>
        <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">Loading fretboard...</div>
        </div>
      </div>
    );
  }

  const hasHighlightedNotes = progressionNotes.length > 0 || chordMomentNotes.length > 0;
  const displayStrings = hasHighlightedNotes ? [-1, -1, -1, -1, -1, -1] : strings;

  return (
    <div className={`fretboard-container ${className}`}>
      {/* Enhanced Guitar Fretboard using react-guitar with Scale Note Overlay */}
      <div className="mb-4 relative">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          {highlightMode === 'progression' && progressionScaleName ? `Progression Scale: ${progressionScaleName}` :
           highlightMode === 'chord' && chordMomentScaleName ? `Chord of the Moment Scale: ${chordMomentScaleName}` :
           'Guitar Fretboard with Full Scale Notes'}
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
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 1.1em;
              font-weight: bold;
              border-radius: 50%;
              color: white;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              z-index: 10;
              transition: background-color 0.2s ease-in-out, transform 0.1s ease-in-out;
            }
            .scale-note.progression-note {
              background: #3b82f6; /* blue-500 */
            }
            .scale-note.moment-note {
              background: #22c55e; /* green-500 */
              z-index: 11; /* Ensure moment notes are visually on top */
            }
            .scale-note.root-note {
              background: #dc2626; /* red-600 */
              border: 3px solid white;
              box-shadow: 0 3px 6px rgba(0,0,0,0.4);
              z-index: 12; /* Roots are the most important */
            }
          `}</style>
          
          <div className={`fretboard-wrapper ${hasHighlightedNotes ? 'scale-mode' : ''}`}>
            <Guitar
              key={displayStrings.join(',')}
              strings={displayStrings}
              center={false}
              frets={{ from: 0, amount: 12 }}
              className="w-full"
            />
            
            {/* Scale Note Overlay */}
            {hasHighlightedNotes && (
              <div className="scale-overlay">
                {fretboardLayout.flatMap((stringNotes, stringIndex) =>
                  stringNotes.map(({ note, state }, fretIndex) => {
                    if (state === 'none') return null;

                    const isRoot = state === 'root';
                    const isMoment = state === 'moment';
                    
                    let noteClass = '';
                    let title = note;

                    switch (state) {
                      case 'progression':
                        noteClass = 'progression-note';
                        title = `${note} (Progression Scale)`;
                        break;
                      case 'moment':
                        noteClass = 'moment-note';
                        title = `${note} (Chord of the Moment)`;
                        break;
                      case 'root':
                        noteClass = 'root-note';
                        title = `${note} (Root Note)`;
                        break;
                    }

                    return (
                      <div
                        key={`${stringIndex}-${fretIndex}`}
                        className={`scale-note ${noteClass}`}
                        style={{
                          gridColumn: fretIndex === 0 ? 1 : fretIndex + 1,
                          gridRow: stringIndex + 1,
                          justifySelf: 'center',
                          alignSelf: 'center',
                        }}
                        title={title}
                      >
                        {note}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scale Notes Display */}
      {progressionNotes.length > 0 && (
        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {highlightMode === 'chord' ? 'Scale Notes for Current Chord' : 
             highlightMode === 'progression' ? 'Progression Scale Notes' : 
             'Highlighted Scale Notes'}
          </h4>
          <div className="flex flex-wrap gap-2">
            {(highlightMode === 'chord' ? chordMomentNotes : progressionNotes).map((note, index) => {
              const normalizedNote = normalizeNoteToSharp(note);
              const isRootNote = normalizedRootNotes.includes(normalizedNote);
              const rootNote = normalizedRootNotes[0]; // Use the first normalized root note
              const interval = calculateInterval(normalizedNote, rootNote);
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
 * Get string name for display
 */
function getStringName(stringIndex: number): string {
  const stringNames = ['6th (E)', '5th (A)', '4th (D)', '3rd (G)', '2nd (B)', '1st (E)'];
  return stringNames[stringIndex];
}

/**
 * Calculate the interval from the root note
 */
function calculateInterval(note: string, rootNote: string): string {
  if (!rootNote) return '';
  const normalizedNote = normalizeNoteToSharp(note);
  const normalizedRootNote = normalizeNoteToSharp(rootNote);

  if (normalizedNote === normalizedRootNote) return 'Root';
  
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const rootIndex = notes.indexOf(normalizedRootNote);
  const noteIndex = notes.indexOf(normalizedNote);
  
  if (rootIndex === -1 || noteIndex === -1) return '';
  
  const semitones = (noteIndex - rootIndex + 12) % 12;
  
  const intervals = [
    'Root', 'm2', 'M2', 'm3', 'M3', 'P4', 
    '♯4/♭5', 'P5', 'm6', 'M6', 'm7', 'M7'
  ];
  
  return intervals[semitones];
}

export default FretboardComponent;
