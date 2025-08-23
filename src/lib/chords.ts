// Guitar chord definitions
// Array represents frets for each string from low E (6th) to high E (1st)
// 0 = open string, -1 = muted string, number = fret position

export interface ChordDefinition {
  name: string;
  fingering: number[];
  category: 'major' | 'minor';
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
  }
};

export const getChordNames = (): string[] => {
  return Object.keys(chordDefinitions);
};

export const getChordsByCategory = (category: 'major' | 'minor'): ChordDefinition[] => {
  return Object.values(chordDefinitions).filter(chord => chord.category === category);
};

export const getChord = (chordKey: string): ChordDefinition | undefined => {
  return chordDefinitions[chordKey];
};
