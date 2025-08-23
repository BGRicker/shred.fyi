import { Chord, Scale } from 'tonal';

export interface ScaleSuggestion {
  name: string;
  notes: string[];
  intervals: string[];
  quality: 'perfect' | 'good' | 'possible';
}

/**
 * Get scale suggestions for a given chord
 */
export function getScaleSuggestions(chordSymbol: string): ScaleSuggestion[] {
  try {
    const chord = Chord.get(chordSymbol);
    const chordNotes = chord.notes;
    const chordRoot = chord.tonic;

    if (!chordRoot || chordNotes.length === 0) {
      return [];
    }

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

      // Universal scales that work with most chords
      { scale: 'chromatic', quality: 'possible' as const },
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

  } catch (error) {
    console.error('Error getting scale suggestions:', error);
    return [];
  }
}

/**
 * Calculate how well a scale fits with a chord (0-1 score)
 */
function calculateScaleCompatibility(chordNotes: string[], scaleNotes: string[]): number {
  if (chordNotes.length === 0 || scaleNotes.length === 0) return 0;

  const chordNoteSet = new Set(chordNotes.map(note => note.replace(/\d+/, '')));
  const scaleNoteSet = new Set(scaleNotes.map(note => note.replace(/\d+/, '')));

  let matches = 0;
  for (const note of chordNoteSet) {
    if (scaleNoteSet.has(note)) {
      matches++;
    }
  }

  return matches / chordNotes.length;
}

/**
 * Get the key signature for a scale
 */
export function getKeySignature(scaleName: string): string {
  try {
    const scale = Scale.get(scaleName);
    return scale.tonic || '';
  } catch (error) {
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
  } catch (error) {
    return chordSymbol;
  }
}
