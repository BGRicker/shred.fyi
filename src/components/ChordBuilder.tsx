'use client';

import { useState, useEffect } from 'react';
import { Chord } from 'tonal';

// ── Data ──────────────────────────────────────────────────────────────────

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

interface ChordType {
  label: string;   // button display
  suffix: string;  // tonal symbol suffix
  group: 'triad' | '7th' | '9th+' | 'alt';
}

const CHORD_TYPES: ChordType[] = [
  // Triads
  { label: 'maj',  suffix: '',     group: 'triad' },
  { label: 'min',  suffix: 'm',    group: 'triad' },
  { label: 'dim',  suffix: 'dim',  group: 'triad' },
  { label: 'aug',  suffix: 'aug',  group: 'triad' },
  { label: 'sus2', suffix: 'sus2', group: 'triad' },
  { label: 'sus4', suffix: 'sus4', group: 'triad' },
  // 7ths
  { label: 'Δ7',   suffix: 'maj7',   group: '7th' },
  { label: '7',    suffix: '7',      group: '7th' },
  { label: 'm7',   suffix: 'm7',     group: '7th' },
  { label: 'mΔ7',  suffix: 'mM7',    group: '7th' },
  { label: 'ø7',   suffix: 'm7b5',   group: '7th' },
  { label: '°7',   suffix: 'dim7',   group: '7th' },
  { label: '7sus4',suffix: '7sus4',  group: '7th' },
  // 9th+
  { label: 'Δ9',   suffix: 'maj9',   group: '9th+' },
  { label: '9',    suffix: '9',      group: '9th+' },
  { label: 'm9',   suffix: 'm9',     group: '9th+' },
  { label: 'Δ11',  suffix: 'maj11',  group: '9th+' },
  { label: '11',   suffix: '11',     group: '9th+' },
  { label: 'm11',  suffix: 'm11',    group: '9th+' },
  { label: 'Δ13',  suffix: 'maj13',  group: '9th+' },
  { label: '13',   suffix: '13',     group: '9th+' },
  // Altered
  { label: '7♭9',  suffix: '7b9',    group: 'alt' },
  { label: '7♯9',  suffix: '7#9',    group: 'alt' },
  { label: '7♯11', suffix: '7#11',   group: '9th+' },
  { label: '7♭13', suffix: '7b13',   group: 'alt' },
  { label: '7alt', suffix: '7alt',   group: 'alt' },
];

const GROUP_LABELS: Record<string, string> = {
  'triad': 'Triads',
  '7th':   '7ths',
  '9th+':  '9th / Extended',
  'alt':   'Altered',
};

const GROUPS: ChordType['group'][] = ['triad', '7th', '9th+', 'alt'];

// ── Helpers ───────────────────────────────────────────────────────────────

function buildSymbol(root: string, suffix: string): string {
  return `${root}${suffix}`;
}

function parseSymbolToBuilder(symbol: string): { root: string; suffix: string } | null {
  if (!symbol.trim()) return null;
  const normalized = symbol
    .replace(/Δ|△|∆/g, 'maj7')
    .replace(/°/g, 'dim')
    .replace(/ø/g, 'm7b5')
    .replace(/−/g, 'm');
  const chord = Chord.get(normalized);
  if (chord.empty || !chord.tonic) return null;
  const root = ROOTS.find(r => {
    const c = Chord.get(`${r}${chord.aliases[0] ?? ''}`);
    return c.tonic === chord.tonic;
  }) ?? chord.tonic;
  // Find the best matching suffix
  const rawSuffix = normalized.slice(chord.tonic.length);
  return { root: chord.tonic, suffix: rawSuffix };
}

// ── Component ─────────────────────────────────────────────────────────────

interface ChordBuilderProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  error?: string;
  expanded: boolean;
  onToggleExpanded: () => void;
}

export default function ChordBuilder({ label, value, onChange, error, expanded, onToggleExpanded }: ChordBuilderProps) {
  const [root, setRoot] = useState('C');
  const [suffix, setSuffix] = useState('7');
  const [text, setText] = useState(value);
  const [textValid, setTextValid] = useState(true);

  // Sync text → builder when text changes externally
  useEffect(() => {
    setText(value);
    const parsed = parseSymbolToBuilder(value);
    if (parsed) {
      const matchRoot = ROOTS.find(r => r === parsed.root) ?? parsed.root;
      setRoot(matchRoot);
      setSuffix(parsed.suffix);
      setTextValid(true);
    }
  }, [value]);

  const handleRootClick = (r: string) => {
    setRoot(r);
    const sym = buildSymbol(r, suffix);
    setText(sym);
    onChange(sym);
  };

  const handleTypeClick = (s: string) => {
    setSuffix(s);
    const sym = buildSymbol(root, s);
    setText(sym);
    onChange(sym);
  };

  const handleTextChange = (val: string) => {
    setText(val);
    const chord = Chord.get(val.replace(/Δ|△|∆/g, 'maj7').replace(/°/g, 'dim').replace(/ø/g, 'm7b5'));
    if (!chord.empty && chord.tonic) {
      setTextValid(true);
      // Update builder state from text
      const matchRoot = ROOTS.find(r => r === chord.tonic) ?? chord.tonic ?? root;
      setRoot(matchRoot);
      const rawSuffix = val.replace(/Δ|△|∆/g, 'maj7').replace(/°/g, 'dim').replace(/ø/g, 'm7b5').slice(chord.tonic.length);
      setSuffix(rawSuffix);
      onChange(val);
    } else {
      setTextValid(false);
    }
  };

  const activeType = CHORD_TYPES.find(t => t.suffix === suffix);

  return (
    <div className="bg-white/40 backdrop-blur-sm border border-white/70 rounded-2xl p-4 space-y-3 shadow-sm">
      {/* Label + text input */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sky-700 text-sm font-bold">{label}</span>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={e => handleTextChange(e.target.value)}
            className={`w-28 bg-white/70 border rounded-lg px-2.5 py-1.5 text-sky-900 text-sm font-mono font-bold focus:outline-none focus:bg-white transition-colors ${
              textValid ? 'border-sky-200 focus:border-sky-400' : 'border-red-300 focus:border-red-400'
            }`}
            placeholder="e.g. C7"
          />
          {text && (
            <span className="text-sky-500 text-xs max-w-[120px] truncate">
              {Chord.get(text.replace(/Δ|△|∆/g, 'maj7').replace(/°/g, 'dim').replace(/ø/g, 'm7b5')).aliases[0]
                ? Chord.get(text.replace(/Δ|△|∆/g, 'maj7').replace(/°/g, 'dim').replace(/ø/g, 'm7b5')).type
                : ''}
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      {/* Expandable builder */}
      <button
        onClick={onToggleExpanded}
        className="flex items-center gap-1.5 text-xs text-sky-500 hover:text-sky-700 font-semibold transition-colors"
      >
        <span className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>▶</span>
        {expanded ? 'Hide builder' : 'Build from parts'}
      </button>

      {expanded && (
        <div className="space-y-3 pt-1">
          {/* Root selector */}
          <div>
            <p className="text-xs text-sky-500 font-semibold uppercase tracking-wider mb-1.5">Root</p>
            <div className="flex flex-wrap gap-1">
              {ROOTS.map(r => (
                <button
                  key={r}
                  onClick={() => handleRootClick(r)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold font-mono transition-all ${
                    root === r
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-white/60 text-sky-700 hover:bg-white/90 border border-sky-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Chord type selector by group */}
          {GROUPS.map(group => (
            <div key={group}>
              <p className="text-xs text-sky-500 font-semibold uppercase tracking-wider mb-1.5">
                {GROUP_LABELS[group]}
              </p>
              <div className="flex flex-wrap gap-1">
                {CHORD_TYPES.filter(t => t.group === group).map(t => (
                  <button
                    key={t.suffix}
                    onClick={() => handleTypeClick(t.suffix)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      suffix === t.suffix
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-white/60 text-sky-700 hover:bg-white/90 border border-sky-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
