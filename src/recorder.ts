import MD5 from "crypto-js/md5";
import CryptoJS from "crypto-js";
import { GestureType, Vec2 } from "./types";

export type GestureSample = {
  name: string;
  code: string;
  sampleHash: string;
  ts: number;
  features: number[];
};

function scaleRef(points: Vec2[]): number {
  const w = points[0];
  const m = points[9]; // middle MCP
  const dx = w.x - m.x;
  const dy = w.y - m.y;
  return Math.hypot(dx, dy);
}

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

export function extractFeatures(landmarks: Vec2[]): number[] {
  const c = palmCenter(landmarks);
  const s = Math.max(1e-4, scaleRef(landmarks));
  const feats: number[] = [];
  for (const p of landmarks) {
    feats.push((p.x - c.x) / s, (p.y - c.y) / s);
  }
  return feats;
}

export function gestureNameFromType(t: GestureType): string {
  switch (t) {
    case GestureType.OpenPalm:
      return "OpenPalm";
    case GestureType.Fist:
      return "Fist";
    case GestureType.Pinch:
      return "Pinch";
    case GestureType.Point:
      return "Point";
    case GestureType.Victory:
      return "Victory";
    default:
      return "None";
  }
}

export async function chooseDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!("showDirectoryPicker" in window)) return null;
  const handle = await (window as any).showDirectoryPicker();
  return handle as FileSystemDirectoryHandle;
}

async function ensureSubdir(dir: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle> {
  return dir.getDirectoryHandle(name, { create: true });
}

async function writeFile(dir: FileSystemDirectoryHandle, path: string, content: string) {
  const parts = path.split("/").filter(Boolean);
  let current = dir;
  for (let i = 0; i < parts.length - 1; i++) {
    current = await ensureSubdir(current, parts[i]);
  }
  const fileName = parts[parts.length - 1];
  const fileHandle = await current.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function writeBlob(dir: FileSystemDirectoryHandle, path: string, blob: Blob) {
  const parts = path.split("/").filter(Boolean);
  let current = dir;
  for (let i = 0; i < parts.length - 1; i++) {
    current = await ensureSubdir(current, parts[i]);
  }
  const fileName = parts[parts.length - 1];
  const fileHandle = await current.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function saveGestureSample(
  dir: FileSystemDirectoryHandle,
  landmarks: Vec2[],
  typeOrName: GestureType | string
) {
  const feats = extractFeatures(landmarks);
  const name = typeof typeOrName === "string" ? typeOrName : gestureNameFromType(typeOrName);
  const code = MD5(name).toString();
  const sampleHash = MD5(JSON.stringify(feats)).toString();
  const sample: GestureSample = {
    name,
    code,
    sampleHash,
    ts: Date.now(),
    features: feats
  };
  const baseDir = await ensureSubdir(dir, "gestures");
  const subDir = await ensureSubdir(baseDir, name);
  await writeFile(subDir, `${sample.code}.json`, JSON.stringify(sample, null, 2));
  const indexPath = "gestures/index.json";
  // update mapping index
  let index: Record<string, string> = {};
  try {
    const fileHandle = await baseDir.getFileHandle("index.json", { create: true });
    const file = await fileHandle.getFile();
    const text = await file.text();
    if (text.trim().length > 0) index = JSON.parse(text);
  } catch {}
  index[sample.code] = name;
  await writeFile(baseDir, "index.json", JSON.stringify(index, null, 2));
  return sample;
}

export function computeGestureCode(id: string, name: string): string {
  return MD5(`${id}:${name}`).toString();
}

export async function saveGestureSession(
  dir: FileSystemDirectoryHandle,
  id: string,
  name: string,
  samples: Array<{ ts: number; features: number[]; sampleHash: string }>
) {
  const baseDir = await ensureSubdir(dir, "gestures");
  const code = computeGestureCode(id, name);
  const gDir = await ensureSubdir(baseDir, code);
  const sDir = await ensureSubdir(gDir, "samples");
  const meta = { id, name, code, count: samples.length, ts: Date.now(), version: 1 };
  await writeFile(gDir, "meta.json", JSON.stringify(meta, null, 2));
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const fileName = `sample-${i + 1}.json`;
    await writeFile(sDir, fileName, JSON.stringify(s, null, 2));
  }
  let index: Record<string, { id: string; name: string }> = {};
  try {
    const fileHandle = await baseDir.getFileHandle("index.json", { create: true });
    const file = await fileHandle.getFile();
    const text = await file.text();
    if (text.trim().length > 0) index = JSON.parse(text);
  } catch {}
  index[code] = { id, name };
  await writeFile(baseDir, "index.json", JSON.stringify(index, null, 2));
  return { code, count: samples.length };
}

export async function saveGestureBatchByName(
  dir: FileSystemDirectoryHandle,
  id: string,
  name: string,
  samples: Array<{ ts: number; features: number[]; sampleHash: string; imageDataUrl: string }>
) {
  const baseDir = await ensureSubdir(dir, "gestures");
  const gDir = await ensureSubdir(baseDir, name);
  const imgDir = await ensureSubdir(gDir, "images");
  const dataDir = await ensureSubdir(gDir, "data");
  const list = samples.map((s, i) => ({
    ts: s.ts,
    sampleHash: s.sampleHash,
    features: s.features,
    image: `images/sample-${i + 1}.png`
  }));
  const dataset = { id, name, count: samples.length, ts: Date.now(), version: 1, samples: list };
  await writeFile(baseDir, `${name}.json`, JSON.stringify(dataset, null, 2));
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const res = await fetch(s.imageDataUrl);
    const blob = await res.blob();
    await writeBlob(imgDir, `sample-${i + 1}.png`, blob);
    const dataObj = { ts: s.ts, sampleHash: s.sampleHash, features: s.features };
    await writeFile(dataDir, `sample-${i + 1}.json`, JSON.stringify(dataObj, null, 2));
  }
  return { name, count: samples.length };
}

function md5ArrayBuffer(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  const words = CryptoJS.lib.WordArray.create(u8 as any);
  return MD5(words).toString();
}

async function readFileTextIfExists(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  try {
    const handle = await dir.getFileHandle(name, { create: true });
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return "";
  }
}

export async function saveGestureBatchPairs(
  dir: FileSystemDirectoryHandle,
  id: string,
  name: string,
  samples: Array<{ ts: number; features: number[]; sampleHash: string; imageDataUrl: string }>
) {
  const baseDir = await ensureSubdir(dir, "gestures");
  const gDir = await ensureSubdir(baseDir, name);
  const imgDir = await ensureSubdir(gDir, "images");
  const dataDir = await ensureSubdir(gDir, "data");
  const md5FileHandleDir = gDir;
  let md5Content = await readFileTextIfExists(md5FileHandleDir, "samples.md5");
  const lines: string[] = md5Content ? md5Content.split(/\r?\n/).filter(Boolean) : [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const base = `sample-${i + 1}-${s.sampleHash.slice(0, 8)}`;
    const imgName = `${base}.png`;
    const jsonName = `${base}.json`;
    const res = await fetch(s.imageDataUrl);
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    const imgMd5 = md5ArrayBuffer(buf);
    await writeBlob(imgDir, imgName, blob);
    const dataObj = { id, name, ts: s.ts, sampleHash: s.sampleHash, features: s.features };
    const dataText = JSON.stringify(dataObj, null, 2);
    const dataMd5 = MD5(dataText).toString();
    await writeFile(dataDir, jsonName, dataText);
    lines.push(`${imgMd5}  images/${imgName}`);
    lines.push(`${dataMd5}  data/${jsonName}`);
  }
  await writeFile(md5FileHandleDir, "samples.md5", lines.join("\n") + "\n");
  const meta = { id, name, count: samples.length, ts: Date.now(), version: 1 };
  await writeFile(gDir, "meta.json", JSON.stringify(meta, null, 2));
  return { name, count: samples.length };
}
