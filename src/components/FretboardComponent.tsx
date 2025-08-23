'use client';

import React from 'react';
import Guitar from 'react-guitar';

interface FretboardComponentProps {
  strings?: number[];
  className?: string;
}

const FretboardComponent: React.FC<FretboardComponentProps> = ({
  strings = [0, 1, 2, 2, 0, -1], // Default A minor chord
  className = '',
}) => {
  return (
    <div className={`fretboard-container ${className}`}>
      <Guitar
        strings={strings}
        center={true}
        frets={{ from: 0, amount: 15 }}
        className="w-full"
      />
    </div>
  );
};

export default FretboardComponent;
