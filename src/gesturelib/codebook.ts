import { GestureLibrary } from "./importer";

export type CodebookEntry = {
  id: string;
  code: string;
  name: string;
  mean: number[];
  sigma: number[];
  threshold: number;
  dists: number[];
};

export type Codebook = {
  entries: CodebookEntry[];
  weights: number[];
};

function makeWeights(dim: number): number[] {
  const w: number[] = new Array(dim).fill(1);
  const tipIdx = [4, 8, 12, 16, 20];
  for (const i of tipIdx) {
    const xi = i * 2;
    const yi = xi + 1;
    if (xi < dim) w[xi] = 2;
    if (yi < dim) w[yi] = 2;
  }
  return w;
}

function meanVector(arrs: number[][], dim: number): number[] {
  const m = new Array(dim).fill(0);
  for (const a of arrs) {
    for (let i = 0; i < dim; i++) m[i] += a[i];
  }
  const n = arrs.length;
  for (let i = 0; i < dim; i++) m[i] /= Math.max(1, n);
  return m;
}

function sigmaVector(arrs: number[][], mean: number[], dim: number): number[] {
  const v = new Array(dim).fill(0);
  for (const a of arrs) {
    for (let i = 0; i < dim; i++) {
      const d = a[i] - mean[i];
      v[i] += d * d;
    }
  }
  const n = Math.max(1, arrs.length);
  for (let i = 0; i < dim; i++) v[i] = Math.sqrt(v[i] / n);
  return v;
}

function weightedDistance(a: number[], b: number[], w: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length, w.length);
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    s += w[i] * d * d;
  }
  return Math.sqrt(s) / n;
}

export function buildCodebook(lib: GestureLibrary, weights?: number[], kFactor = 2): Codebook {
  const entries: CodebookEntry[] = [];
  let dim = 0;
  for (const g of lib.byCode.values()) {
    if (g.samples.length === 0) continue;
    dim = g.samples[0].features.length;
    const feats = g.samples.map(s => s.features).filter(a => a.length === dim);
    if (feats.length === 0) continue;
    const mean = meanVector(feats, dim);
    const sigma = sigmaVector(feats, mean, dim);
    const w = weights && weights.length === dim ? weights : makeWeights(dim);
    const dists = feats.map(f => weightedDistance(f, mean, w));
    const mu = dists.reduce((x, y) => x + y, 0) / dists.length;
    const sd =
      Math.sqrt(dists.reduce((x, y) => x + (y - mu) * (y - mu), 0) / Math.max(1, dists.length)) || 0.01;
    const th = mu + Math.max(0.05, sd * kFactor);
    entries.push({ id: g.id, code: g.code, name: g.name, mean, sigma, threshold: th, dists });
  }
  const w = weights && weights.length === (dim || 42) ? weights : makeWeights(dim || 42);
  return { entries, weights: w };
}

export function matchWithCodebook(feats: number[], cb: Codebook) {
  let best: { id: string; code: string; name: string; distance: number } | null = null;
  for (const e of cb.entries) {
    const d = weightedDistance(feats, e.mean, cb.weights);
    if (!best || d < best.distance) best = { id: e.id, code: e.code, name: e.name, distance: d };
  }
  if (!best) return null;
  const entry = cb.entries.find(x => x.code === best!.code);
  if (!entry) return null;
  if (best.distance <= entry.threshold) return best;
  return null;
}
