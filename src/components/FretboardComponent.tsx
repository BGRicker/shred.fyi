'use client';

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  calculateInterval,
  getChordTones,
  getFretNote,
  getScaleDegree,
  isSameNote,
  normalizeNoteToSharp,
  ScaleTypeKey,
  STANDARD_TUNING,
} from '@/lib/fretboardUtils';

type HighlightMode = 'chord' | 'progression' | 'both';

interface FretboardComponentProps {
  strings?: number[];
  highlightedNotes?: string[];
  highlightMode?: HighlightMode;
  rootNotes?: string[];
  progressionScaleName?: string;
  chordMomentScaleName?: string;
  chordMomentNotes?: string[];
  currentChordName?: string | null;
  className?: string;
}

interface ScaleInfo {
  name: string;
  root: string;
  notes: string[];
}

interface NoteInfo {
  note: string;
  isRoot: boolean;
  isThird: boolean;
  isFifth: boolean;
  scaleDegreeLabel: string;
}

const getScaleTypeKey = (scaleName?: string): ScaleTypeKey => {
  if (!scaleName) return 'minorPentatonic';
  const name = scaleName.toLowerCase();
  if (name.includes('blues')) return 'blues';
  if (name.includes('mixolydian')) return 'mixolydian';
  if (name.includes('dorian')) return 'dorian';
  if (name.includes('major pentatonic')) return 'majorPentatonic';
  if (name.includes('minor pentatonic')) return 'minorPentatonic';
  if (name.includes('major')) return 'major';
  if (name.includes('minor')) return 'minor';
  return 'minorPentatonic';
};

const parseChordTones = (currentChordName?: string | null) => {
  if (!currentChordName) return null;
  const match = currentChordName.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return null;
  const [, root, type] = match;
  return getChordTones(root, type.trim());
};

function buildScaleInfo({
  highlightMode,
  progressionScaleName,
  chordMomentScaleName,
  progressionNotes,
  chordNotes,
  rootNotes,
}: {
  highlightMode: HighlightMode;
  progressionScaleName?: string;
  chordMomentScaleName?: string;
  progressionNotes: string[];
  chordNotes: string[];
  rootNotes: string[];
}): ScaleInfo | null {
  if (highlightMode === 'chord' && chordNotes.length > 0) {
    return {
      name: chordMomentScaleName || 'Chord Scale',
      root: normalizeNoteToSharp(rootNotes[0] || chordNotes[0] || 'A'),
      notes: chordNotes.map(normalizeNoteToSharp),
    };
  }

  if (progressionNotes.length > 0) {
    return {
      name: progressionScaleName || 'Progression Scale',
      root: normalizeNoteToSharp(rootNotes[0] || progressionNotes[0] || 'A'),
      notes: progressionNotes.map(normalizeNoteToSharp),
    };
  }

  return null;
}

export default function FretboardComponent({
  highlightedNotes = [],
  chordMomentNotes = [],
  rootNotes = [],
  progressionScaleName,
  chordMomentScaleName,
  highlightMode = 'both',
  currentChordName,
  className = '',
}: FretboardComponentProps) {
  const scale = useMemo(
    () =>
      buildScaleInfo({
        highlightMode,
        progressionScaleName,
        chordMomentScaleName,
        progressionNotes: highlightedNotes,
        chordNotes: chordMomentNotes,
        rootNotes,
      }),
    [
      highlightMode,
      progressionScaleName,
      chordMomentScaleName,
      highlightedNotes,
      chordMomentNotes,
      rootNotes,
    ],
  );

  const chordTones = useMemo(() => {
    const parsed = parseChordTones(currentChordName);
    if (parsed) return parsed;

    if (scale) {
      const name = scale.name.toLowerCase();
      const isMinorish = name.includes('minor') || name.includes('dorian') || name.includes('phrygian') || name.includes('blues');
      const inferredType = isMinorish ? 'm' : '';
      return getChordTones(scale.root, inferredType);
    }

    return null;
  }, [currentChordName, scale]);

  const scaleTypeKey = useMemo(
    () => getScaleTypeKey(scale?.name),
    [scale?.name],
  );

  const numFrets = 16;
  const numStrings = STANDARD_TUNING.length;
  const fretWidth = 70;
  const stringSpacing = 48;

  const getNoteInfo = (stringIndex: number, fret: number): NoteInfo | null => {
    if (!scale) return null;
    const note = getFretNote(stringIndex, fret);
    const normalized = normalizeNoteToSharp(note);

    const inScale = scale.notes.some(n => isSameNote(n, normalized));

    const scaleDegreeInfo = getScaleDegree(normalized, scale.root, scaleTypeKey);
    const isRoot = isSameNote(normalized, scale.root);
    const isThird = chordTones ? isSameNote(normalized, chordTones.third) : false;
    const isFifth = chordTones ? isSameNote(normalized, chordTones.fifth) : false;

    // Show chord tones even if they sit outside the active scale (e.g., blues major 3rd over minor pentatonic)
    // so you always see the 3rd/5th. Non-chord tones that are also out of the scale remain hidden to reduce clutter.
    if (!inScale && !isRoot && !isThird && !isFifth) return null;

    return {
      note,
      isRoot,
      isThird,
      isFifth,
      scaleDegreeLabel: scaleDegreeInfo?.degreeLabel || '',
    };
  };

  if (!scale) {
    return (
      <div className={`w-full bg-white/80 rounded-3xl p-6 border border-amber-200 ${className}`}>
        <p className="text-amber-800/70">No scale data yet. Record a progression to see the fretboard.</p>
      </div>
    );
  }

  return (
    <div
      className={`w-full bg-gradient-to-br from-amber-50 via-yellow-50/80 to-amber-50 backdrop-blur-md rounded-3xl p-8 shadow-2xl shadow-amber-900/20 border-2 border-amber-200 ${className}`}
    >
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h2 className="text-amber-900">Fretboard Visualization</h2>
          <p className="text-sm text-amber-800/70">
            {highlightMode === 'chord' && chordMomentScaleName
              ? `Chord of the moment: ${chordMomentScaleName}`
              : `Scale: ${scale.name}`}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs flex-wrap bg-white/70 px-4 py-2 rounded-2xl border border-amber-200/80">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-600 shadow-lg shadow-green-600/50 flex items-center justify-center text-[10px] text-white">
              1
            </div>
            <span className="text-amber-800">Root</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-500 shadow-lg shadow-amber-600/40 flex items-center justify-center text-[10px] text-white">
              ♭3/3
            </div>
            <span className="text-amber-800">Chord 3rd</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-teal-500 shadow-lg shadow-teal-600/40 flex items-center justify-center text-[10px] text-white">
              5
            </div>
            <span className="text-amber-800">Chord 5th</span>
          </div>
          <div className="h-6 w-px bg-amber-300/70" />
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-200 border border-amber-400 flex items-center justify-center text-[9px] text-amber-700">
              ●
            </div>
            <span className="text-amber-800/70">Other scale notes</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-gradient-to-b from-amber-900/10 to-amber-800/5 rounded-2xl p-4 border border-amber-200/50">
        <div className="inline-block min-w-full">
          <div className="flex mb-3 ml-16">
            {Array.from({ length: numFrets }).map((_, fretIndex) => (
              <div
                key={fretIndex}
                className="flex-shrink-0 text-center text-xs text-amber-700/60"
                style={{ width: `${fretWidth}px` }}
              >
                {fretIndex === 0 ? '' : fretIndex}
              </div>
            ))}
          </div>

          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-14 flex flex-col justify-around py-2">
              {Array.from({ length: numStrings }).map((_, stringIndex) => (
                <div key={stringIndex} className="text-right pr-3 text-sm text-amber-800/80">
                  {STANDARD_TUNING[stringIndex]}
                </div>
              ))}
            </div>

            <div
              className="ml-14 relative bg-gradient-to-r from-amber-200/30 to-yellow-100/30 rounded-xl p-2"
              style={{ height: `${stringSpacing * numStrings}px` }}
            >
              <div className="absolute inset-0 flex">
                {Array.from({ length: numFrets }).map((_, fretIndex) => (
                  <div
                    key={fretIndex}
                    className="flex-shrink-0 relative"
                    style={{ width: `${fretWidth}px` }}
                  >
                    {fretIndex > 0 && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400/60 via-amber-500/70 to-amber-400/60 shadow-sm" />
                    )}
                  </div>
                ))}
              </div>

              <div className="absolute inset-0 flex flex-col justify-around py-2">
                {Array.from({ length: numStrings }).map((_, stringIndex) => (
                  <div
                    key={stringIndex}
                    className="relative bg-gradient-to-r from-amber-700/50 via-amber-600/60 to-amber-700/50 shadow-sm"
                    style={{ height: `${1 + stringIndex * 0.3}px` }}
                  />
                ))}
              </div>

              <div className="absolute inset-0 flex flex-col justify-around py-2">
                {Array.from({ length: numStrings }).map((_, stringIndex) => (
                  <div
                    key={stringIndex}
                    className="relative flex"
                    style={{ height: `${stringSpacing}px` }}
                  >
                    {Array.from({ length: numFrets }).map((_, fretIndex) => {
                      const noteInfo = getNoteInfo(stringIndex, fretIndex);

                      return (
                        <div
                          key={fretIndex}
                          className="flex-shrink-0 relative flex items-center justify-center"
                          style={{ width: `${fretWidth}px` }}
                        >
                          {noteInfo && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{
                                duration: 0.2,
                                delay: (stringIndex * numFrets + fretIndex) * 0.01,
                              }}
                              className="relative z-10"
                            >
                              {noteInfo.isRoot ? (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex flex-col items-center justify-center cursor-default border-[3px] text-white shadow-xl ring-2 ring-green-400/20">
                                  <span className="text-sm leading-none">{noteInfo.note}</span>
                                  <span className="text-[10px] leading-none mt-0.5 opacity-95">
                                    {noteInfo.scaleDegreeLabel}
                                  </span>
                                </div>
                              ) : noteInfo.isThird || noteInfo.isFifth ? (
                                <div
                                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${
                                    noteInfo.isThird
                                      ? 'from-amber-500 to-amber-600 border-amber-400 shadow-amber-600/50'
                                      : 'from-teal-500 to-teal-600 border-teal-400 shadow-teal-600/50'
                                   } flex flex-col items-center justify-center cursor-default border-[3px] text-white shadow-xl ring-2 ${
                                     noteInfo.isThird ? 'ring-amber-400/20' : 'ring-teal-400/20'
                                   }`}
                                 >
                                  <span className="text-sm leading-none">{noteInfo.note}</span>
                                  <span className="text-[10px] leading-none mt-0.5 opacity-95">
                                    {noteInfo.scaleDegreeLabel}
                                  </span>
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-amber-100 border-2 border-amber-300/60 flex flex-col items-center justify-center cursor-default text-amber-700 shadow-sm">
                                  <span className="text-sm leading-none">{noteInfo.note}</span>
                                  <span className="text-[10px] leading-none mt-0.5 opacity-80">
                                    {noteInfo.scaleDegreeLabel}
                                  </span>
                                </div>
                              )}
                            </motion.div>
                          )}

                          {!noteInfo && stringIndex === 2 && [3, 5, 7, 9, 15].includes(fretIndex) && fretIndex < numFrets && (
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/30 opacity-60" />
                          )}
                          {!noteInfo &&
                            stringIndex === 2 &&
                            [12].includes(fretIndex) &&
                            fretIndex < numFrets && (
                              <div className="w-2.5 h-2.5 rounded-full bg-amber-400/40 opacity-80" />
                            )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {scale.notes.length > 0 && (
        <div className="mt-4 p-4 bg-white/80 rounded-2xl border border-amber-200/80 shadow-sm">
          <h4 className="text-sm font-semibold text-amber-900 mb-3">
            {highlightMode === 'chord' ? 'Chord of the moment notes' : 'Scale notes'}
          </h4>
          <div className="flex flex-wrap gap-2">
            {(highlightMode === 'chord' && chordMomentNotes.length > 0
              ? chordMomentNotes
              : scale.notes
            ).map((note, index) => {
              const normalizedNote = normalizeNoteToSharp(note);
              const isRootNote = rootNotes.map(normalizeNoteToSharp).includes(normalizedNote);
              const rootNote = rootNotes[0] ? normalizeNoteToSharp(rootNotes[0]) : scale.root;
              const interval = calculateInterval(normalizedNote, rootNote);
              return (
                <span
                  key={index}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border shadow-sm transition-all ${
                    isRootNote
                      ? 'bg-green-100 text-green-800 border-green-300 shadow-green-100'
                      : 'bg-white text-amber-900 border-amber-200 hover:border-amber-300'
                  }`}
                  title={`${note} - ${interval} from ${rootNote}`}
                >
                  {note}{' '}
                  <span className="opacity-60 text-xs ml-1">({interval})</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
