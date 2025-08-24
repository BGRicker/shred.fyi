'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Guitar to avoid SSR issues
const Guitar = dynamic(() => import('react-guitar'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
      <div className="text-gray-500 dark:text-gray-400">Loading fretboard...</div>
    </div>
  ),
});

interface FretboardComponentProps {
  strings: number[];
  className?: string;
  highlightedNotes?: string[]; // Notes to highlight on the fretboard
  highlightMode?: 'chord' | 'progression' | 'both';
}

const FretboardComponent: React.FC<FretboardComponentProps> = ({
  strings,
  className = '',
  highlightedNotes = [],
  highlightMode = 'both',
}) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className={`fretboard-container ${className}`}>
        <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">Loading fretboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fretboard-container ${className}`}>
      {/* Main Guitar Fretboard */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Guitar Fretboard
        </h4>
        <Guitar
          key={strings.join(',')}
          strings={strings}
          center={true}
          frets={{ from: 0, amount: 8 }}
          className="w-full"
        />
      </div>

      {/* Scale Notes Display */}
      {highlightedNotes.length > 0 && (
        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {highlightMode === 'chord' ? 'Scale Notes for Current Chord' : 
             highlightMode === 'progression' ? 'Progression Scale Notes' : 
             'Highlighted Scale Notes'}
          </h4>
          <div className="flex flex-wrap gap-2">
            {highlightedNotes.map((note, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-mono border border-slate-200 dark:border-slate-600"
              >
                {note}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FretboardComponent;
