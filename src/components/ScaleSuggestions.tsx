import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { ScaleSuggestion } from '@/types/music';

interface ScaleSuggestionsProps {
  suggestions: ScaleSuggestion[];
  activeScaleName?: string;
  onScaleSelect: (scaleName: string) => void;
  currentChordName?: string;
  scaleMode?: 'fixed' | 'follow';
  onScaleModeChange?: (mode: 'fixed' | 'follow') => void;
}

const ScaleSuggestions: React.FC<ScaleSuggestionsProps> = ({
  suggestions,
  activeScaleName,
  onScaleSelect,
  currentChordName,
  scaleMode = 'fixed',
  onScaleModeChange
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedScale =
    suggestions.find(s => s.name.toLowerCase() === (activeScaleName || '').toLowerCase()) ||
    suggestions[0];

  if (!selectedScale) return null;

  return (
    <div className="w-full bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-2xl shadow-green-900/20 border-2 border-white relative z-30">
      <div className="flex flex-wrap items-center gap-4">
        {/* Mode Toggle */}
        {onScaleModeChange && (
          <>
            <div className="flex items-center gap-3 bg-green-50/80 px-4 py-3 rounded-2xl border border-green-200">
              <span className="text-sm text-green-800 font-bold">Mode:</span>
              <button
                onClick={() => onScaleModeChange('fixed')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${scaleMode === 'fixed'
                  ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-600/30'
                  : 'bg-white border-green-300 text-green-800 hover:bg-green-50'
                  }`}
              >
                Fixed Scale
              </button>
              <button
                onClick={() => onScaleModeChange('follow')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${scaleMode === 'follow'
                  ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-600/30'
                  : 'bg-white border-green-300 text-green-800 hover:bg-green-50'
                  }`}
              >
                Follow Chords
              </button>
            </div>

            {/* Divider */}
            <div className="h-10 w-px bg-green-300/50"></div>
          </>
        )}

        {/* Scale Selector */}
        <div className="flex-1 min-w-[300px] relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full bg-green-50/80 text-green-800 rounded-2xl px-4 py-3 flex items-center justify-between transition-colors border-2 border-green-200 hover:bg-green-100 hover:border-green-300"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-700 font-bold">Scale:</span>
              <span className="text-sm text-green-900 font-bold">{selectedScale.name}</span>
              <span className="text-xs text-green-500/50">•</span>
              <span className="text-xs text-green-700/70">
                {selectedScale.quality === 'perfect' ? 'Perfect Match' : 'Good Match'}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 transition-transform flex-shrink-0 text-green-700 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white backdrop-blur-md rounded-2xl border-2 border-green-300 shadow-2xl z-50 max-h-96 overflow-y-auto"
              >
                {suggestions.map((option) => (
                  <button
                    key={option.name}
                    onClick={() => {
                      onScaleSelect(option.name);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 transition-colors border-b border-green-200/40 last:border-b-0 ${selectedScale.name === option.name
                      ? 'bg-green-500 text-white'
                      : 'hover:bg-green-50 text-green-800'
                      }`}
                  >
                    <div className="text-sm font-bold">{option.name}</div>
                    <div className={`text-xs mt-0.5 ${selectedScale.name === option.name ? 'text-green-100' : 'text-green-700/70'}`}>
                      {option.quality === 'perfect' ? 'Perfect Match' : 'Good Match'}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Current Chord */}
        {currentChordName && (
          <>
            <div className="h-10 w-px bg-green-300/50"></div>
            <div className="text-sm text-green-700 bg-green-50/80 px-4 py-3 rounded-2xl border border-green-200 font-medium">
              Now playing: <span className="text-green-900 font-bold">{currentChordName}</span>
            </div>
          </>
        )}

        {/* Divider */}
        <div className="h-10 w-px bg-green-300/50"></div>

        {/* Scale Notes */}
        <div className="flex items-center gap-3 bg-green-50/80 px-4 py-3 rounded-2xl border border-green-200">
          <span className="text-sm text-green-700 font-bold">Notes:</span>
          <div className="flex flex-wrap gap-1.5">
            {selectedScale.notes.map((note, index) => (
              <div
                key={index}
                className="px-3 py-1 bg-white text-green-800 rounded-full text-xs font-bold border-2 border-green-300 shadow-sm"
              >
                {note}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScaleSuggestions;
