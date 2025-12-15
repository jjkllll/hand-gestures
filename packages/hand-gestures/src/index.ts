export type Vec2 = { x: number; y: number };

export type ImportedSample = {
  id: string;
  name: string;
  code: string;
  features: number[];
  sampleHash: string;
  path: string;
};

export type ImportedGesture = {
  id: string;
  name: string;
  code: string;
  samples: ImportedSample[];
};

export type GestureLibrary = {
  byCode: Map<string, ImportedGesture>;
  byName: Map<string, string>;
};

function palmCenter(points: Vec2[]): Vec2 {
  const ids = [0, 5, 9, 13, 17];
  let x = 0,
    y = 0;
  for (const i of ids) {
    x += points[i].x;
    y += points[i].y;
  }
  const n = ids.length;
  return { x: x / n, y: y / n };
}
function scaleRef(points: Vec2[]): number {
  const w = points[0];
  const m = points[9];
  const dx = w.x - m.x;
  const dy = w.y - m.y;
  return Math.hypot(dx, dy);
}
export function extractFeatures(landmarks: Vec2[]): number[] {
  const c = palmCenter(landmarks);
  const s = Math.max(1e-4, scaleRef(landmarks));
  const feats: number[] = [];
  for (const p of landmarks) feats.push((p.x - c.x) / s, (p.y - c.y) / s);
  return feats;
}

function computeCode(id: string, name: string): string {
  const text = `${id}:${name}`;
  try {
    const crypto = require("node:crypto");
    return crypto.createHash("md5").update(text).digest("hex");
  } catch {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (h << 5) - h + text.charCodeAt(i);
      h |= 0;
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
}

async function readFileText(handle: FileSystemDirectoryHandle, name: string): Promise<string | null> {
  try {
    const fh = await handle.getFileHandle(name, { create: false });
    const file = await fh.getFile();
    return await file.text();
  } catch {
    return null;
  }
}
async function listJsonFiles(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const out: string[] = [];
  try {
    for await (const [n, h] of (dir as any).entries()) {
      if ((h as any).kind === "file" && n.toLowerCase().endsWith(".json")) out.push(n);
    }
  } catch {}
  return out;
}

export async function loadGesturesFromDirectory(root: FileSystemDirectoryHandle): Promise<GestureLibrary> {
  const byCode = new Map<string, ImportedGesture>();
  const byName = new Map<string, string>();
  for await (const [name, handle] of (root as any).entries()) {
    if ((handle as any).kind !== "directory") continue;
    const gDir = handle as FileSystemDirectoryHandle;
    const metaText = await readFileText(gDir, "meta.json");
    let id = "";
    let gname = name;
    if (metaText) {
      try {
        const meta = JSON.parse(metaText);
        id = String(meta.id ?? "");
        gname = String(meta.name ?? name);
      } catch {}
    }
    const code = computeCode(id, gname);
    const dataDir = await gDir.getDirectoryHandle("data", { create: false }).catch(() => null);
    const samples: ImportedSample[] = [];
    if (dataDir) {
      const files = await listJsonFiles(dataDir);
      for (const fn of files) {
        const txt = await readFileText(dataDir, fn);
        if (!txt) continue;
        try {
          const obj = JSON.parse(txt);
          const features: number[] = Array.isArray(obj.features) ? obj.features : [];
          const sampleHash: string = String(obj.sampleHash ?? "");
          samples.push({ id, name: gname, code, features, sampleHash, path: `data/${fn}` });
        } catch {}
      }
    }
    byCode.set(code, { id, name: gname, code, samples });
    byName.set(gname, code);
  }
  return { byCode, byName };
}

export async function loadGesturesFromPath(path: string): Promise<GestureLibrary> {
  const byCode = new Map<string, ImportedGesture>();
  const byName = new Map<string, string>();
  const fs = await import("fs/promises");
  const p = await import("path");
  const dirents = await fs.readdir(path, { withFileTypes: true });
  for (const d of dirents) {
    if (!d.isDirectory()) continue;
    const gname = d.name;
    const gPath = p.join(path, gname);
    let id = "";
    let name = gname;
    try {
      const metaTxt = await fs.readFile(p.join(gPath, "meta.json"), "utf-8");
      const meta = JSON.parse(metaTxt);
      id = String(meta.id ?? "");
      name = String(meta.name ?? gname);
    } catch {}
    const code = computeCode(id, name);
    const dataPath = p.join(gPath, "data");
    const samples: ImportedSample[] = [];
    try {
      const files = await fs.readdir(dataPath);
      for (const fn of files) {
        if (!fn.toLowerCase().endsWith(".json")) continue;
        try {
          const txt = await fs.readFile(p.join(dataPath, fn), "utf-8");
          const obj = JSON.parse(txt);
          const features: number[] = Array.isArray(obj.features) ? obj.features : [];
          const sampleHash: string = String(obj.sampleHash ?? "");
          samples.push({ id, name, code, features, sampleHash, path: p.join("data", fn) });
        } catch {}
      }
    } catch {}
    byCode.set(code, { id, name, code, samples });
    byName.set(name, code);
  }
  return { byCode, byName };
}

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
  for (const a of arrs) for (let i = 0; i < dim; i++) m[i] += a[i];
  const n = arrs.length;
  for (let i = 0; i < dim; i++) m[i] /= Math.max(1, n);
  return m;
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

export type CodebookEntry = {
  id: string;
  code: string;
  name: string;
  mean: number[];
  threshold: number;
  dists: number[];
};
export type Codebook = {
  entries: CodebookEntry[];
  weights: number[];
};
export function buildCodebook(lib: GestureLibrary, weights?: number[], kFactor = 2): Codebook {
  const entries: CodebookEntry[] = [];
  let dim = 0;
  for (const g of lib.byCode.values()) {
    if (g.samples.length === 0) continue;
    dim = g.samples[0].features.length;
    const feats = g.samples.map(s => s.features).filter(a => a.length === dim);
    if (feats.length === 0) continue;
    const mean = meanVector(feats, dim);
    const w = weights && weights.length === dim ? weights : makeWeights(dim);
    const dists = feats.map(f => weightedDistance(f, mean, w));
    const mu = dists.reduce((x, y) => x + y, 0) / dists.length;
    const sd = Math.sqrt(dists.reduce((x, y) => x + (y - mu) * (y - mu), 0) / Math.max(1, dists.length)) || 0.01;
    const th = mu + Math.max(0.05, sd * kFactor);
    entries.push({ id: g.id, code: g.code, name: g.name, mean, threshold: th, dists });
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

export class GestureRecognizer {
  private lib: GestureLibrary | null = null;
  private threshold = 0.8;
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
  setWeights(w: number[]) {
    this.weights = w;
    if (this.lib) this.codebook = buildCodebook(this.lib, w, this.kFactor);
  }
  setKFactor(k: number) {
    this.kFactor = k;
    if (this.lib) this.codebook = buildCodebook(this.lib, this.weights || undefined, k);
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
        for (const a of this.buffer) for (let i = 0; i < feats.length; i++) feats[i] += a[i];
        for (let i = 0; i < feats.length; i++) feats[i] /= this.buffer.length;
      }
    }
    let res = null as any;
    if (this.mode === "codebook" && this.codebook) res = matchWithCodebook(feats, this.codebook);
    if (!res) {
      if (this.mode === "knn") res = this.knn(feats);
      else res = nearest(feats, this.lib, this.threshold);
    }
    if (res) {
      if (res.code === this.lastCode) this.streak++;
      else {
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

export function nearest(features: number[], lib: GestureLibrary, threshold = 0.8) {
  let bestCode = "";
  let bestId = "";
  let bestName = "";
  let bestDist = Number.POSITIVE_INFINITY;
  for (const g of lib.byCode.values()) {
    for (const s of g.samples) {
      if (s.features.length !== features.length) continue;
      let sum = 0;
      for (let i = 0; i < features.length; i++) {
        const d = features[i] - s.features[i];
        sum += d * d;
      }
      const dist = Math.sqrt(sum) / features.length;
      if (dist < bestDist) {
        bestDist = dist;
        bestCode = g.code;
        bestId = g.id;
        bestName = g.name;
      }
    }
  }
  if (bestCode && bestDist <= threshold) return { id: bestId, code: bestCode, name: bestName, distance: bestDist };
  return null;
}
