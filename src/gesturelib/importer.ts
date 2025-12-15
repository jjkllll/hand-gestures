import { computeGestureCode } from "../recorder";

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
    const code = computeGestureCode(id, gname);
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
    const code = computeGestureCode(id, name);
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

export function recognize(features: number[], lib: GestureLibrary, threshold = 0.6) {
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
  if (bestCode && bestDist <= threshold) {
    return { id: bestId, code: bestCode, name: bestName, distance: bestDist };
  }
  return null;
}

export async function loadGesturesFromStatic(): Promise<GestureLibrary> {
  const byCode = new Map<string, ImportedGesture>();
  const byName = new Map<string, string>();
  const metaMods = import.meta.glob("../assets/handcode/gestures/**/meta.json", { eager: true }) as Record<
    string,
    any
  >;
  const dataMods = import.meta.glob("../assets/handcode/gestures/**/data/*.json", { eager: true }) as Record<
    string,
    any
  >;
  const gestureInfo = new Map<
    string,
    {
      id: string;
      name: string;
      code: string;
      samples: ImportedSample[];
    }
  >();
  for (const [path, mod] of Object.entries(metaMods)) {
    const meta = mod.default || mod;
    const id = String(meta.id ?? "");
    const name = String(meta.name ?? "");
    const code = computeGestureCode(id, name);
    gestureInfo.set(code, { id, name, code, samples: [] });
  }
  for (const [path, mod] of Object.entries(dataMods)) {
    const obj = mod.default || mod;
    const features: number[] = Array.isArray(obj.features) ? obj.features : [];
    const sampleHash: string = String(obj.sampleHash ?? "");
    const parts = path.split("/");
    const idx = parts.findIndex(p => p === "gestures");
    if (idx >= 0 && idx + 1 < parts.length) {
      const nameDir = parts[idx + 1];
      let target = Array.from(gestureInfo.values()).find(g => g.name === nameDir);
      if (!target) {
        const id = "";
        const name = nameDir;
        const code = computeGestureCode(id, name);
        target = { id, name, code, samples: [] };
        gestureInfo.set(code, target);
      }
      target.samples.push({
        id: target.id,
        name: target.name,
        code: target.code,
        features,
        sampleHash,
        path
      });
    }
  }
  for (const g of gestureInfo.values()) {
    byCode.set(g.code, { id: g.id, name: g.name, code: g.code, samples: g.samples });
    byName.set(g.name, g.code);
  }
  return { byCode, byName };
}
