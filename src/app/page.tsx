'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import RecordingLoopSystem from '@/components/RecordingLoopSystem';
import FretboardComponent from '@/components/FretboardComponent';
import ScaleSuggestions from '@/components/ScaleSuggestions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { analyzeProgression, getScaleSuggestions } from '@/lib/musicTheory';
import { ScaleSuggestion } from '@/types/music';
import { Scale } from 'tonal';

// Cloud component for background animation
const Cloud = ({ className, duration, delay, style }: { className?: string, duration: number, delay: number, style?: React.CSSProperties }) => (
  <motion.svg
    className={`absolute opacity-60 ${className}`}
    initial={{ x: '-200px' }}
    animate={{ x: 'calc(100vw + 200px)' }}
    transition={{
      duration: duration,
      repeat: Infinity,
      ease: "linear",
      delay: delay
    }}
    viewBox="0 0 150 75"
    fill="white"
    style={style}
  >
    <ellipse cx="35" cy="45" rx="25" ry="20" />
    <ellipse cx="60" cy="40" rx="30" ry="25" />
    <ellipse cx="85" cy="42" rx="28" ry="22" />
    <ellipse cx="110" cy="47" rx="22" ry="18" />
  </motion.svg>
);

export default function Home() {
  const {
    state,
    startRecording,
    stopRecording,
    clearChords,
    updateDetectedChord,
    setDetectedChords
  } = useAudioRecording();

  const { isRecording, detectedChords } = state;

  const [activeScale, setActiveScale] = useState<string>('A Minor Pentatonic');
  const [scaleSuggestions, setScaleSuggestions] = useState<ScaleSuggestion[]>([]);
  const [currentPlaybackChord, setCurrentPlaybackChord] = useState<string | null>(null);
  const [scaleMode, setScaleMode] = useState<'fixed' | 'follow'>('fixed');
  const [isLogoHovered, setIsLogoHovered] = useState(false);

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusRange, setFocusRange] = useState([4, 8]);

  // Per-chord scale overrides for Follow mode
  const [chordScaleOverrides, setChordScaleOverrides] = useState<Map<string, string>>(new Map());
  const [currentChordTimestamp, setCurrentChordTimestamp] = useState<number | null>(null);

  // Update scale suggestions when chords change
  useEffect(() => {
    if (detectedChords.length > 0) {
      const orderedChords = detectedChords.map(c => c.chord);
      const progressionMeta = analyzeProgression(orderedChords);

      let suggestions: ScaleSuggestion[] = [];

      if (scaleMode === 'fixed') {
        // In Fixed mode, suggest scales that work for the ENTIRE progression
        suggestions = progressionMeta.progressionScales;
      } else {
        // In Follow mode, suggest scales for the TARGET chord
        const targetChord = currentPlaybackChord || detectedChords[detectedChords.length - 1].chord;
        suggestions = getScaleSuggestions(targetChord, {
          progression: orderedChords,
          progressionType: progressionMeta.progressionType,
          tonic: progressionMeta.keySignature || undefined
        });
      }

      setScaleSuggestions(suggestions);

      // Auto-select best scale
      if (suggestions.length > 0) {
        // Only auto-switch if the current active scale is not in the new suggestions
        // OR if we are in a mode where we want to track closely.
        const currentIsAvailable = suggestions.some(s => s.name === activeScale);

        if (!currentIsAvailable || scaleMode === 'follow') {
          const perfectMatch = suggestions.find(s => s.quality === 'perfect');
          if (perfectMatch) {
            setActiveScale(perfectMatch.name);
          } else {
            setActiveScale(suggestions[0].name);
          }
        }
      }
    }
  }, [detectedChords, currentPlaybackChord, scaleMode]); // activeScale not in deps to avoid loop

  // Calculate notes for Fretboard
  const progressionNotes = useMemo(() => {
    try {
      return Scale.get(activeScale).notes;
    } catch {
      return [];
    }
  }, [activeScale]);

  // Get scale for current chord (with override support)
  const getCurrentChordScale = useMemo(() => {
    if (!currentPlaybackChord || scaleMode !== 'follow') {
      return activeScale;
    }

    // Find the current chord in detectedChords to get its timestamp
    const currentChordData = detectedChords.find(c => c.chord === currentPlaybackChord);
    if (!currentChordData) return activeScale;

    // Check for override
    const overrideKey = `${currentChordData.timestamp}-${currentPlaybackChord}`;
    if (chordScaleOverrides.has(overrideKey)) {
      return chordScaleOverrides.get(overrideKey)!;
    }

    // Fall back to auto-suggestion
    const suggestions = getScaleSuggestions(currentPlaybackChord);

    // Prefer Pentatonic if active scale is Pentatonic
    const activeLower = activeScale.toLowerCase();
    if (activeLower.includes('pentatonic')) {
      const isMinor = activeLower.includes('minor');
      const isMajor = activeLower.includes('major');

      // 1. Try to find an exact Pentatonic match of the same quality
      const pentatonicMatch = suggestions.find(s => {
        const nameLower = s.name.toLowerCase();
        if (!nameLower.includes('pentatonic')) return false;
        if (isMinor && nameLower.includes('minor')) return true;
        if (isMajor && nameLower.includes('major')) return true;
        return !isMinor && !isMajor;
      });

      if (pentatonicMatch) return pentatonicMatch.name;

      // 2. Fallback: If we want Major Pentatonic but can't find it, look for other MAJOR scales (Mixolydian, Major, Lydian)
      //    This prevents falling back to Minor Pentatonic/Blues for dominant chords if the user wants a Major sound.
      if (isMajor) {
        const majorFallback = suggestions.find(s => {
          const nameLower = s.name.toLowerCase();
          return nameLower.includes('mixolydian') || nameLower.includes('major') || nameLower.includes('lydian');
        });
        if (majorFallback) return majorFallback.name;
      }

      // 3. Fallback: If we want Minor Pentatonic but can't find it, look for other MINOR scales
      if (isMinor) {
        const minorFallback = suggestions.find(s => {
          const nameLower = s.name.toLowerCase();
          return nameLower.includes('dorian') || nameLower.includes('phrygian') || nameLower.includes('natural minor') || nameLower.includes('blues');
        });
        if (minorFallback) return minorFallback.name;
      }
    }

    return suggestions[0]?.name || activeScale;
  }, [currentPlaybackChord, scaleMode, activeScale, detectedChords, chordScaleOverrides]);

  const chordMomentNotes = useMemo(() => {
    if (!currentPlaybackChord) return [];

    // In Follow Mode, we want the notes of the currently selected scale (which might be an override or auto-selected)
    // getCurrentChordScale handles both overrides and auto-selection logic.
    if (scaleMode === 'follow') {
      try {
        return Scale.get(getCurrentChordScale).notes;
      } catch (e) {
        console.error('Failed to get notes for scale:', getCurrentChordScale, e);
        return [];
      }
    }

    // In Fixed Mode, or fallback, we might want suggestions, but Fretboard typically focuses on 'progressionNotes'.
    // However, if we want to show 'chordMomentNotes' even in Fixed mode (as a secondary highlight), we can default to the best fit.
    const suggestions = getScaleSuggestions(currentPlaybackChord);
    return suggestions.length > 0 ? suggestions[0].notes : [];
  }, [currentPlaybackChord, scaleMode, getCurrentChordScale]);

  const rootNotes = useMemo(() => {
    try {
      return [Scale.get(activeScale).tonic || ''];
    } catch {
      return [];
    }
  }, [activeScale]);

  const safeHighlightedNotes = useMemo(() => {
    if (scaleMode === 'follow') {
      try {
        return Scale.get(getCurrentChordScale).notes;
      } catch {
        return progressionNotes;
      }
    }
    return progressionNotes;
  }, [scaleMode, getCurrentChordScale, progressionNotes]);

  const safeRootNotes = useMemo(() => {
    if (scaleMode === 'follow') {
      try {
        return [Scale.get(getCurrentChordScale).tonic || ''];
      } catch {
        return rootNotes;
      }
    }
    return rootNotes;
  }, [scaleMode, getCurrentChordScale, rootNotes]);

  // Update current chord timestamp when playback chord changes
  useEffect(() => {
    if (currentPlaybackChord) {
      const chordData = detectedChords.find(c => c.chord === currentPlaybackChord);
      if (chordData) {
        setCurrentChordTimestamp(chordData.timestamp);
      }
    } else {
      setCurrentChordTimestamp(null);
    }
  }, [currentPlaybackChord, detectedChords]);

  // Handler for scale override
  const handleScaleOverride = (scaleName: string) => {
    if (scaleMode === 'follow' && currentPlaybackChord && currentChordTimestamp !== null) {
      const overrideKey = `${currentChordTimestamp}-${currentPlaybackChord}`;
      setChordScaleOverrides(prev => {
        const newMap = new Map(prev);
        newMap.set(overrideKey, scaleName);
        return newMap;
      });
      setActiveScale(scaleName);
    } else {
      setActiveScale(scaleName);
    }
  };

  const handleLoadTestProgression = () => {
    if (isRecording) {
      stopRecording();
    }

    const baseTimestamp = Date.now();
    const barMs = 2000;
    const progression = [
      'A7', 'A7', 'A7', 'A7',
      'D7', 'D7',
      'A7', 'A7',
      'E7', 'D7', 'A7', 'E7'
    ];

    const events = progression.map((chord, index) => ({
      chord,
      confidence: 1,
      timestamp: baseTimestamp + index * barMs
    }));

    setChordScaleOverrides(new Map());
    setCurrentPlaybackChord('A7');
    setScaleMode('fixed');
    setActiveScale('A blues');
    setDetectedChords(events);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 via-emerald-50 to-green-100 p-8 relative overflow-hidden font-sans">
      {/* Floating Clouds Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <Cloud className="top-16 w-32 h-20" duration={80} delay={0} />
        <Cloud className="top-32 w-48 h-20 opacity-50" duration={100} delay={15} />
        <Cloud className="top-24 w-40 h-28 opacity-65" duration={90} delay={35} />
        <Cloud className="top-10 w-36 h-32 opacity-55" duration={95} delay={55} />
        <Cloud className="top-40 w-44 h-16 opacity-45" duration={110} delay={25} />
        <Cloud className="top-20 w-36 h-24 opacity-70" duration={85} delay={45} />
      </div>

      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-green-300/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-200/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <div className="flex justify-between items-center">
          <Link
            href="/theory"
            className="bg-white/70 hover:bg-white text-purple-700 border border-purple-200 shadow-sm px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            🎵 Chord Theory
          </Link>
          <Button
            variant="secondary"
            className="bg-white/70 hover:bg-white text-sky-700 border border-sky-200 shadow-sm"
            onClick={handleLoadTestProgression}
          >
            Test: A 1-4-5 Blues
          </Button>
        </div>
        {/* Shred.fyi Branding Header */}
        <div className="text-center mb-8 relative">
          <motion.div
            className="inline-block bg-white/40 backdrop-blur-sm px-8 py-4 rounded-2xl border border-white/60 shadow-lg shadow-sky-900/10"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center justify-center gap-3 mb-1">
              <div
                className="relative w-[72px] h-[123px]"
                onMouseEnter={() => setIsLogoHovered(true)}
                onMouseLeave={() => setIsLogoHovered(false)}
              >
                <Image
                  src={isLogoHovered ? '/alt-logo.png' : '/logo.png'}
                  alt="Shred.fyi logo"
                  width={72}
                  height={123}
                  className={`w-[72px] h-auto transition-all duration-200 ${isLogoHovered ? 'scale-125' : 'scale-100'
                    }`}
                  priority
                />
              </div>
              <h1 className="text-5xl tracking-tight text-sky-700 font-light">
                Shred<span className="text-sky-600">.fyi</span>
              </h1>
            </div>
            <p className="text-sky-600/70 text-sm tracking-wide uppercase">
              Chord Detection & Scale Visualization
            </p>
          </motion.div>
        </div>

        {/* Main Recording & Loop System (includes PlaybackControls and ChordProgression) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <RecordingLoopSystem
            isRecording={isRecording}
            detectedChords={detectedChords}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onClearRecording={clearChords}
            onUpdateChord={updateDetectedChord}
            onPlaybackChordChange={setCurrentPlaybackChord}
          />
        </motion.div>

        {/* Scale Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ScaleSuggestions
            suggestions={scaleSuggestions}
            activeScaleName={scaleMode === 'follow' ? getCurrentChordScale : activeScale}
            onScaleSelect={handleScaleOverride}
            currentChordName={currentPlaybackChord || (detectedChords.length > 0 ? detectedChords[detectedChords.length - 1].chord : undefined)}
            scaleMode={scaleMode}
            onScaleModeChange={setScaleMode}
            isFocusMode={isFocusMode}
            onFocusModeChange={setIsFocusMode}
            focusRange={focusRange}
            onFocusRangeChange={setFocusRange}
          />
        </motion.div>

        {/* Fretboard Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <FretboardComponent
            strings={[64, 59, 55, 50, 45, 40]}
            highlightedNotes={safeHighlightedNotes}
            highlightMode={scaleMode === 'follow' ? 'chord' : 'progression'}
            rootNotes={safeRootNotes}
            progressionScaleName={scaleMode === 'follow' ? getCurrentChordScale : activeScale}
            chordMomentScaleName={currentPlaybackChord ? `${currentPlaybackChord} Scale` : undefined}
            chordMomentNotes={chordMomentNotes}
            currentChordName={currentPlaybackChord}
            isFocusMode={isFocusMode}
            focusRange={focusRange}
          />
        </motion.div>
      </div>
    </div>
  );
}
