# Shredly - Guitar Practice Assistant

A web application that listens to guitar playing through the microphone, detects chords and progressions in real time, and provides visual + theoretical feedback. The app highlights playable scales and notes on a fretboard visualization and supports low-latency looping for practice.

## 🎸 Core Features

### Real-Time Chord Detection
- Microphone input via Web Audio API (guitar-friendly settings)
- Real-time chord recognition using Tonal.js
- Progression analysis with scale suggestions (chord-level and progression-wide)
- Smart silence detection for automatic recording stop

### Interactive Fretboard Visualization
- Scale note highlighting across the entire fretboard
- Distinct layers for Progression Scale (base) and Chord-of-the-Moment Scale (overlay)
- Root note distinction with separate styling
- Interval information from root to displayed scale notes
- Multiple display modes: chord, progression, or both
- Accurate enharmonic handling (flats normalized internally to sharps)

### Recording & Looping
- 3-second countdown with click sounds before recording starts
- Automatic silence trimming using OfflineAudioContext
- Ultra-low-latency loop playback using native Web Audio API looping
- Chord timeline visualization during playback
- Clearing the recording now stops the loop immediately

### Scale Overrides (New)
- Click any suggested scale to set it as the active scale for:
  - The current chord (Chord-of-the-Moment)
  - The entire progression (Progression Scale)
- Fretboard updates immediately and shows the selected override as active

### Progressive UI (New)
- Fretboard, scale recommendations, and Current Chord are hidden until the first chord is detected to keep the initial UI focused

## 🚀 Technical Approach

### Audio Pipeline
- Recording: MediaRecorder (mono, 44.1kHz) with guitar-friendly constraints
- Live analysis: Web Audio API `AnalyserNode` → custom frequency analysis → Tonal.js
- Trimming: OfflineAudioContext-based silence removal
- Playback/Looping: Web Audio API `AudioBufferSourceNode` with drift-free scheduling

### Music Theory
- Tonal.js for chord and scale analysis
- Context-aware blues logic for I–IV–V progressions
- Compatibility scoring based on chord tones vs scale notes

### Fretboard
- `react-guitar` base with CSS Grid overlay for precise scale note rendering
- Single-pass rendering model to prevent visual accumulation/duplicates

## 🖥 Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
# or: yarn dev / pnpm dev / bun dev
```

Open the URL printed in your terminal (typically `http://localhost:3000`).

## 🔧 Technical Stack
- Frontend: Next.js (App Router), React, Tailwind CSS
- Audio: Web Audio API, MediaRecorder API
- Music Theory: Tonal.js
- Fretboard: `react-guitar`

## 📌 Notes
- Voice commands (e.g., saying "stop" to stop the loop) are not implemented; feasible via Web Speech API if desired.
- Essentia.js bindings/types exist for future use, but current analysis runs on custom frequency analysis with Tonal.js.

## 📚 Learn More
- Looper notes and technical ideas: `docs/looper-technical.md`
- Product Requirements: `product-requirement-document.md`
