# Shredly - Guitar Practice Assistant

A web application that listens to guitar playing through the microphone, detects chords and progressions in real time, and provides visual + theoretical feedback. The app highlights playable scales and notes on a fretboard visualization and supports **zero-latency looping** for practice.

## 🎸 Core Features

### Real-Time Chord Detection
- **Microphone input** via Web Audio API
- **Real-time chord recognition** using Tonal.js
- **Progression analysis** with scale suggestions
- **Smart silence detection** for automatic recording start/stop

### Interactive Fretboard Visualization
- **Scale note highlighting** across the entire fretboard
- **Root note distinction** with different colors
- **Interval information** from root to scale notes
- **Multiple display modes**: Chord notes, progression scales, or both

### Professional Recording & Looping System
- **3-second countdown** with click sounds for predictable recording start
- **Automatic silence trimming** from both ends of recordings
- **Zero-latency loop restart** using pre-buffered circular audio
- **Chord timeline visualization** showing which chord plays when
- **Multiple audio systems** for maximum compatibility:
  - **Circular Buffer System** (Primary): Pre-allocated 2x loop buffer for seamless transitions
  - **Gapless Buffer System** (Secondary): 3x loop buffer with chained audio sources
  - **Native Web Audio Looping** (Tertiary): Hardware-accelerated native looping
  - **Howler.js** (Fallback): High-performance audio library

## 🚀 Technical Approach

### Zero-Latency Looping Architecture
Our looper uses a **multi-tier audio system** to achieve true zero-latency loop restart:

1. **Circular Buffer (Primary)**: Creates a 2x loop duration buffer with native Web Audio API looping
2. **Gapless Buffer (Secondary)**: 3x loop buffer with chained AudioBufferSourceNode instances
3. **Native Looping (Tertiary)**: Web Audio API's built-in `source.loop = true` with precise boundaries
4. **Howler.js (Fallback)**: 60fps monitoring for instant loop detection

### Audio Processing Pipeline
- **Recording**: MediaRecorder with real-time silence detection
- **Trimming**: OfflineAudioContext for precise silence removal
- **Playback**: Hardware-accelerated audio scheduling
- **Looping**: Pre-allocated buffers with native browser timing

## 🎵 User Experience

### Recording Workflow
1. **Click "Start Recording"** → 3-second countdown begins
2. **Hear 3 clicks** → Get ready to play
3. **Final click (different sound)** → Start playing immediately
4. **Recording starts** → Perfect timing guaranteed

### Practice Features
- **Chord timeline** shows progression structure
- **Scale suggestions** for each chord and entire progression
- **Fretboard highlighting** of safe notes to play
- **Seamless looping** for continuous practice

## 🛠 Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result.

## 🎯 Target Users

- **Guitarists** (beginner → intermediate → advanced) looking to practice soloing over chord progressions
- **Music students** interested in theory-in-practice feedback
- **Teachers** demonstrating chord/scale relationships

## 🔧 Technical Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS v4
- **Audio**: Web Audio API, MediaRecorder API, Howler.js
- **Music Theory**: Tonal.js for chord/scale analysis
- **Fretboard**: react-guitar library with custom overlays
- **Deployment**: Vercel (optimized for Next.js)

## 📚 Learn More

To learn more about the technical implementation, see:
- [Looper Technical Documentation](./docs/looper-technical.md) - Detailed explanation of the looping system
- [Product Requirements](./product-requirement-document.md) - Complete feature specification

## 🚀 Deploy on Vercel

The easiest way to deploy this Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
