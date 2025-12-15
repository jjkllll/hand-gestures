import { extractFeatures } from "../recorder";
import {
  loadGesturesFromDirectory,
  loadGesturesFromPath,
  loadGesturesFromStatic,
  GestureLibrary
} from "../gesturelib";
import { GestureRecognizer } from "../gesturelib";
import { registerMapping, applyGesture } from "../gesturelib";

export type HandRecognizerOptions = {
  threshold?: number;
  mode?: "codebook" | "knn";
  k?: number;
  windowSize?: number;
  weights?: number[];
  kFactor?: number;
};

export class HandGestures {
  static async loadFromDirectory(root: FileSystemDirectoryHandle): Promise<GestureLibrary> {
    return await loadGesturesFromDirectory(root);
  }
  static async loadFromPath(path: string): Promise<GestureLibrary> {
    return await loadGesturesFromPath(path);
  }
  static async loadFromStatic(): Promise<GestureLibrary> {
    return await loadGesturesFromStatic();
  }
  static createRecognizer(lib: GestureLibrary, opts: HandRecognizerOptions = {}) {
    const r = new GestureRecognizer();
    r.setLibrary(lib);
    if (opts.threshold !== undefined) r.setThreshold(opts.threshold);
    if (opts.mode) r.setMode(opts.mode);
    if (opts.k !== undefined) r.setK(opts.k);
    if (opts.windowSize !== undefined) r.setWindowSize(opts.windowSize);
    if (opts.weights) r.setWeights(opts.weights);
    if (opts.kFactor !== undefined) r.setKFactor(opts.kFactor);
    return r;
  }
  static on(code: string, fn: (info: { id: string; code: string; name: string; distance: number }) => void) {
    registerMapping(code, payload => fn(payload));
  }
  static apply(code: string, payload: any) {
    applyGesture(code, payload);
  }
  static features(landmarks: { x: number; y: number }[]) {
    return extractFeatures(landmarks as any);
  }
  static async easySetupFromStatic(opts: HandRecognizerOptions = {}) {
    const lib = await HandGestures.loadFromStatic();
    const r = HandGestures.createRecognizer(lib, opts);
    return {
      recognizer: r,
      on: (code: string, fn: (info: { id: string; code: string; name: string; distance: number }) => void) =>
        r.on(code, fn)
    };
  }
}

export default HandGestures;
