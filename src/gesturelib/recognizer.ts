import { Vec2 } from "../types";
import { extractFeatures } from "../recorder";
import { GestureLibrary, recognize } from "./importer";
import { Codebook, buildCodebook, matchWithCodebook } from "./codebook";

export class GestureRecognizer {
  private lib: GestureLibrary | null = null;
  private threshold = 0.6;
  private callbacks = new Map<string, (info: { id: string; code: string; name: string; distance: number }) => void>();
  private codebook: Codebook | null = null;
  private lastCode = "";
  private streak = 0;
  private minStreak = 3;
  private weights: number[] | null = null;
  private kFactor = 2;
  private mode: "codebook" | "knn" = "codebook";
  private k = 3;
  private windowSize = 1;
  private buffer: number[][] = [];
  setLibrary(lib: GestureLibrary) {
    this.lib = lib;
    this.codebook = buildCodebook(lib, this.weights || undefined, this.kFactor);
    this.lastCode = "";
    this.streak = 0;
  }
  setThreshold(t: number) {
    this.threshold = t;
  }
  setWeights(w: number[]) {
    this.weights = w;
    if (this.lib) this.codebook = buildCodebook(this.lib, w, this.kFactor);
  }
  setKFactor(k: number) {
    this.kFactor = k;
    if (this.lib) this.codebook = buildCodebook(this.lib, this.weights || undefined, k);
  }
  setMode(m: "codebook" | "knn") {
    this.mode = m;
  }
  setK(k: number) {
    this.k = k;
  }
  setWindowSize(n: number) {
    this.windowSize = Math.max(1, n);
    this.buffer = [];
  }
  on(code: string, fn: (info: { id: string; code: string; name: string; distance: number }) => void) {
    this.callbacks.set(code, fn);
  }
  recognizeFromLandmarks(landmarks: Vec2[] | null) {
    if (!this.lib || !landmarks || landmarks.length < 21) return null;
    const cur = extractFeatures(landmarks);
    let feats = cur;
    if (this.windowSize > 1) {
      this.buffer.push(cur);
      if (this.buffer.length > this.windowSize) this.buffer.shift();
      if (this.buffer.length === this.windowSize) {
        feats = new Array(cur.length).fill(0);
        for (const a of this.buffer) {
          for (let i = 0; i < feats.length; i++) feats[i] += a[i];
        }
        for (let i = 0; i < feats.length; i++) feats[i] /= this.buffer.length;
      }
    }
    let res = null as any;
    if (this.mode === "codebook" && this.codebook) {
      res = matchWithCodebook(feats, this.codebook);
    }
    if (!res) {
      if (this.mode === "knn") {
        res = this.knn(feats);
      } else {
        res = recognize(feats, this.lib, this.threshold);
      }
    }
    if (res) {
      if (res.code === this.lastCode) {
        this.streak++;
      } else {
        this.lastCode = res.code;
        this.streak = 1;
      }
      if (this.streak >= this.minStreak) {
        const cb = this.callbacks.get(res.code);
        if (cb) cb(res);
        return res;
      }
      return null;
    }
    return res;
  }
  private knn(feats: number[]) {
    const neigh: Array<{ id: string; code: string; name: string; dist: number }> = [];
    for (const g of this.lib!.byCode.values()) {
      for (const s of g.samples) {
        if (s.features.length !== feats.length) continue;
        let sum = 0;
        for (let i = 0; i < feats.length; i++) {
          const d = feats[i] - s.features[i];
          sum += d * d;
        }
        const dist = Math.sqrt(sum) / feats.length;
        neigh.push({ id: g.id, code: g.code, name: g.name, dist });
      }
    }
    neigh.sort((a, b) => a.dist - b.dist);
    const k = Math.min(this.k, neigh.length);
    const votes = new Map<string, { id: string; name: string; count: number; best: number }>();
    for (let i = 0; i < k; i++) {
      const n = neigh[i];
      const v = votes.get(n.code) || { id: n.id, name: n.name, count: 0, best: n.dist };
      v.count++;
      v.best = Math.min(v.best, n.dist);
      votes.set(n.code, v);
    }
    let bestCode = "";
    let bestId = "";
    let bestName = "";
    let bestCount = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const [code, v] of votes) {
      if (v.count > bestCount || (v.count === bestCount && v.best < bestDist)) {
        bestCode = code;
        bestId = v.id;
        bestName = v.name;
        bestCount = v.count;
        bestDist = v.best;
      }
    }
    if (!bestCode) return null;
    if (bestDist > this.threshold) return null;
    return { id: bestId, code: bestCode, name: bestName, distance: bestDist };
  }
}
