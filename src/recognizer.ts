import { Vec2 } from "./types";
import { extractFeatures } from "./recorder";
import { GestureLibrary, recognize } from "./importer";

export class GestureRecognizer {
  private lib: GestureLibrary | null = null;
  private threshold = 0.6;
  private callbacks = new Map<string, (info: { code: string; name: string; distance: number }) => void>();
  setLibrary(lib: GestureLibrary) {
    this.lib = lib;
  }
  setThreshold(t: number) {
    this.threshold = t;
  }
  on(code: string, fn: (info: { code: string; name: string; distance: number }) => void) {
    this.callbacks.set(code, fn);
  }
  recognizeFromLandmarks(landmarks: Vec2[] | null) {
    if (!this.lib || !landmarks || landmarks.length < 21) return null;
    const feats = extractFeatures(landmarks);
    const res = recognize(feats, this.lib, this.threshold);
    if (res) {
      const cb = this.callbacks.get(res.code);
      if (cb) cb(res);
    }
    return res;
  }
}
