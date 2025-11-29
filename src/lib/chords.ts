// Guitar chord definitions
// Array represents frets for each string from low E (6th) to high E (1st)
// 0 = open string, -1 = muted string, number = fret position

export interface ChordDefinition {
  name: string;
  fingering: number[];
  category: 'major' | 'minor' | 'seventh' | 'major7' | 'add9';
  symbol: string; // Tonal.js compatible chord symbol
}

export const chordDefinitions: Record<string, ChordDefinition> = {
  // Major Chords
  'C': {
    name: 'C major',
    fingering: [-1, 3, 2, 0, 1, 0],
    category: 'major',
    symbol: 'C'
  },
  'D': {
    name: 'D major',
    fingering: [-1, -1, 0, 2, 3, 2],
    category: 'major',
    symbol: 'D'
  },
  'E': {
    name: 'E major',
    fingering: [0, 2, 2, 1, 0, 0],
    category: 'major',
    symbol: 'E'
  },
  'F': {
    name: 'F major',
    fingering: [1, 3, 3, 2, 1, 1],
    category: 'major',
    symbol: 'F'
  },
  'G': {
    name: 'G major',
    fingering: [3, 2, 0, 0, 3, 3],
    category: 'major',
    symbol: 'G'
  },
  'A': {
    name: 'A major',
    fingering: [-1, 0, 2, 2, 2, 0],
    category: 'major',
    symbol: 'A'
  },
  'B': {
    name: 'B major',
    fingering: [-1, 2, 4, 4, 4, 2],
    category: 'major',
    symbol: 'B'
  },

  // Minor Chords  
  'Cm': {
    name: 'C minor',
    fingering: [-1, 3, 5, 5, 4, 3],
    category: 'minor',
    symbol: 'Cm'
  },
  'Dm': {
    name: 'D minor',
    fingering: [-1, -1, 0, 2, 3, 1],
    category: 'minor',
    symbol: 'Dm'
  },
  'Em': {
    name: 'E minor',
    fingering: [0, 2, 2, 0, 0, 0],
    category: 'minor',
    symbol: 'Em'
  },
  'Fm': {
    name: 'F minor',
    fingering: [1, 3, 3, 1, 1, 1],
    category: 'minor',
    symbol: 'Fm'
  },
  'Gm': {
    name: 'G minor',
    fingering: [3, 5, 5, 3, 3, 3],
    category: 'minor',
    symbol: 'Gm'
  },
  'Am': {
    name: 'A minor',
    fingering: [-1, 0, 2, 2, 1, 0],
    category: 'minor',
    symbol: 'Am'
  },
  'Bm': {
    name: 'B minor',
    fingering: [-1, 2, 4, 4, 3, 2],
    category: 'minor',
    symbol: 'Bm'
  },

  // Seventh Chords (dominant 7ths)
  'A7': {
    name: 'A dominant 7th',
    fingering: [-1, 0, 2, 0, 2, 0],
    category: 'seventh',
    symbol: 'A7'
  },
  'B7': {
    name: 'B dominant 7th',
    fingering: [-1, 2, 1, 2, 0, 2],
    category: 'seventh',
    symbol: 'B7'
  },
  'C7': {
    name: 'C dominant 7th',
    fingering: [-1, 3, 2, 3, 1, 0],
    category: 'seventh',
    symbol: 'C7'
  },
  'D7': {
    name: 'D dominant 7th',
    fingering: [-1, -1, 0, 2, 1, 2],
    category: 'seventh',
    symbol: 'D7'
  },
  'E7': {
    name: 'E dominant 7th',
    fingering: [0, 2, 0, 1, 0, 0],
    category: 'seventh',
    symbol: 'E7'
  },
  'F7': {
    name: 'F dominant 7th',
    fingering: [1, 3, 1, 2, 1, 1],
    category: 'seventh',
    symbol: 'F7'
  },
  'G7': {
    name: 'G dominant 7th',
    fingering: [3, 2, 0, 0, 0, 1],
    category: 'seventh',
    symbol: 'G7'
  },
  // Major 7th Chords
  'Cmaj7': {
    name: 'C major 7th',
    fingering: [-1, 3, 2, 0, 0, 0],
    category: 'major7',
    symbol: 'Cmaj7'
  },
  'Dmaj7': {
    name: 'D major 7th',
    fingering: [-1, -1, 0, 2, 2, 2],
    category: 'major7',
    symbol: 'Dmaj7'
  },
  'Emaj7': {
    name: 'E major 7th',
    fingering: [0, 2, 1, 1, 0, 0],
    category: 'major7',
    symbol: 'Emaj7'
  },
  'Fmaj7': {
    name: 'F major 7th',
    fingering: [1, 3, 2, 2, 1, 1],
    category: 'major7',
    symbol: 'Fmaj7'
  },
  'Gmaj7': {
    name: 'G major 7th',
    fingering: [3, 2, 0, 0, 0, 2],
    category: 'major7',
    symbol: 'Gmaj7'
  },
  'Amaj7': {
    name: 'A major 7th',
    fingering: [-1, 0, 2, 1, 2, 0],
    category: 'major7',
    symbol: 'Amaj7'
  },
  'Bmaj7': {
    name: 'B major 7th',
    fingering: [-1, 2, 4, 3, 4, 2],
    category: 'major7',
    symbol: 'Bmaj7'
  },

  // Add9 Chords
  'Cadd9': {
    name: 'C add 9',
    fingering: [-1, 3, 2, 0, 3, 0],
    category: 'add9',
    symbol: 'Cadd9'
  },
  'Dadd9': {
    name: 'D add 9',
    fingering: [-1, -1, 0, 2, 3, 0],
    category: 'add9',
    symbol: 'Dadd9'
  },
  'Eadd9': {
    name: 'E add 9',
    fingering: [0, 2, 2, 1, 0, 2],
    category: 'add9',
    symbol: 'Eadd9'
  },
  'Fadd9': {
    name: 'F add 9',
    fingering: [1, 3, 3, 2, 1, 3],
    category: 'add9',
    symbol: 'Fadd9'
  },
  'Gadd9': {
    name: 'G add 9',
    fingering: [3, 2, 0, 2, 0, 3],
    category: 'add9',
    symbol: 'Gadd9'
  },
  'Aadd9': {
    name: 'A add 9',
    fingering: [-1, 0, 2, 2, 0, 0],
    category: 'add9',
    symbol: 'Aadd9'
  },
  'Badd9': {
    name: 'B add 9',
    fingering: [-1, 2, 4, 4, 2, 2],
    category: 'add9',
    symbol: 'Badd9'
  }
};

export const getChordNames = (): string[] => {
  return Object.keys(chordDefinitions);
};

export const getChordsByCategory = (category: 'major' | 'minor' | 'seventh' | 'major7' | 'add9'): ChordDefinition[] => {
  return Object.values(chordDefinitions).filter(chord => chord.category === category);
};

export const getChord = (chordKey: string): ChordDefinition | undefined => {
  return chordDefinitions[chordKey];
};
