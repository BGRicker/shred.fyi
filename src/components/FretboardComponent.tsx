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
}

const FretboardComponent: React.FC<FretboardComponentProps> = ({
  strings,
  className = '',
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
      <Guitar
        key={strings.join(',')}
        strings={strings}
        center={true}
        frets={{ from: 0, amount: 15 }}
        className="w-full"
      />
    </div>
  );
};

export default FretboardComponent;
