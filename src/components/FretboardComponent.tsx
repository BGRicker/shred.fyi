'use client';

import React from 'react';
import Guitar from 'react-guitar';

interface FretboardComponentProps {
  strings: number[];
  className?: string;
}

const FretboardComponent: React.FC<FretboardComponentProps> = ({
  strings,
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
