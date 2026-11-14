'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import ChordBuilder from '@/components/ChordBuilder';
import { parseChord, findScaleMatches, findSharedNotes, chordDegreeInScale, type ParsedChord, type ScaleMatch } from '@/lib/chordTheory';

// ── Circle component ──────────────────────────────────────────────────────

interface CircleProps {
  position: number; // 0–6
  note?: string;
  label?: string; // degree label e.g. "b7"
  isShared?: boolean;
  mode: 'reveal' | 'quiz';
  revealed?: boolean;
  quizValue?: string;
  quizCorrect?: boolean | null; // null = not yet checked; undefined = ungraded (empty position)
  onQuizChange?: (val: string) => void;
  onQuizCheck?: () => void;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const DEGREE_LABELS = ['1', '2', '3', '4', '5', '6', '7'];

function Circle({
  position, note, label, isShared, mode, revealed,
  quizValue = '', quizCorrect = null, onQuizChange, onQuizCheck,
}: CircleProps) {
  const hasNote = !!note;
  const isQuiz = mode === 'quiz';

  let circleClass =
    'w-16 h-16 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ';

  if (!hasNote) {
    // Empty position — dashed border in both modes to distinguish from chord tones
    circleClass += 'border-dashed border-sky-300/70 text-sky-400/50 bg-sky-50/30';
  } else if (isShared) {
    circleClass += 'border-amber-500 text-amber-700 bg-amber-100 shadow-md';
  } else {
    circleClass += 'border-sky-600 text-sky-800 bg-white/80 shadow-sm';
  }

  const displayNote = () => {
    if (mode === 'reveal') {
      return hasNote ? <span className="text-base">{note}</span> : null;
    }
    // Quiz mode
    if (revealed) {
      if (hasNote) {
        // Chord tone: show with correct/incorrect color
        return (
          <span className={quizCorrect === false ? 'text-red-500' : 'text-green-600'}>
            {note}
          </span>
        );
      } else {
        // Empty position: just show what they entered, neutral
        return quizValue ? (
          <span className="text-sky-600">{quizValue}</span>
        ) : null;
      }
    }
    // Input for all positions in quiz mode
    return (
      <input
        type="text"
        value={quizValue}
        onChange={e => onQuizChange?.(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onQuizCheck?.()}
        className="w-10 bg-transparent text-center text-sm font-bold text-sky-800 outline-none border-b border-sky-400"
        placeholder="?"
        maxLength={3}
      />
    );
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-xs font-semibold ${hasNote ? 'text-sky-700' : 'text-sky-400/50'}`}>
        {ROMAN[position]}
      </span>
      <div className={circleClass}>{displayNote()}</div>
      <span className={`text-xs h-4 font-mono ${hasNote ? 'text-sky-600' : 'text-sky-400/40'}`}>
        {hasNote ? (label ?? DEGREE_LABELS[position]) : DEGREE_LABELS[position]}
      </span>
    </div>
  );
}

// ── Scale match row ───────────────────────────────────────────────────────

interface ChordRootLabel { symbol: string; root: string; }

function ScaleMatchRow({ match, isPerfect, chordRoots }: { match: ScaleMatch; isPerfect: boolean; chordRoots?: ChordRootLabel[] }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const pct = Math.round(match.overlap * 100);

  const romanLabels = chordRoots?.flatMap(({ symbol, root }) => {
    const roman = chordDegreeInScale(root, match.scaleNotes);
    return roman ? [{ symbol, roman }] : [];
  }) ?? [];

  return (
    <div className={`rounded-md text-sm overflow-hidden ${
      isPerfect
        ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
        : 'bg-white/50 border border-sky-100 text-sky-800'
    }`}>
      {/* Header row */}
      <button
        onClick={() => setNotesOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {isPerfect && <span className="text-emerald-500 text-xs">✓</span>}
          <span className="font-medium">{match.name}</span>
          <span className={`text-[10px] transition-transform duration-150 ${notesOpen ? 'rotate-90' : ''} ${isPerfect ? 'text-emerald-400' : 'text-sky-300'}`}>▶</span>
          {romanLabels.map(({ symbol, roman }) => (
            <span key={symbol} className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              isPerfect ? 'bg-emerald-200/70 text-emerald-700' : 'bg-sky-100 text-sky-600'
            }`}>
              {symbol} = {roman}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {match.outsideNotes.length > 0 && (
            <span className="text-red-500 text-xs">{match.outsideNotes.join(', ')} outside</span>
          )}
          <span className={`text-xs font-mono font-semibold ${isPerfect ? 'text-emerald-600' : 'text-sky-500'}`}>
            {pct}%
          </span>
        </div>
      </button>

      {/* Expandable notes */}
      {notesOpen && match.scaleNotes.length > 0 && (
        <div className={`px-3 pb-2.5 pt-1.5 border-t ${isPerfect ? 'border-emerald-200' : 'border-sky-100/60'}`}>
          <div className="flex flex-wrap gap-1.5">
            {match.scaleNotes.map((note, i) => {
              const degree = match.scaleDegrees[i] ?? String(i + 1);
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border bg-emerald-100 border-emerald-300 text-emerald-800">
                    {note}
                  </span>
                  <span className="text-[9px] font-mono text-gray-400">{degree}</span>
                </div>
              );
            })}
            {match.outsideNotes.map((note, i) => (
              <div key={`out-${i}`} className="flex flex-col items-center gap-0.5">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border bg-red-50 border-red-300 text-red-600">
                  {note}
                </span>
                <span className="text-[9px] font-mono text-red-400">out</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chord row ─────────────────────────────────────────────────────────────

interface ChordRowProps {
  label: string;
  parsed: ParsedChord | null;
  sharedPCs: Set<number>;
  mode: 'reveal' | 'quiz';
  scaleMatches: ScaleMatch[];
}

function notePC(note: string): number {
  const chromas: Record<string, number> = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
  };
  return chromas[note] ?? -1;
}

const SCALE_PREVIEW_COUNT = 3;

function ChordRow({ label, parsed, sharedPCs, mode, scaleMatches }: ChordRowProps) {
  const [quizValues, setQuizValues] = useState<Record<number, string>>({});
  const [quizRevealed, setQuizRevealed] = useState<Record<number, boolean>>({});
  const [quizCorrect, setQuizCorrect] = useState<Record<number, boolean | null>>({});
  const [scalesExpanded, setScalesExpanded] = useState(false);

  // Reset quiz when chord changes (new analyze)
  useEffect(() => {
    setQuizValues({});
    setQuizRevealed({});
    setQuizCorrect({});
  }, [parsed?.symbol]);

  const handleQuizChange = (pos: number, val: string) => {
    setQuizValues(prev => ({ ...prev, [pos]: val }));
  };

  const handleQuizCheck = (pos: number, correctNote: string) => {
    const entered = (quizValues[pos] ?? '').trim();
    const isCorrect = notePC(entered) === notePC(correctNote);
    setQuizCorrect(prev => ({ ...prev, [pos]: isCorrect }));
    setQuizRevealed(prev => ({ ...prev, [pos]: true }));
  };

  const handleCheckAll = () => {
    if (!parsed) return;
    const newCorrect: Record<number, boolean> = {};
    const newRevealed: Record<number, boolean> = {};
    // Grade chord-tone positions
    parsed.degrees.forEach(degree => {
      const entered = (quizValues[degree.position] ?? '').trim();
      newCorrect[degree.position] = notePC(entered) === notePC(degree.note);
      newRevealed[degree.position] = true;
    });
    // Mark empty positions as "revealed" too (shows what they typed, ungraded)
    for (let pos = 0; pos < 7; pos++) {
      if (!parsed.degrees.find(d => d.position === pos)) {
        newRevealed[pos] = true;
      }
    }
    setQuizCorrect(newCorrect);
    setQuizRevealed(newRevealed);
  };

  const handleRevealAll = () => {
    if (!parsed) return;
    const newRevealed: Record<number, boolean> = {};
    for (let pos = 0; pos < 7; pos++) { newRevealed[pos] = true; }
    setQuizRevealed(newRevealed);
  };

  const allRevealed = parsed
    ? parsed.degrees.every(d => quizRevealed[d.position])
    : false;

  const score = parsed
    ? parsed.degrees.filter(d => quizRevealed[d.position] && quizCorrect[d.position] === true).length
    : 0;
  const total = parsed?.degrees.length ?? 0;

  const perfect = scaleMatches.filter(m => m.overlap === 1);
  const partial = scaleMatches.filter(m => m.overlap < 1);
  const allMatches = [...perfect, ...partial];
  const visibleMatches = scalesExpanded ? allMatches : allMatches.slice(0, SCALE_PREVIEW_COUNT);
  const hasMore = allMatches.length > SCALE_PREVIEW_COUNT;

  return (
    <div className="bg-white/40 backdrop-blur-sm border border-white/60 rounded-2xl p-5 space-y-4 shadow-sm shadow-sky-900/10">
      <h3 className="text-sky-800 text-sm font-bold tracking-wide">{label}</h3>

      {parsed ? (
        <>
          {/* Circle diagram */}
          <div className="flex gap-2 justify-center flex-wrap">
            {Array.from({ length: 7 }, (_, pos) => {
              const degree = parsed.degrees.find(d => d.position === pos);
              const isShared = degree ? sharedPCs.has(notePC(degree.note)) : false;
              return (
                <Circle
                  key={pos}
                  position={pos}
                  note={degree?.note}
                  label={degree?.label}
                  isShared={isShared}
                  mode={mode}
                  revealed={quizRevealed[pos]}
                  quizValue={quizValues[pos] ?? ''}
                  quizCorrect={degree ? (quizCorrect[pos] ?? null) : undefined}
                  onQuizChange={val => handleQuizChange(pos, val)}
                  onQuizCheck={() => degree && handleQuizCheck(pos, degree.note)}
                />
              );
            })}
          </div>

          {/* Quiz controls */}
          {mode === 'quiz' && parsed && (
            <div className="flex items-center gap-2 justify-center">
              {!allRevealed ? (
                <>
                  <button
                    onClick={handleCheckAll}
                    className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Check answers
                  </button>
                  <button
                    onClick={handleRevealAll}
                    className="px-4 py-1.5 bg-white/60 hover:bg-white text-sky-600 text-xs font-semibold rounded-lg border border-sky-200 transition-colors"
                  >
                    Reveal
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${score === total ? 'text-emerald-600' : 'text-sky-700'}`}>
                    {score}/{total} correct
                  </span>
                  <button
                    onClick={() => { setQuizValues({}); setQuizRevealed({}); setQuizCorrect({}); }}
                    className="px-3 py-1 bg-white/60 hover:bg-white text-sky-600 text-xs font-semibold rounded-lg border border-sky-200 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Scale matches — collapsible */}
          <div className="space-y-1.5">
            <button
              onClick={() => setScalesExpanded(v => !v)}
              className="flex items-center gap-1.5 text-xs text-sky-600 font-semibold uppercase tracking-wider hover:text-sky-800 transition-colors"
            >
              <span className={`transition-transform duration-200 ${scalesExpanded ? 'rotate-90' : ''}`}>▶</span>
              Scale matches
              {perfect.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold normal-case">
                  {perfect.length} perfect
                </span>
              )}
            </button>
            {allMatches.length === 0 && (
              <p className="text-sky-400 text-xs pl-4">No matches found</p>
            )}
            <div className="space-y-1">
              {visibleMatches.map(m => (
                <ScaleMatchRow
                  key={m.name}
                  match={m}
                  isPerfect={m.overlap === 1}
                  chordRoots={parsed ? [{ symbol: parsed.symbol, root: parsed.root }] : undefined}
                />
              ))}
            </div>
            {hasMore && !scalesExpanded && (
              <button
                onClick={() => setScalesExpanded(true)}
                className="text-xs text-sky-400 hover:text-sky-600 pl-1 transition-colors"
              >
                + {allMatches.length - SCALE_PREVIEW_COUNT} more scales
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: 7 }, (_, pos) => (
            <Circle key={pos} position={pos} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared scales section ─────────────────────────────────────────────────

function SharedScalesSection({ chord1, chord2 }: { chord1: ParsedChord; chord2: ParsedChord }) {
  const [expanded, setExpanded] = useState(false);

  // Combine all notes from both chords (deduplicated by pitch class)
  const allNotes: string[] = [];
  const seenPCs = new Set<number>();
  for (const degree of [...chord1.degrees, ...chord2.degrees]) {
    const pc = notePC(degree.note);
    if (pc >= 0 && !seenPCs.has(pc)) {
      seenPCs.add(pc);
      allNotes.push(degree.note);
    }
  }

  const matches = findScaleMatches(allNotes, 5);
  const perfect = matches.filter(m => m.overlap === 1);
  const partial = matches.filter(m => m.overlap < 1);
  const allMatches = [...perfect, ...partial];
  const visible = expanded ? allMatches : allMatches.slice(0, 4);
  const hasMore = allMatches.length > 4;

  return (
    <div className="bg-white/40 backdrop-blur-sm border border-white/60 rounded-2xl p-5 space-y-3 shadow-sm shadow-sky-900/10 mt-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sky-800 text-sm font-bold tracking-wide">Combined scale fit</h3>
          <p className="text-sky-500 text-xs mt-0.5">
            Scales covering notes across both chords · {allNotes.length} unique pitch classes
          </p>
        </div>
        {perfect.length > 0 && (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">
            {perfect.length} perfect fit{perfect.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {allMatches.length === 0 && (
          <p className="text-sky-400 text-xs">No scale matches found</p>
        )}
        {visible.map(m => (
          <ScaleMatchRow
            key={m.name}
            match={m}
            isPerfect={m.overlap === 1}
            chordRoots={[
              { symbol: chord1.symbol, root: chord1.root },
              { symbol: chord2.symbol, root: chord2.root },
            ]}
          />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-xs text-sky-500 hover:text-sky-700 font-semibold transition-colors"
        >
          <span className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>▶</span>
          {expanded ? 'Show less' : `+ ${allMatches.length - 4} more scales`}
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function TheoryPage() {
  const [input1, setInput1] = useState('C7');
  const [input2, setInput2] = useState('F7');
  const [mode, setMode] = useState<'reveal' | 'quiz'>('reveal');
  const [submitted, setSubmitted] = useState(false);
  const [builderExpanded, setBuilderExpanded] = useState(false);

  const [chord1, setChord1] = useState<ParsedChord | null>(null);
  const [chord2, setChord2] = useState<ParsedChord | null>(null);
  const [matches1, setMatches1] = useState<ScaleMatch[]>([]);
  const [matches2, setMatches2] = useState<ScaleMatch[]>([]);
  const [error1, setError1] = useState('');
  const [error2, setError2] = useState('');

  const analyze = useCallback(() => {
    const p1 = parseChord(input1);
    const p2 = parseChord(input2);

    setError1(p1 ? '' : `Can't parse "${input1}"`);
    setError2(p2 ? '' : `Can't parse "${input2}"`);

    setChord1(p1);
    setChord2(p2);
    setMatches1(p1 ? findScaleMatches(p1.degrees.map(d => d.note)) : []);
    setMatches2(p2 ? findScaleMatches(p2.degrees.map(d => d.note)) : []);
    setSubmitted(true);
  }, [input1, input2]);

  const sharedPCs =
    chord1 && chord2
      ? findSharedNotes(
          chord1.degrees.map(d => d.note),
          chord2.degrees.map(d => d.note),
        )
      : new Set<number>();

  const sharedNoteNames =
    chord1 && chord2
      ? chord1.degrees
          .filter(d => sharedPCs.has(notePC(d.note)))
          .map(d => d.note)
      : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 via-emerald-50 to-green-100 font-sans">
      {/* Decorative blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-64 h-64 bg-green-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-200/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-sky-600 text-sm hover:text-sky-800 transition-colors">
              ← Back to Shredly
            </Link>
            <h1 className="text-2xl font-bold text-sky-900 mt-1">Chord Theory</h1>
            <p className="text-sky-600 text-sm">Compare two chords · see shared tones · find scales</p>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 bg-white/50 backdrop-blur-sm border border-white/60 p-1 rounded-lg shadow-sm">
            {(['reveal', 'quiz'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                  mode === m
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-sky-600 hover:text-sky-800'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Chord builders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <ChordBuilder
            label="Chord 1"
            value={input1}
            onChange={setInput1}
            error={error1}
            expanded={builderExpanded}
            onToggleExpanded={() => setBuilderExpanded(v => !v)}
          />
          <ChordBuilder
            label="Chord 2"
            value={input2}
            onChange={setInput2}
            error={error2}
            expanded={builderExpanded}
            onToggleExpanded={() => setBuilderExpanded(v => !v)}
          />
        </div>

        {/* Analyze button */}
        <div className="flex justify-center mb-5">
          <button
            onClick={analyze}
            className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-8 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            Analyze
          </button>
        </div>

        {/* Shared notes banner */}
        {submitted && sharedNoteNames.length > 0 && (
          <div className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-800 shadow-sm">
            Shared notes: <span className="font-bold">{sharedNoteNames.join(', ')}</span>
            <span className="text-amber-500 ml-2">(highlighted in circles)</span>
          </div>
        )}
        {submitted && sharedNoteNames.length === 0 && chord1 && chord2 && (
          <div className="mb-4 px-4 py-2.5 bg-white/40 border border-sky-200 rounded-xl text-sm text-sky-500">
            No shared notes between these two chords
          </div>
        )}

        {/* Chord rows */}
        <div className="space-y-5">
          <ChordRow
            label={submitted && chord1 ? `Chord 1: ${chord1.symbol}` : 'Chord 1'}
            parsed={submitted ? chord1 : null}
            sharedPCs={sharedPCs}
            mode={mode}
            scaleMatches={matches1}
          />
          <ChordRow
            label={submitted && chord2 ? `Chord 2: ${chord2.symbol}` : 'Chord 2'}
            parsed={submitted ? chord2 : null}
            sharedPCs={sharedPCs}
            mode={mode}
            scaleMatches={matches2}
          />
        </div>

        {/* Shared scales section */}
        {submitted && chord1 && chord2 && (
          <SharedScalesSection chord1={chord1} chord2={chord2} />
        )}

        {/* Hint text */}
        {!submitted && (
          <p className="text-center text-sky-500 text-sm mt-10">
            Enter two chord symbols and hit Analyze (or press Enter)
          </p>
        )}
      </div>
    </div>
  );
}
