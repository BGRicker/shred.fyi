export const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const OPEN_NOTES = ['E', 'B', 'G', 'D', 'A', 'E']; // High E to Low E

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
