import { Chord, Scale, Note, Key } from 'tonal';
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
  context?: { progression?: string[], progressionType?: 'blues' | 'major' | 'minor' | 'other'; tonic?: string }
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
      const progressionRoot = context.tonic || Chord.get(context.progression[0]).tonic;

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
        { scale: 'major pentatonic', quality: 'good' as const },
        { scale: 'minor pentatonic', quality: 'good' as const },
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
          quality: compatibility >= 0.7 ? template.quality : 'possible'
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
    const progressionMeta = detectProgressionType(chordSymbols);
    const chordScales = getScaleSuggestions(currentChord, {
      progression: chordSymbols,
      progressionType: progressionMeta.progressionType,
      tonic: progressionMeta.tonic || undefined
    });

    // Analyze the progression type and find progression-wide scales
    const progressionType = progressionMeta.progressionType;
    const progressionScales = getProgressionWideScales(chordSymbols, progressionType, progressionMeta.tonic);

    // Determine key signature
    const keySignature = progressionMeta.tonic || '';

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
 * Detect the type of chord progression and tonic (ordered, no dedupe)
 */
function detectProgressionType(chordSymbols: string[]): { progressionType: 'blues' | 'major' | 'minor' | 'other'; tonic: string | null } {
  if (chordSymbols.length === 0) return { progressionType: 'other', tonic: null };

  const roots = chordSymbols.map(s => Chord.get(s).tonic).filter(Boolean) as string[];
  const uniqueRoots = new Set(roots);
  const firstRoot = roots[0];
  const lastRoot = roots[roots.length - 1];
  const uniqueChords = Array.from(new Set(chordSymbols));

  // 1. Gather all unique chromatics from the progression
  // const chromatics = new Set<string>();
  // chordSymbols.forEach(symbol => {
  //   const chord = Chord.get(symbol);
  //   chord.notes.forEach(n => {
  //     const chroma = Note.chroma(n);
  //     if (typeof chroma === 'number') chromatics.add(String(chroma));
  //   });
  // });

  // 2. Score all 12 major and minor keys
  let bestKey = { tonic: '', type: 'other' as 'major' | 'minor' | 'other', score: -1 };

  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  notes.forEach(root => {
    // Check Major
    const majorKey = Key.majorKey(root);
    const majorScore = calculateChordFitScore(uniqueChords, { ...majorKey, type: 'major' });
    const majorFinal = applyHeuristics(majorScore, root, uniqueRoots, firstRoot, lastRoot);

    if (majorFinal > bestKey.score) {
      bestKey = { tonic: root, type: 'major', score: majorFinal };
    }

    // Check Minor
    const minorKey = Key.minorKey(root);
    // Minor keys in Tonal are complex (natural, harmonic, melodic). 
    // For pop/rock/jazz compatibility, natural minor + harmonic V7 is standard.
    // We'll check against natural minor chords + secondary dominants if available (Tonal minorKey has less data than majorKey usually).
    const minorScore = calculateChordFitScore(uniqueChords, { ...minorKey, type: 'minor' });
    const minorFinal = applyHeuristics(minorScore, root, uniqueRoots, firstRoot, lastRoot);

    if (minorFinal > bestKey.score) {
      bestKey = { tonic: root, type: 'minor', score: minorFinal };
    }
  });

  if (bestKey.tonic) {
    return { progressionType: bestKey.type, tonic: bestKey.tonic };
  }

  // Fallback
  return { progressionType: 'other', tonic: firstRoot || null };
}

function applyHeuristics(baseScore: number, keyRoot: string, uniqueRoots: Set<string>, firstRoot: string, lastRoot: string): number {
  let score = baseScore;

  // Bonus: Key tonic is present in the progression
  if (uniqueRoots.has(keyRoot)) score += 0.25;

  // Bonus: Start on tonic (Primary indicator for modern loops/blues)
  // Increased to overpowering weight to prevent V-I ambiguity (e.g. A7-D7 looking like V-I in D)
  if (keyRoot === firstRoot) score += 0.35;

  // Bonus: End on tonic (weaker indicator in infinite loops)
  if (keyRoot === lastRoot) score += 0.10;

  return score;
}

function calculateChordFitScore(progressionChords: string[], keyData: any): number {
  let matchCount = 0;
  // valid chords: diatonic chords + secondary dominants
  // Note: Tonal's chords are often specific voicings ("Cmaj7"), but user might play "C".
  // We should check root and function/quality compatibility.

  // Flatten valid chords from keyData
  const validChords = new Set<string>();

  // Add diatonic chords
  (keyData.chords || keyData.natural?.chords || []).forEach((c: string) => validChords.add(c));

  // Add secondary dominants (only available on majorKey consistently in some versions, check field existence)
  if (keyData.secondaryDominants) {
    keyData.secondaryDominants.forEach((c: string) => { if (c) validChords.add(c); });
  }

  // Helper to normalize chord for comparison: Root + Quality roughly
  // Or just check if the progression chord is "Functional" in this key.

  // Simple approach: Check if chord ROOT is in scale, and if chord notes fit well?
  // User wants "Tonal" logic, so let's trust Tonal's lists.

  // If exact match fails, fallback to Root check? 
  // No, A7 vs Amaj7 is distinct.

  // Let's iterate progression chords and see if they "fit"
  progressionChords.forEach(pch => {
    // Check exact match (ignoring extensions sometimes?)
    // Simplify: check if PC is in validChords set.
    // Normalize both to remove potential formatting diffs?
    // Tonal normalized output: "Cmaj7", "Dm7".
    // Input might be "C", "Cmaj7", "C7".

    // If input is "A7" and valid has "A7", that's a match.
    // If input is "D7" and valid has "D7", match.

    const pChord = Chord.get(pch); // normalized
    const pName = pChord.symbol; // e.g. "A7"
    const pSimplified = pName.replace('7', ''); // "A" for simple triad check?

    let isMatch = false;

    // 1. Direct check in valid list
    for (const valid of validChords) {
      if (valid === pName) { isMatch = true; break; }

      // Check if it's the triad version (e.g. valid Cmaj7, playing C)
      if (valid.startsWith(pName)) { isMatch = true; break; }

      // Check if it's the 7th version (e.g. valid C, playing Cmaj7? Less likely to fit perfectly but usually okay)
    }

    // 2. Special handling for Blues allowance in Major Key
    if (!isMatch) {
      if (keyData.type === 'major') {
        // I7 - Blues Tonic
        if (pChord.tonic === keyData.tonic && (pChord.type === 'dominant seventh' || pChord.aliases.includes('7'))) {
          isMatch = true;
        }

        // IV7
        const tonic = keyData.tonic;
        const ivRoot = Note.transpose(tonic, '4P');
        if (pChord.tonic === ivRoot && (pChord.type === 'dominant seventh' || pChord.aliases.includes('7'))) {
          isMatch = true;
        }

        // bVII7 (Mixolydian borrowing) - frequent in Rock/Blues
        const bVIIRoot = Note.transpose(tonic, 'm7');
        if (pChord.tonic === bVIIRoot) {
          isMatch = true;
        }
      }
    }

    if (isMatch) matchCount++;
  });

  return progressionChords.length > 0 ? matchCount / progressionChords.length : 0;
}

/**
 * Get scales that work over the entire progression
 */
function getProgressionWideScales(chordSymbols: string[], progressionType: 'blues' | 'major' | 'minor' | 'other', tonicOverride?: string | null): ScaleSuggestion[] {
  const suggestions: ScaleSuggestion[] = [];

  try {
    // For blues progressions, recommend blues scales and pentatonic scales
    if (progressionType === 'blues') {
      // Find the root chord (usually the first chord)
      const rootNote = tonicOverride || Chord.get(chordSymbols[0]).tonic;

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
      const rootNote = (tonicOverride || chordSymbols[0]).replace('7', '').replace('m', '');

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

/**
 * Get Roman Numeral for a chord in a given key
 */
export function getRomanNumeral(chordSymbol: string, key: string): string {
  try {
    const chord = Chord.get(chordSymbol);
    const keyNote = Note.get(key);

    if (chord.empty || keyNote.empty) return '';

    const root = chord.tonic;
    if (!root) return '';

    // Calculate interval from key to chord root
    // Using chroma simplifies the handling of accidentals for display
    const rootChrom = Note.chroma(root);
    const keyChrom = Note.chroma(key);

    if (rootChrom === undefined || keyChrom === undefined) return '';

    const diff = (rootChrom - keyChrom + 12) % 12;

    const numeralMap: Record<number, string> = {
      0: 'I',
      1: 'bII',
      2: 'II',
      3: 'bIII',
      4: 'III',
      5: 'IV',
      6: 'bV',
      7: 'V',
      8: 'bVI',
      9: 'VI',
      10: 'bVII',
      11: 'VII'
    };

    let baseNumeral = numeralMap[diff] || '?';
    const quality = chord.quality;

    // Lowercase for minor/diminished
    if (quality === 'Minor' || quality === 'Diminished') {
      baseNumeral = baseNumeral.toLowerCase();
    }

    // Add 7 if it's a 7th chord (dominant, major 7, minor 7)
    // This is optional but nice. Let's keep it simple for now as requested (intervals off root)

    return baseNumeral;
  } catch {
    return '';
  }
}
