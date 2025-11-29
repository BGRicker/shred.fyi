declare module 'essentia.js' {
  export interface VectorFloat {
    delete(): void;
  }

  export interface VectorVectorFloat {
    push_back(value: VectorFloat): void;
    get(index: number): VectorFloat;
    size(): number;
    delete(): void;
  }

  export interface EssentiaJS {
    Spectrum(frame: VectorFloat): { spectrum: Float32Array };
    SpectralPeaks(spectrum: Float32Array): { frequencies: Float32Array; magnitudes: Float32Array };
    HPCP(frequencies: Float32Array, magnitudes: Float32Array): { hpcp: Float32Array };
    ChordsDetection(hpcp: VectorVectorFloat): { chords: string[]; strength: number[] };
    onRuntimeInitialized: Promise<void>;
    EssentiaWASM?: unknown;
    arrayToVector(array: Float32Array | number[]): VectorFloat;
    vectorToArray(vector: VectorFloat): Float32Array;
    delete(): void;
  }

  export class Essentia {
    constructor(wasmModule: unknown);
    Spectrum(frame: VectorFloat): { spectrum: Float32Array };
    SpectralPeaks(spectrum: Float32Array): { frequencies: Float32Array; magnitudes: Float32Array };
    HPCP(frequencies: Float32Array, magnitudes: Float32Array): { hpcp: Float32Array };
    ChordsDetection(pcp: VectorVectorFloat): { chords: string[]; strength: number[] };
    arrayToVector(array: Float32Array | number[]): VectorFloat;
    vectorToArray(vector: VectorFloat): Float32Array;
    delete(): void;
  }

  export const EssentiaWASM: unknown;
}

declare module 'essentia.js/dist/essentia.js-core.es.js' {
  interface VectorFloat {
    delete(): void;
  }

  interface VectorVectorFloat {
    push_back(value: VectorFloat): void;
    get(index: number): VectorFloat;
    size(): number;
    delete(): void;
  }

  export default class Essentia {
    constructor(wasmModule: unknown);
    Spectrum(frame: VectorFloat): { spectrum: Float32Array };
    SpectralPeaks(spectrum: Float32Array): { frequencies: Float32Array; magnitudes: Float32Array };
    HPCP(frequencies: Float32Array, magnitudes: Float32Array): { hpcp: Float32Array };
    ChordsDetection(hpcp: VectorVectorFloat): { chords: string[]; strength: number[] };
    arrayToVector(array: Float32Array | number[]): VectorFloat;
    vectorToArray(vector: VectorFloat): Float32Array;
    delete(): void;
  }
}

declare module 'essentia.js/dist/essentia-wasm.web.js' {
  const EssentiaWASM: unknown;
  export default EssentiaWASM;
}
