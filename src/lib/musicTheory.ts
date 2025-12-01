import { Chord, Scale, Note } from 'tonal';
import { ScaleSuggestion } from '@/types/music';

// Result of analyzing a chord progression
export interface ProgressionAnalysis {
  chordScales: ScaleSuggestion[];
  progressionScales: ScaleSuggestion[];
  keySignature: string;
  progressionType: 'blues' | 'major' | 'minor' | 'other';
}

/**
 * Get scale suggestions for a given chord
 */
export function getScaleSuggestions(
  chordSymbol: string,
  context?: { progression?: string[], progressionType?: 'blues' | 'major' | 'minor' | 'other' }
): ScaleSuggestion[] {
  try {
    const chord = Chord.get(chordSymbol);
    const chordNotes = chord.notes;
    const chordRoot = chord.tonic;

    if (!chordRoot || chordNotes.length === 0) {
      return [];
    }

    // --- START: CONTEXT-AWARE BLUES LOGIC ---
    if (context?.progressionType === 'blues' && context.progression && context.progression.length > 0) {
      const progressionRoot = Chord.get(context.progression[0]).tonic;

      if (progressionRoot) {
        const suggestions: ScaleSuggestion[] = [];

        // Root minor pentatonic is the classic blues choice: mark as perfect.
        const rootMinorPentatonic = Scale.get(`${progressionRoot} minor pentatonic`);
        if (rootMinorPentatonic.notes.length > 0) {
          suggestions.push({ ...rootMinorPentatonic, quality: 'perfect' });
        }

        // Root blues scale is also a staple: mark as perfect.
        const rootBlues = Scale.get(`${progressionRoot} blues`);
        if (rootBlues.notes.length > 0) {
          suggestions.push({ ...rootBlues, quality: 'perfect' });
        }

        // Mixolydian over the current chord: strong momentary choice.
        const chordMixolydian = Scale.get(`${chordRoot} mixolydian`);
        if (chordMixolydian.notes.length > 0) {
          suggestions.push({ ...chordMixolydian, quality: 'good' });
        }

        // Minor pentatonic for the current chord: also solid.
        const chordMinorPentatonic = Scale.get(`${chordRoot} minor pentatonic`);
        if (chordMinorPentatonic.notes.length > 0) {
          suggestions.push({ ...chordMinorPentatonic, quality: 'good' });
        }

        // Major pentatonic on the progression root for brighter blues.
        const rootMajorPentatonic = Scale.get(`${progressionRoot} major pentatonic`);
        if (rootMajorPentatonic.notes.length > 0) {
          suggestions.push({ ...rootMajorPentatonic, quality: 'good' });
        }

        return suggestions
          .filter((suggestion, index, arr) => arr.findIndex(s => s.name === suggestion.name) === index)
          .sort((a, b) => {
            const qualityOrder = { perfect: 0, good: 1, possible: 2 };
            return qualityOrder[a.quality] - qualityOrder[b.quality];
          });
      }
    }
    // --- END: CONTEXT-AWARE BLUES LOGIC ---

    const suggestions: ScaleSuggestion[] = [];

    // Define scales to check with their qualities for different chord types
    const scaleTemplates = [
      // Major chord scales
      ...(chord.quality === 'Major' ? [
        { scale: 'major', quality: 'perfect' as const },
        { scale: 'mixolydian', quality: 'good' as const },
        { scale: 'lydian', quality: 'good' as const },
        { scale: 'major pentatonic', quality: 'perfect' as const },
        { scale: 'blues', quality: 'possible' as const },
      ] : []),

      // Minor chord scales  
      ...(chord.quality === 'Minor' ? [
        { scale: 'natural minor', quality: 'perfect' as const },
        { scale: 'dorian', quality: 'good' as const },
        { scale: 'phrygian', quality: 'good' as const },
        { scale: 'minor pentatonic', quality: 'perfect' as const },
        { scale: 'blues', quality: 'good' as const },
        { scale: 'harmonic minor', quality: 'good' as const },
      ] : []),

      // Seventh chord scales (dominant 7ths)
      ...(chord.type === 'dominant seventh' ? [
        { scale: 'mixolydian', quality: 'perfect' as const },
        { scale: 'blues', quality: 'perfect' as const },
        { scale: 'minor pentatonic', quality: 'good' as const },
        { scale: 'major pentatonic', quality: 'good' as const },
        { scale: 'bebop dominant', quality: 'good' as const },
      ] : []),
    ];

    // Generate scale suggestions
    for (const template of scaleTemplates) {
      const scale = Scale.get(`${chordRoot} ${template.scale}`);

      if (scale.notes.length > 0) {
        // Check how well the scale fits the chord
        const compatibility = calculateScaleCompatibility(chordNotes, scale.notes);

        suggestions.push({
          name: scale.name,
          notes: scale.notes,
          intervals: scale.intervals,
          quality: compatibility >= 0.8 ? template.quality : 'possible'
        });
      }
    }

    // Sort by quality and remove duplicates
    return suggestions
      .filter((suggestion, index, arr) =>
        arr.findIndex(s => s.name === suggestion.name) === index
      )
      .sort((a, b) => {
        const qualityOrder = { perfect: 0, good: 1, possible: 2 };
        return qualityOrder[a.quality] - qualityOrder[b.quality];
      })
      .slice(0, 6); // Limit to top 6 suggestions

  } catch {
    return [];
  }
}

/**
 * Analyze an entire chord progression and suggest scales that work over the whole progression
 */
export function analyzeProgression(chordSymbols: string[]): ProgressionAnalysis {
  if (chordSymbols.length === 0) {
    return {
      chordScales: [],
      progressionScales: [],
      keySignature: '',
      progressionType: 'other'
    };
  }

  try {
    // Get scales for the current chord
    const currentChord = chordSymbols[chordSymbols.length - 1];
    const chordScales = getScaleSuggestions(currentChord);

    // Analyze the progression type and find progression-wide scales
    const progressionType = detectProgressionType(chordSymbols);
    const progressionScales = getProgressionWideScales(chordSymbols, progressionType);

    // Determine key signature
    const keySignature = determineKeySignature(chordSymbols, progressionType);

    return {
      chordScales,
      progressionScales,
      keySignature,
      progressionType
    };
  } catch (error) {
    console.error('Progression analysis failed:', error);
    return {
      chordScales: [],
      progressionScales: [],
      keySignature: '',
      progressionType: 'other'
    };
  }
}

/**
 * Detect the type of chord progression
 */
function detectProgressionType(chordSymbols: string[]): 'blues' | 'major' | 'minor' | 'other' {
  if (chordSymbols.length < 2) return 'other';

  // Use Tonal.js to robustly get the tonic of each chord.
  const rootNotes = [...new Set(chordSymbols.map(s => Chord.get(s).tonic).filter(Boolean))] as string[];

  // Check for common blues progression root patterns (I-IV-V)
  const bluesRoots = [
    ['A', 'D', 'E'], ['C', 'F', 'G'], ['G', 'C', 'D'],
    ['E', 'A', 'B'], ['B', 'E', 'F#'], ['D', 'G', 'A'],
    ['F', 'Bb', 'C']
  ];

  for (const pattern of bluesRoots) {
    // Check if all the progression's root notes are a subset of this blues pattern.
    if (rootNotes.every(r => pattern.includes(r))) {
      // Check if at least two of the I, IV, V chords are present.
      if (rootNotes.length >= 2) {
        return 'blues';
      }
    }
  }

  // Check for major key progression (I-IV-V-vi)
  const majorPatterns = [
    ['C', 'F', 'G', 'Am'],
    ['G', 'C', 'D', 'Em'],
    ['D', 'G', 'A', 'Bm']
  ];

  for (const pattern of majorPatterns) {
    if (rootNotes.some(note => pattern.includes(note))) {
      const majorChordCount = rootNotes.filter(note => pattern.includes(note)).length;
      if (majorChordCount >= 3) {
        return 'major';
      }
    }
  }

  return 'other';
}

/**
 * Get scales that work over the entire progression
 */
function getProgressionWideScales(chordSymbols: string[], progressionType: 'blues' | 'major' | 'minor' | 'other'): ScaleSuggestion[] {
  const suggestions: ScaleSuggestion[] = [];

  try {
    // For blues progressions, recommend blues scales and pentatonic scales
    if (progressionType === 'blues') {
      // Find the root chord (usually the first chord)
      const rootChord = chordSymbols[0];
      const chordInfo = Chord.get(rootChord);
      const rootNote = chordInfo.tonic;

      if (rootNote) {
        // Minor Pentatonic is the most common, so we list it first.
        const minorPentatonic = Scale.get(`${rootNote} minor pentatonic`);
        const bluesScale = Scale.get(`${rootNote} blues`);
        const majorPentatonic = Scale.get(`${rootNote} major pentatonic`);

        if (minorPentatonic.notes.length > 0) {
          suggestions.push({
            name: minorPentatonic.name,
            notes: minorPentatonic.notes,
            intervals: minorPentatonic.intervals,
            quality: 'perfect'
          });
        }

        if (bluesScale.notes.length > 0) {
          suggestions.push({
            name: bluesScale.name,
            notes: bluesScale.notes,
            intervals: bluesScale.intervals,
            quality: 'perfect' // Blues scale is also a perfect fit
          });
        }

        if (majorPentatonic.notes.length > 0) {
          suggestions.push({
            name: majorPentatonic.name,
            notes: majorPentatonic.notes,
            intervals: majorPentatonic.intervals,
            quality: 'good'
          });
        }
      }
    }

    // For major progressions, recommend major scales and pentatonic
    if (progressionType === 'major') {
      const rootChord = chordSymbols[0];
      const rootNote = rootChord.replace('7', '').replace('m', '');

      const majorScale = Scale.get(`${rootNote} major`);
      const majorPentatonic = Scale.get(`${rootNote} major pentatonic`);

      if (majorScale.notes.length > 0) {
        suggestions.push({
          name: majorScale.name,
          notes: majorScale.notes,
          intervals: majorScale.intervals,
          quality: 'perfect'
        });
      }

      if (majorPentatonic.notes.length > 0) {
        suggestions.push({
          name: majorPentatonic.name,
          notes: majorPentatonic.notes,
          intervals: majorPentatonic.intervals,
          quality: 'perfect'
        });
      }
    }

  } catch (error) {
    console.error('Failed to get progression-wide scales:', error);
  }

  return suggestions;
}

/**
 * Determine the key signature for a progression
 */
function determineKeySignature(chordSymbols: string[], progressionType: 'blues' | 'major' | 'minor' | 'other'): string {
  if (chordSymbols.length === 0) return '';

  try {
    // For blues, the first chord is usually the key
    if (progressionType === 'blues') {
      const rootChord = chordSymbols[0];
      return rootChord.replace('7', '').replace('m', '');
    }

    // For major progressions, the first chord is usually the key
    if (progressionType === 'major') {
      const rootChord = chordSymbols[0];
      return rootChord.replace('7', '').replace('m', '');
    }

    // Fallback: use the first chord
    const firstChord = chordSymbols[0];
    return firstChord.replace('7', '').replace('m', '');
  } catch {
    return '';
  }
}

/**
 * Calculate how well a scale fits with a chord (0-1 score)
 */
function calculateScaleCompatibility(chordNotes: string[], scaleNotes: string[]): number {
  if (chordNotes.length === 0 || scaleNotes.length === 0) return 0;

  const chordNoteSet = new Set(chordNotes);
  const scaleNoteSet = new Set(scaleNotes);

  let matches = 0;

  for (const chordNote of chordNoteSet) {
    if (scaleNoteSet.has(chordNote)) {
      matches++;
    }
  }

  const compatibility = matches / chordNoteSet.size;
  return Math.max(0, compatibility);
}

/**
 * Get the key signature for a scale
 */
export function getKeySignature(scaleName: string): string {
  try {
    const scale = Scale.get(scaleName);
    return scale.tonic || '';
  } catch {
    return '';
  }
}

/**
 * Convert chord symbol to a more readable format
 */
export function formatChordName(chordSymbol: string): string {
  try {
    const chord = Chord.get(chordSymbol);
    return chord.symbol || chordSymbol;
  } catch {
    return chordSymbol;
  }
}

/**
 * Get comparable chords (extensions, substitutions) for a given chord
 */
export function getComparableChords(
  chordSymbol: string,
  options?: { progression?: string[] }
): string[] {
  try {
    const chord = Chord.get(chordSymbol);
    const root = chord.tonic || chordSymbol.match(/^([A-G][b#]?)/i)?.[1];
    if (!root) return [];

    const suggestions: string[] = [];
    const add = (value: string) => {
      if (!value) return;
      if (value.includes('undefined')) return;
      if (!suggestions.includes(value)) suggestions.push(value);
    };

    // Progression chords first (context-aware suggestions)
    (options?.progression ?? []).forEach(add);

    // Always include the simple 7th option for the root
    add(`${root}7`);
    add(`${root}`);

    // 1. Extensions (7, 9, 11, 13)
    if (chord.quality === 'Major') {
      add(`${root}maj7`);
      add(`${root}maj9`);
      add(`${root}6`);
      add(`${root}add9`);
    } else if (chord.quality === 'Minor') {
      add(`${root}m7`);
      add(`${root}m9`);
      add(`${root}m11`);
      add(`${root}m6`);
    } else {
      // Assume dominant/other if not major/minor
      add(`${root}9`);
      add(`${root}13`);
      add(`${root}7sus4`);
      add(`${root}7#9`);
    }

    // 2. Relative Major/Minor
  if (chord.quality === 'Major') {
    const relativeMinor = Note.transpose(root, '-3m');
    if (relativeMinor) {
      add(`${relativeMinor}m`);
      add(`${relativeMinor}m7`);
    }
  } else if (chord.quality === 'Minor') {
    const relativeMajor = Note.transpose(root, '3m');
    if (relativeMajor) {
      add(`${relativeMajor}`);
      add(`${relativeMajor}maj7`);
    }
  }

  // 3. Tritone Substitution (for Dominant chords)
  if (chord.type === 'dominant seventh' || chord.aliases.includes('7')) {
    const tritoneRoot = Note.transpose(root, '4A'); // Augmented 4th = Tritone
    if (tritoneRoot) {
      add(`${tritoneRoot}7`);
    }
  }

    // 4. Parallel Major/Minor
    if (chord.quality === 'Major') {
      add(`${root}m`);
      add(`${root}m7`);
    } else if (chord.quality === 'Minor') {
      add(`${root}`);
      add(`${root}maj7`);
    }

    return suggestions;
  } catch {
    return (options?.progression ?? []).filter(p => p !== chordSymbol);
  }
}
