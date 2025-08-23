'use client';

import React from 'react';
import { ScaleSuggestion } from '@/lib/musicTheory';

interface ScaleSuggestionsProps {
  suggestions: ScaleSuggestion[];
  className?: string;
}

const ScaleSuggestions: React.FC<ScaleSuggestionsProps> = ({
  suggestions,
  className = '',
}) => {
  if (suggestions.length === 0) {
    return (
      <div className={`scale-suggestions ${className}`}>
        <p className="text-slate-500 dark:text-slate-400 italic">
          No scale suggestions available
        </p>
      </div>
    );
  }

  const getQualityBadgeStyle = (quality: ScaleSuggestion['quality']) => {
    switch (quality) {
      case 'perfect':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'good':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'possible':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
    }
  };

  const getQualityLabel = (quality: ScaleSuggestion['quality']) => {
    switch (quality) {
      case 'perfect':
        return 'Perfect Match';
      case 'good':
        return 'Good Fit';
      case 'possible':
        return 'Possible';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={`scale-suggestions ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 border border-slate-200 dark:border-slate-600"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-slate-800 dark:text-slate-100">
                {suggestion.name}
              </h4>
              <span
                className={`
                  px-2 py-1 text-xs font-medium rounded-full
                  ${getQualityBadgeStyle(suggestion.quality)}
                `}
              >
                {getQualityLabel(suggestion.quality)}
              </span>
            </div>
            
            <div className="space-y-2">
              <div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Notes
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {suggestion.notes.map((note, noteIndex) => (
                    <span
                      key={noteIndex}
                      className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1 rounded text-sm font-mono"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Intervals
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
                  {suggestion.intervals.join(' - ')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScaleSuggestions;
