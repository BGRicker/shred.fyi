import React, { useMemo, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Check, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getComparableChords } from '@/lib/musicTheory';

interface ChordProgressionProps {
  chords: Array<{ chord: string; timestamp: number }>;
  currentChord?: string | null;
  currentTime?: number;
  totalDuration?: number;
  isPlaying?: boolean;
  onChordUpdate?: (timestamp: number, newChord: string) => void;
  onTimingAdjust?: (chordIndex: number, newBoundaryTime: number) => void;
}

interface MergedChord {
  name: string;
  root: string;
  time: number;
  duration: number;
  startBar: number;
  endBar: number;
  originalTimestamps: number[]; // Track all original timestamps for updates
}

// Get interval from progression root and return colors
function getChordColors(chordRoot: string, progressionRoot: string) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Normalize roots to remove sharp/flat ambiguity if needed, but for now assume standard
  const rootIndex = notes.indexOf(progressionRoot.replace(/(?:aug|dim|\d)/g, ''));
  const chordIndex = notes.indexOf(chordRoot.replace(/(?:aug|dim|\d)/g, ''));

  if (rootIndex === -1 || chordIndex === -1) {
    // Default to green if we can't find the notes
    return {
      inactive: 'from-green-100 to-emerald-100 border-green-300/60',
      active: 'from-green-500 to-emerald-600 border-green-400 shadow-green-500/40',
      text: 'text-green-800',
      activeText: 'text-white',
      subText: 'text-green-600/70',
      activeSubText: 'text-green-100',
      badge: 'bg-green-100 text-green-800 border-green-300/60',
      activeBadge: 'bg-green-500 text-white shadow-green-500/30'
    };
  }

  // Calculate interval (semitones from root)
  const interval = (chordIndex - rootIndex + 12) % 12;

  // I (root) - Green
  if (interval === 0) {
    return {
      inactive: 'from-green-100 to-emerald-100 border-green-300/60',
      active: 'from-green-500 to-emerald-600 border-green-400 shadow-green-500/40',
      text: 'text-green-800',
      activeText: 'text-white',
      subText: 'text-green-600/70',
      activeSubText: 'text-green-100',
      badge: 'bg-green-100 text-green-800 border-green-300/60',
      activeBadge: 'bg-green-500 text-white shadow-green-500/30'
    };
  }
  // IV (4th) - Amber/Orange
  else if (interval === 5) {
    return {
      inactive: 'from-amber-100 to-orange-100 border-amber-300/60',
      active: 'from-amber-500 to-orange-600 border-amber-400 shadow-amber-500/40',
      text: 'text-amber-800',
      activeText: 'text-white',
      subText: 'text-amber-600/70',
      activeSubText: 'text-amber-100',
      badge: 'bg-amber-100 text-amber-800 border-amber-300/60',
      activeBadge: 'bg-amber-500 text-white shadow-amber-500/30'
    };
  }
  // V (5th) - Teal
  else if (interval === 7) {
    return {
      inactive: 'from-teal-100 to-cyan-100 border-teal-300/60',
      active: 'from-teal-500 to-cyan-600 border-teal-400 shadow-teal-500/40',
      text: 'text-teal-800',
      activeText: 'text-white',
      subText: 'text-teal-600/70',
      activeSubText: 'text-teal-100',
      badge: 'bg-teal-100 text-teal-800 border-teal-300/60',
      activeBadge: 'bg-teal-500 text-white shadow-teal-500/30'
    };
  }
  // Other intervals - Purple
  else {
    return {
      inactive: 'from-purple-100 to-violet-100 border-purple-300/60',
      active: 'from-purple-500 to-violet-600 border-purple-400 shadow-purple-500/40',
      text: 'text-purple-800',
      activeText: 'text-white',
      subText: 'text-purple-600/70',
      activeSubText: 'text-purple-100',
      badge: 'bg-purple-100 text-purple-800 border-purple-300/60',
      activeBadge: 'bg-purple-500 text-white shadow-purple-500/30'
    };
  }
}

const ChordProgression: React.FC<ChordProgressionProps> = ({
  chords,
  currentTime = 0,
  totalDuration = 0,
  isPlaying = false,
  onChordUpdate,
  onTimingAdjust
}) => {
  // Drag state for boundary adjustment
  const [draggingBoundary, setDraggingBoundary] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartDurations, setDragStartDurations] = useState<[number, number] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Merge consecutive chords
  const mergedChords = useMemo(() => {
    if (chords.length === 0) return [];

    // If totalDuration is 0, we can't really calculate durations properly for display
    // But we can try to estimate based on timestamps
    const duration = totalDuration > 0 ? totalDuration : (chords[chords.length - 1].timestamp + 2); // Fallback

    const merged: MergedChord[] = [];
    if (chords.length === 0) return merged;

    // Sort by timestamp just in case
    const sortedChords = [...chords].sort((a, b) => a.timestamp - b.timestamp);

    let current = {
      name: sortedChords[0].chord,
      root: sortedChords[0].chord.replace(/(?:aug|dim|\d)/g, ''),
      time: sortedChords[0].timestamp,
      duration: 0, // Will calculate
      startBar: 1,
      endBar: 1,
      originalTimestamps: [sortedChords[0].timestamp]
    };

    for (let i = 1; i < sortedChords.length; i++) {
      const nextTime = sortedChords[i].timestamp;

      if (sortedChords[i].chord === current.name) {
        // Continue current chord
        current.originalTimestamps.push(sortedChords[i].timestamp);
      } else {
        // Push current and start new
        current.duration = nextTime - current.time;
        merged.push(current);

        current = {
          name: sortedChords[i].chord,
          root: sortedChords[i].chord.replace(/(?:aug|dim|\d)/g, ''),
          time: nextTime,
          duration: 0,
          startBar: merged.length + 1,
          endBar: merged.length + 1,
          originalTimestamps: [sortedChords[i].timestamp]
        };
      }
    }

    // Handle last chord
    current.duration = duration - current.time;
    if (current.duration < 0) current.duration = 1; // Fallback
    merged.push(current);

    return merged;
  }, [chords, totalDuration]);

  const progressionChords = useMemo(
    () => Array.from(new Set(chords.map((c) => c.chord))),
    [chords]
  );

  const renderSuggestionList = (mergedChord: MergedChord) => (
    <CommandGroup heading="Suggestions">
      {getComparableChords(mergedChord.name, { progression: progressionChords }).map((suggestion) => (
        <CommandItem
          key={suggestion}
          value={suggestion}
          onSelect={(currentValue) => {
            handleChordChange(mergedChord, currentValue);
          }}
        >
          <Check
            className={cn(
              "mr-2 h-4 w-4",
              mergedChord.name === suggestion ? "opacity-100" : "opacity-0"
            )}
          />
          {suggestion}
        </CommandItem>
      ))}
    </CommandGroup>
  );

  // Determine progression root (first chord root)
  const progressionRoot = mergedChords.length > 0 ? mergedChords[0].root : 'A';

  const handleChordChange = (mergedChord: MergedChord, newChord: string) => {
    if (onChordUpdate) {
      // Update all original instances of this merged chord
      mergedChord.originalTimestamps.forEach(timestamp => {
        onChordUpdate(timestamp, newChord);
      });
    }
  };

  // Drag handlers for boundary adjustment
  const handleBoundaryMouseDown = (e: React.MouseEvent, boundaryIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const currentChord = mergedChords[boundaryIndex];
    const nextChord = mergedChords[boundaryIndex + 1];
    if (currentChord && nextChord) {
      setDraggingBoundary(boundaryIndex);
      setDragStartX(e.clientX);
      setDragStartDurations([currentChord.duration, nextChord.duration]);
    }
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (draggingBoundary === null || !containerRef.current || !onTimingAdjust || !dragStartDurations) return;

    const deltaX = e.clientX - dragStartX;
    const containerWidth = containerRef.current.offsetWidth;
    const deltaTime = (deltaX / containerWidth) * totalDuration;

    const currentChord = mergedChords[draggingBoundary];
    if (!currentChord) return;

    const [originalCurrentDuration, originalNextDuration] = dragStartDurations;

    const newDuration = Math.max(0.5, originalCurrentDuration + deltaTime);
    const nextNewDuration = Math.max(0.5, originalNextDuration - deltaTime);

    if (newDuration > 0.5 && nextNewDuration > 0.5) {
      const newBoundaryTime = currentChord.time + newDuration;
      onTimingAdjust(draggingBoundary, newBoundaryTime);
    }
  }, [draggingBoundary, dragStartDurations, dragStartX, mergedChords, totalDuration, onTimingAdjust]);

  const handleMouseUp = React.useCallback(() => {
    setDraggingBoundary(null);
    setDragStartDurations(null);
  }, []);

  // Add/remove mouse event listeners for dragging
  React.useEffect(() => {
    if (draggingBoundary !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingBoundary, handleMouseMove, handleMouseUp]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-green-800 font-bold text-xl">Chord Progression Looper</h2>
          <p className="text-sm text-green-700/70 mt-1">
            {mergedChords.length > 0 ? `${mergedChords.length} chords detected` : 'Ready to record'}
          </p>
        </div>
        <div className="text-right bg-green-50 px-4 py-2 rounded-2xl border border-green-200">
          <div className="text-sm text-green-800 font-medium">
            {Math.floor(currentTime)}s / {Math.floor(totalDuration)}s
          </div>
          <div className="text-xs text-green-600 mt-0.5">
            {isPlaying ? 'Playing' : 'Stopped'}
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative h-32 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl overflow-hidden border-2 border-green-200 shadow-inner group">
        {/* Background grid */}
        <div className="absolute inset-0 flex">
          {[...Array(Math.max(4, mergedChords.length))].map((_, index) => (
            <div
              key={`grid-${index}`}
              className="flex-1 border-r border-green-200/40"
              style={{ opacity: 0.5 }}
            />
          ))}
        </div>

        {/* Playhead */}
        {totalDuration > 0 && (
          <motion.div
            className="absolute top-0 bottom-0 w-1 bg-green-600 z-20 shadow-lg shadow-green-600/50"
            style={{
              left: `${(currentTime / totalDuration) * 100}%`
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isPlaying ? 1 : 0.5 }}
          >
            {/* Top triangle indicator */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-green-600 drop-shadow-lg" />
            </div>

            {/* Playhead line with glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50 w-8 -left-4" />

            {/* Bottom triangle indicator */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
              <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[10px] border-b-green-600 drop-shadow-lg" />
            </div>

            {/* Pulsing effect when playing */}
            {isPlaying && (
              <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-green-500 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [1, 0.5, 1]
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
          </motion.div>
        )}

        {/* Chord blocks */}
        <div className="relative h-full flex items-center w-full">
          {chords.length === 0 ? (
            <div className="w-full text-center text-green-600/60 font-medium">
              No chords detected yet. Start recording to detect chords.
            </div>
          ) : (
            mergedChords.map((chord, index) => {
              const startPercent = (chord.time / totalDuration) * 100;
              const widthPercent = (chord.duration / totalDuration) * 100;
              const isCurrent = isPlaying && currentTime >= chord.time && currentTime < chord.time + chord.duration;

              const colors = getChordColors(chord.root, progressionRoot);

              return (
                <React.Fragment key={index}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <motion.div
                        className={`absolute top-3 bottom-3 rounded-2xl transition-all duration-200 overflow-hidden border-2 cursor-pointer hover:brightness-95 group/chord ${isCurrent
                          ? `bg-gradient-to-br ${colors.active}`
                          : `bg-gradient-to-br ${colors.inactive}`
                          } shadow-xl`}
                        style={{
                          left: `${startPercent}%`,
                          width: `${widthPercent}%`
                        }}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <div className="h-full flex flex-col items-center justify-center px-2 relative">
                          <div className={`text-center font-bold text-lg ${isCurrent ? colors.activeText : colors.text}`}>
                            {chord.name}
                          </div>
                          <div className={`text-xs mt-1 font-medium ${isCurrent ? colors.activeSubText : colors.subText}`}>
                            {Math.round(chord.duration)}s
                          </div>

                          {/* Edit Icon on Hover */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover/chord:opacity-100 transition-opacity">
                            <Edit2 className={`w-3 h-3 ${isCurrent ? 'text-white/80' : 'text-green-800/50'}`} />
                          </div>
                        </div>
                      </motion.div>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-52">
                      <Command>
                        <CommandInput placeholder="Change chord..." />
                        <CommandList>
                          <CommandEmpty>No matching chord found.</CommandEmpty>
                          {renderSuggestionList(chord)}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* Draggable Boundary Handle */}
                  {
                    index < mergedChords.length - 1 && onTimingAdjust && (
                      <div
                        className="absolute top-0 bottom-0 w-3 -right-1.5 z-30 cursor-col-resize group/boundary"
                        style={{ left: `${startPercent + widthPercent}%` }}
                        onMouseDown={(e) => handleBoundaryMouseDown(e, index)}
                      >
                        {/* Hover indicator */}
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-green-600/0 group-hover/boundary:bg-green-600/50 transition-colors" />
                        {/* Active drag indicator */}
                        {draggingBoundary === index && (
                          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-green-600 shadow-lg" />
                        )}
                      </div>
                    )
                  }
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      {/* Chord list */}
      {
        mergedChords.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {mergedChords.map((chord, index) => {
              const isCurrent = isPlaying && currentTime >= chord.time && currentTime < chord.time + chord.duration;
              const colors = getChordColors(chord.root, progressionRoot);
              return (
                <Popover key={index}>
                  <PopoverTrigger asChild>
                    <div
                      className={`px-4 py-2 rounded-full text-sm font-bold transition-all border cursor-pointer hover:scale-105 ${isCurrent
                        ? colors.activeBadge
                        : colors.badge
                        }`}
                    >
                      {chord.name}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-52">
                    <Command>
                      <CommandInput placeholder="Change chord..." />
                        <CommandList>
                          <CommandEmpty>No matching chord found.</CommandEmpty>
                          {renderSuggestionList(chord)}
                        </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>
        )
      }
    </div >
  );
};

export default ChordProgression;
