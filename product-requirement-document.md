Here’s a **Product Requirement Document (PRD)** draft for your guitar-practice app. I’ve written it in a way you could paste into Cursor or another LLM editor to start scaffolding code, tests, and tasks.

---

# Product Requirement Document: Guitar Practice Assistant

## Overview

A web application that listens to guitar playing through the microphone, detects chords and progressions in real time, and provides visual + theoretical feedback. The app highlights playable scales and notes on a fretboard visualization and supports looping for practice.

---

## Goals

* Help guitarists practice improvisation and chord recognition.
* Provide **real-time chord detection** with feedback on scales/notes that fit.
* Visualize chords, scales, and intervals on an **interactive fretboard**.
* Offer **record & loop playback** of a user’s chord progression.

---

## Target Users

* Guitarists (beginner → intermediate → advanced) looking to practice soloing over chord progressions.
* Music students interested in theory-in-practice feedback.
* Teachers demonstrating chord/scale relationships.

---

## Core Features

### 1. Audio Capture & Chord Recognition

* **Microphone input**: Accessed via Web Audio API (`getUserMedia`).
* **Real-time detection**:

  * **Essentia.js** (primary): Extract chroma/HPCP and detect triads (maj/min).
  * **Fallback / extended chords**: Optionally batch-send audio snippets to a **Python service with chord-extractor** for 7ths, 9ths, altered chords, etc.
* **Detection granularity**: Should identify chord changes at least every 1–2 seconds.

### 2. Music Theory Analysis

* **Tonal.js integration**:

  * Detect chord qualities (maj/min/7th/etc.).
  * Compute intervals relative to root chord.
  * Suggest scales/modes for individual chords and entire progressions.
* **Scale recommendation logic**:

  * For each chord: highlight compatible scales.
  * For progression: recommend common/shared scale options (e.g., C major across I–V–vi–IV).

### 3. Fretboard Visualization

* Component: Use **react-guitar** or **react-fretboard** (instead of custom CodePen).
* Display:

  * Highlight chord tones and scale tones.
  * Interactive toggle: view chord notes, view scale notes, or both.
* Responsive: works on desktop + mobile.

### 4. Recording & Looping

* Button: **Record / Stop Recording** progression.
* After recording:

  * Display detected chord progression timeline.
  * Allow playback (metronome optional).
* **Stretch goal**: Automatically trim the recording to the nearest bar length for seamless looping.

---

## Stretch Features (Future Roadmap)

* Backing tracks with generated rhythm section (drums/bass).
* Tempo detection and metronome sync.
* Export chord progression as MIDI or chord chart (PDF).
* AI practice suggestions: “Try Mixolydian here” or “Target the 3rd on this chord.”

---

## Technical Architecture

### Frontend

* **Framework**: Next.js (React + API routes).
* **Audio analysis**: Web Audio API + Essentia.js/Meyda in an AudioWorklet.
* **Visualization**: React components for fretboard + UI (buttons, timeline).
* **State management**: React hooks or Zustand/Recoil for lightweight state.

### Backend

* **Primary mode**: Fully client-side (Next.js + Essentia.js).
* **Optional service**: Python microservice with `chord-extractor` (FastAPI/Flask) for extended chord recognition on uploaded snippets.
* **Deployment**:

  * Frontend: Vercel (ideal for Next.js).
  * Backend (if needed): Fly.io, Render, or AWS Lambda + Docker.

### Data Flow

1. User presses **Record** → audio stream captured.
2. Essentia.js processes stream → notes/chords detected.
3. Tonal.js processes chord list → intervals/scales suggested.
4. UI updates fretboard with highlights + progression timeline.
5. (Optional) Recorded snippet sent to Python API for higher-accuracy chord detection.

---

## UX / UI Requirements

* Minimalist design, guitar-centric.
* Main screen:

  * Fretboard across top.
  * Detected chord + suggested scales shown above.
  * Record/Stop button prominent.
* After recording:

  * Timeline of chords displayed.
  * Loop toggle.
  * Option to retry.

---

## Open Questions

* How accurate does v1 need to be (basic triads vs. full jazz chords)?
* Should looping sync to a tempo grid, or is free-form acceptable at first?
* Do we need to persist user sessions (chord history, saved loops) or keep it stateless?