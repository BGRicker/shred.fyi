export const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const OPEN_NOTES = ['E', 'B', 'G', 'D', 'A', 'E']; // High E to Low E
export const STANDARD_TUNING = ['E', 'A', 'D', 'G', 'B', 'E'];
const SCALE_FORMULAS = {
  minorPentatonic: [0, 3, 5, 7, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
} as const;

export const normalizeNoteToSharp = (note: string): string => {
  switch (note) {
    case 'Bb': return 'A#';
    case 'Db': return 'C#';
    case 'Eb': return 'D#';
    case 'Gb': return 'F#';
    case 'Ab': return 'G#';
    default: return note;
  }
};

export function calculateNoteAtFret(openNote: string, fret: number): string {
  const openNoteIndex = ALL_NOTES.indexOf(openNote);
  if (openNoteIndex === -1) return openNote;
  const noteIndex = (openNoteIndex + fret) % 12;
  return ALL_NOTES[noteIndex];
}

export function calculateInterval(note: string, rootNote: string): string {
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

export function normalizeNote(note: string): string {
  const flatToSharp: Record<string, string> = {
    Db: 'C#',
    Eb: 'D#',
    Gb: 'F#',
    Ab: 'G#',
    Bb: 'A#',
  };
  return normalizeNoteToSharp(flatToSharp[note] || note);
}

export function isSameNote(note1: string, note2: string): boolean {
  return normalizeNote(note1) === normalizeNote(note2);
}

function getNoteFromInterval(root: string, interval: number): string {
  const rootIndex = ALL_NOTES.indexOf(normalizeNote(root));
  if (rootIndex === -1) return root;
  return ALL_NOTES[(rootIndex + interval) % 12];
}

export function getFretNote(stringIndex: number, fret: number): string {
  const openNote = STANDARD_TUNING[stringIndex];
  return getNoteFromInterval(openNote, fret);
}

export function getChordTones(chordRoot: string, chordType: string): { root: string; third: string; fifth: string } {
  let thirdInterval = 4; // major third
  let fifthInterval = 7; // perfect fifth

  if (chordType.includes('m') || chordType.includes('minor')) {
    thirdInterval = 3;
  }

  if (chordType.includes('dim')) {
    thirdInterval = 3;
    fifthInterval = 6;
  }

  if (chordType.includes('aug')) {
    fifthInterval = 8;
  }

  const root = normalizeNote(chordRoot);

  return {
    root,
    third: getNoteFromInterval(root, thirdInterval),
    fifth: getNoteFromInterval(root, fifthInterval),
  };
}

export type ScaleTypeKey = keyof typeof SCALE_FORMULAS;

export function getScaleDegree(note: string, scaleRoot: string, scaleType: ScaleTypeKey): { degree: number; degreeLabel: string } | null {
  const intervals = SCALE_FORMULAS[scaleType];
  const noteIndex = ALL_NOTES.indexOf(normalizeNote(note));
  const rootIndex = ALL_NOTES.indexOf(normalizeNote(scaleRoot));

  if (noteIndex === -1 || rootIndex === -1) return null;

  const interval = (noteIndex - rootIndex + 12) % 12;
  // Cast to readonly number[] to fix TS error with indexOf
  const degreeIndex = (intervals as readonly number[]).indexOf(interval);
  if (degreeIndex === -1) return null;

  const degreeLabels: Record<number, string> = {
    0: '1',
    2: '2',
    3: '♭3',
    4: '3',
    5: '4',
    6: '♭5',
    7: '5',
    8: '♯5',
    9: '6',
    10: '♭7',
    11: '7',
  };

  return {
    degree: interval,
    degreeLabel: degreeLabels[interval] || '?',
  };
}
