import React from 'react';
import { Play, Pause, Square, Mic, RotateCcw } from 'lucide-react';

interface PlaybackControlsProps {
    isRecording: boolean;
    isPlaying: boolean;
    hasRecording: boolean;
    onRecord: () => void;
    onPlay: () => void;
    onStop: () => void;
    onReset: () => void;
}

export function PlaybackControls({
    isRecording,
    isPlaying,
    hasRecording,
    onRecord,
    onPlay,
    onStop,
    onReset
}: PlaybackControlsProps) {
    return (
        <div className="flex items-center justify-center gap-5">
            <button
                onClick={onRecord}
                disabled={isPlaying}
                className={`p-5 rounded-full transition-all shadow-lg ${isRecording
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-500/50 animate-pulse'
                    : 'bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-red-500/30'
                    }`}
                title={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
                {isRecording ? (
                    <Square className="w-7 h-7 text-white" />
                ) : (
                    <Mic className="w-7 h-7 text-white" />
                )}
            </button>

            <button
                onClick={onPlay}
                disabled={!hasRecording || isRecording}
                className="p-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-2xl shadow-green-500/40"
                title={isPlaying ? 'Stop' : 'Play'}
            >
                {isPlaying ? (
                    <Pause className="w-8 h-8 text-white" />
                ) : (
                    <Play className="w-8 h-8 text-white" />
                )}
            </button>

            <button
                onClick={onReset}
                disabled={isRecording || isPlaying}
                className="p-5 rounded-full bg-amber-100 hover:bg-amber-200 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all border-2 border-amber-300/60 shadow-lg shadow-amber-900/10"
                title="Reset"
            >
                <RotateCcw className="w-6 h-6 text-amber-800" />
            </button>
        </div>
    );
}
