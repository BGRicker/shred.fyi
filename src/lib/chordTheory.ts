import { Chord, Scale, Note } from 'tonal';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ChordDegree {
  /** Circle position 0–6 (I–VII) */
  position: number;
  /** Interval label: "1", "b3", "5", "b7", etc. */
  label: string;
  /** Actual note name: "C", "Eb", "F#", etc. */
  note: string;
}

export interface ParsedChord {
  symbol: string;
  root: string;
  degrees: ChordDegree[];
}

export interface ScaleMatch {
  name: string;
  root: string;
  overlap: number; // 0–1
  matchedNotes: string[];
  outsideNotes: string[];
  scaleNotes: string[]; // full ordered scale notes
  scaleDegrees: string[]; // degree labels e.g. "1","2","b3"...
}

// ── Degree position mapping ────────────────────────────────────────────────
// Maps tonal interval string → circle position (0=I … 6=VII) + display label

const INTERVAL_TO_DEGREE: Record<string, { position: number; label: string }> = {
  '1P': { position: 0, label: '1' },
  '2m': { position: 1, label: 'b2' },
  '2M': { position: 1, label: '2' },
  '3m': { position: 2, label: 'b3' },
  '3M': { position: 2, label: '3' },
  '3A': { position: 2, label: '#3' },
  '4P': { position: 3, label: '4' },
  '4A': { position: 3, label: '#4' },
  '5d': { position: 4, label: 'b5' },
  '5P': { position: 4, label: '5' },
  '5A': { position: 4, label: '#5' },
  '6m': { position: 5, label: 'b6' },
  '6M': { position: 5, label: '6' },
  '7m': { position: 6, label: 'b7' },
  '7M': { position: 6, label: '7' },
  '8P': { position: 0, label: '1' },
  // Extensions that map back to base position
  '9m': { position: 1, label: 'b9' },
  '9M': { position: 1, label: '2' },
  '9A': { position: 1, label: '#9' },
  '11P': { position: 3, label: '4' },
  '11A': { position: 3, label: '#4' },
  '13m': { position: 5, label: 'b6' },
  '13M': { position: 5, label: '6' },
};

// Preferred enharmonic names for display (flats for flat keys feel, sharps otherwise)
function normalizeNote(note: string): string {
  const enharmonics: Record<string, string> = {
    'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
  };
  return enharmonics[note] ?? note;
}

// Chromatic pitch class 0–11 for enharmonic comparison
function pitchClass(note: string): number {
  const pc = Note.chroma(note);
  return pc ?? -1;
}

// ── Chord parsing ──────────────────────────────────────────────────────────

export function parseChord(symbol: string): ParsedChord | null {
  if (!symbol.trim()) return null;

  // Normalize common alternate notations
  const normalized = symbol
    .replace(/Δ|△|∆/g, 'maj7')
    .replace(/°/g, 'dim')
    .replace(/ø/g, 'm7b5')
    .replace(/−/g, 'm');

  const chord = Chord.get(normalized);
  if (chord.empty || !chord.tonic || chord.notes.length === 0) return null;

  const degrees: ChordDegree[] = [];
  const usedPositions = new Set<number>();

  chord.intervals.forEach((interval, i) => {
    const mapping = INTERVAL_TO_DEGREE[interval];
    if (!mapping) return;

    // If two intervals map to same position (e.g. #3 and 4), skip the later one
    if (usedPositions.has(mapping.position)) return;
    usedPositions.add(mapping.position);

    degrees.push({
      position: mapping.position,
      label: mapping.label,
      note: chord.notes[i] ?? '',
    });
  });

  // Sort by position
  degrees.sort((a, b) => a.position - b.position);

  return { symbol: chord.symbol || normalized, root: chord.tonic, degrees };
}

// ── Scale matching ─────────────────────────────────────────────────────────

// Scales to search — a focused but comprehensive list
// Ordered common→exotic; sort priority uses index in this array
const SCALE_TYPES = [
  // Core diatonic + pentatonic (every musician knows these)
  'major', 'minor', 'major pentatonic', 'minor pentatonic', 'blues',
  // Modes (well-known)
  'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
  // Jazz fundamentals
  'melodic minor', 'harmonic minor', 'harmonic major',
  'whole tone', 'diminished', 'half-whole diminished',
  // Jazz modes (intermediate)
  'lydian dominant', 'altered', 'phrygian dominant',
  'dorian b2', 'lydian augmented', 'mixolydian b6', 'locrian #2', 'super locrian',
  // Bebop
  'bebop major', 'bebop dominant', 'bebop minor', 'bebop dorian',
  // Exotic / world
  'double harmonic major', 'hungarian minor', 'hungarian major',
  'neapolitan minor', 'neapolitan major', 'lydian #2',
];

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function findScaleMatches(chordNotes: string[], topN = 3): ScaleMatch[] {
  if (chordNotes.length === 0) return [];

  const chordPCs = chordNotes.map(pitchClass).filter(pc => pc >= 0);
  const results: ScaleMatch[] = [];

  for (const root of ROOTS) {
    for (const scaleType of SCALE_TYPES) {
      const scale = Scale.get(`${root} ${scaleType}`);
      if (!scale.notes || scale.notes.length === 0) continue;

      const scalePCs = new Set(scale.notes.map(pitchClass).filter(pc => pc >= 0));

      const matched: string[] = [];
      const outside: string[] = [];

      for (let i = 0; i < chordNotes.length; i++) {
        const pc = chordPCs[i];
        if (pc < 0) continue;
        if (scalePCs.has(pc)) {
          matched.push(chordNotes[i]);
        } else {
          outside.push(chordNotes[i]);
        }
      }

      const overlap = chordPCs.length > 0 ? matched.length / chordPCs.length : 0;
      if (overlap === 0) continue;

      // Degree labels for a 7-note scale: 1 2 b3/3 4 #4/b5/5 b6/6 b7/7
      const scaleIntervals = scale.intervals ?? [];
      const scaleDegrees = scaleIntervals.map(iv => INTERVAL_TO_DEGREE[iv]?.label ?? iv);

      results.push({
        name: scale.name,
        root,
        overlap,
        matchedNotes: matched,
        outsideNotes: outside,
        scaleNotes: scale.notes,
        scaleDegrees,
      });
    }
  }

  // Sort: perfect matches first, then by overlap desc, then by scale type priority
  results.sort((a, b) => {
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    // Exact match: "C major" = root + " " + type
    const aIdx = SCALE_TYPES.findIndex(t => a.name === `${a.root} ${t}`);
    const bIdx = SCALE_TYPES.findIndex(t => b.name === `${b.root} ${t}`);
    const ai = aIdx === -1 ? SCALE_TYPES.length : aIdx;
    const bi = bIdx === -1 ? SCALE_TYPES.length : bIdx;
    return ai - bi;
  });

  // Deduplicate by note set (enharmonic equivalents produce duplicate matches)
  const seen = new Set<string>();
  const deduped: ScaleMatch[] = [];
  for (const match of results) {
    const key = `${match.overlap}:${match.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(match);
    }
  }

  // Return: all 100% matches + top N partial
  const perfect = deduped.filter(m => m.overlap === 1);
  const partial = deduped.filter(m => m.overlap < 1).slice(0, topN);

  return [...perfect.slice(0, 6), ...partial];
}

// ── Roman numeral analysis ────────────────────────────────────────────────

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export function chordDegreeInScale(chordRoot: string, scaleNotes: string[]): string | null {
  const rootPC = pitchClass(chordRoot);
  if (rootPC < 0) return null;
  const idx = scaleNotes.findIndex(n => pitchClass(n) === rootPC);
  return idx >= 0 ? (ROMAN[idx] ?? null) : null;
}

// ── Shared notes ───────────────────────────────────────────────────────────

export function findSharedNotes(notesA: string[], notesB: string[]): Set<number> {
  const pcsB = new Set(notesB.map(pitchClass).filter(pc => pc >= 0));
  const shared = new Set<number>();
  for (const note of notesA) {
    const pc = pitchClass(note);
    if (pc >= 0 && pcsB.has(pc)) shared.add(pc);
  }
  return shared;
}
