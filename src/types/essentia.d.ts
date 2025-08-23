declare module 'essentia.js' {
  export interface EssentiaJS {
    HPCP(audioBuffer: Float32Array): Float32Array;
    ChordsDetection(hpcp: Float32Array): { chords: string[]; strength: number[] };
    onRuntimeInitialized: Promise<void>;
    EssentiaWASM?: unknown;
  }

  export class Essentia implements EssentiaJS {
    constructor();
    HPCP(audioBuffer: Float32Array): Float32Array;
    ChordsDetection(hpcp: Float32Array): { chords: string[]; strength: number[] };
    onRuntimeInitialized: Promise<void>;
  }

  export const EssentiaWASM: unknown;
  export const EssentiaModel: unknown;
  export const EssentiaExtractor: unknown;
  export const EssentiaPlot: unknown;
}
