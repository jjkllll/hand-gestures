import { initHandLandmarker, toVec2 } from "./handsPipeline";
import { extractFeatures } from "./recorder";
import { chooseDirectory } from "./recorder";
import { saveGestureBatchPairs } from "./recorder";
import MD5 from "crypto-js/md5";
import { Vec2 } from "./types";
import { loadGesturesFromDirectory, GestureLibrary } from "./gesturelib";

const video = document.getElementById("webcam") as HTMLVideoElement;
const canvas = document.getElementById("overlay") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const btnStart = document.getElementById("btn-start") as HTMLButtonElement;
const btnStop = document.getElementById("btn-stop") as HTMLButtonElement;
const btnChooseDir = document.getElementById("btn-choose-dir") as HTMLButtonElement;
const btnLoadLib = document.getElementById("btn-load-lib") as HTMLButtonElement;
const gestureSelect = document.getElementById("gesture-select") as HTMLSelectElement;
const chkMirror = document.getElementById("chk-mirror") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;
const gestureIdInput = document.getElementById("gesture-id") as HTMLInputElement;
const gestureNameInput = document.getElementById("gesture-name") as HTMLInputElement;
const btnSample = document.getElementById("btn-sample") as HTMLButtonElement;
const btnFinish = document.getElementById("btn-finish") as HTMLButtonElement;
const btnStartSampling = document.getElementById("btn-start-sampling") as HTMLButtonElement;
const featuresTable = document.getElementById("features-table") as HTMLDivElement;
const samplesList = document.getElementById("samples-list") as HTMLDivElement;

let stream: MediaStream | null = null;
let running = false;
let rafId = 0;
let lastTs = performance.now();
let landmarkerPromise: Promise<any> | null = null;
let landmarker: any = null;
let latestLandmarks: Vec2[] | null = null;
let saveDir: FileSystemDirectoryHandle | null = null;
let libraryDir: FileSystemDirectoryHandle | null = null;
let library: GestureLibrary | null = null;

type Sample = { ts: number; features: number[]; sampleHash: string; imageDataUrl: string };
let samples: Sample[] = [];
let previewIndex: number | null = null;

function setStatus(s: string) {
  statusEl.textContent = s;
}

function resizeCanvas() {
  const rect = video.getBoundingClientRect();
  const w = Math.floor(rect.width);
  const h = Math.floor(rect.height);
  canvas.width = w;
  canvas.height = h;
}

function drawVideo() {
  if (chkMirror.checked) {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  } else {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
}

function drawOverlay(points: Vec2[]) {
  const chains = [
    [0, 5, 9, 13, 17, 0],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
    [2, 3, 4]
  ];
  ctx.save();
  ctx.strokeStyle = "rgba(0,255,180,0.9)";
  ctx.lineWidth = 3;
  for (const chain of chains) {
    ctx.beginPath();
    for (let i = 0; i < chain.length; i++) {
      const p = points[chain[i]];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,255,180,0.9)";
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderFeaturesTable(feats: number[]) {
  const rows: string[] = [];
  for (let i = 0; i < feats.length; i += 2) {
    const idx = i / 2;
    const x = feats[i].toFixed(3);
    const y = feats[i + 1].toFixed(3);
    rows.push(`<div style="display:grid;grid-template-columns:40px 1fr 1fr;gap:8px;padding:4px 0;border-bottom:1px solid #222;">
      <div>#${idx}</div><div>x: ${x}</div><div>y: ${y}</div></div>`);
  }
  featuresTable.innerHTML = rows.join("");
}

function renderSamples() {
  const items: string[] = samples.map(
    (s, i) =>
      `<div style="display:grid;grid-template-columns:80px 1fr 160px 160px 160px;gap:8px;align-items:center;padding:6px;border-bottom:1px solid #222;">
        <img src="${s.imageDataUrl}" style="width:72px;height:72px;object-fit:cover;border-radius:6px;border:1px solid #333;" />
        <div>样品 ${i + 1}</div>
        <div>时间 ${new Date(s.ts).toLocaleTimeString()}</div>
        <div>hash ${s.sampleHash.slice(0, 8)}…</div>
        <div style="display:flex;gap:6px;">
          <button data-action="view" data-index="${i}">查看</button>
          <button data-action="resample" data-index="${i}">重采样</button>
          <button data-action="delete" data-index="${i}">删除</button>
        </div>
      </div>`
  );
  samplesList.innerHTML = items.join("");
  samplesList.querySelectorAll("button").forEach(btn => {
    const action = (btn as HTMLButtonElement).dataset.action!;
    const idx = Number((btn as HTMLButtonElement).dataset.index!);
    (btn as HTMLButtonElement).onclick = () => {
      if (action === "delete") {
        samples.splice(idx, 1);
        renderSamples();
      } else if (action === "resample") {
        if (!latestLandmarks) return;
        const feats = extractFeatures(latestLandmarks);
        const imageDataUrl = captureSampleImage(latestLandmarks);
        samples[idx] = {
          ts: Date.now(),
          features: feats,
          sampleHash: MD5(JSON.stringify(feats)).toString(),
          imageDataUrl
        };
        renderSamples();
      } else if (action === "view") {
        previewIndex = idx;
        setStatus(`查看样品 ${idx + 1}`);
      }
    };
  });
}

function captureSampleImage(points: Vec2[]): string {
  const mirrored = chkMirror.checked;
  const w = canvas.width;
  const h = canvas.height;
  const pts = points.map(p => (mirrored ? { x: w - p.x, y: p.y } : p));
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = 30;
  const sx = Math.max(0, Math.floor(minX - pad));
  const sy = Math.max(0, Math.floor(minY - pad));
  const sw = Math.min(w - sx, Math.floor(maxX - minX + pad * 2));
  const sh = Math.min(h - sy, Math.floor(maxY - minY + pad * 2));
  const off = document.createElement("canvas");
  off.width = 256;
  off.height = 256;
  const octx = off.getContext("2d") as CanvasRenderingContext2D;
  const frame = document.createElement("canvas");
  frame.width = w;
  frame.height = h;
  const fctx = frame.getContext("2d") as CanvasRenderingContext2D;
  if (mirrored) {
    fctx.translate(w, 0);
    fctx.scale(-1, 1);
  }
  fctx.drawImage(video, 0, 0, w, h);
  octx.drawImage(frame, sx, sy, sw, sh, 0, 0, off.width, off.height);
  return off.toDataURL("image/png");
}

async function fileHandleToObjectURL(dir: FileSystemDirectoryHandle, relative: string): Promise<string | null> {
  const parts = relative.split("/").filter(Boolean);
  let current = dir;
  for (let i = 0; i < parts.length - 1; i++) {
    try {
      current = await current.getDirectoryHandle(parts[i], { create: false });
    } catch {
      return null;
    }
  }
  const fileName = parts[parts.length - 1];
  try {
    const fh = await current.getFileHandle(fileName, { create: false });
    const file = await fh.getFile();
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

async function deriveImageURLForSample(gName: string, samplePath: string): Promise<string | null> {
  if (!libraryDir) return null;
  const gDir = await libraryDir.getDirectoryHandle(gName, { create: false }).catch(() => null);
  if (!gDir) return null;
  const base = samplePath.replace(/^data\//, "");
  const imgName = `images/${base.replace(/\.json$/i, ".png")}`;
  return fileHandleToObjectURL(gDir, imgName);
}

async function loadLibraryDir() {
  if (!libraryDir) return;
  library = await loadGesturesFromDirectory(libraryDir);
  gestureSelect.innerHTML = `<option value="">选择手势</option>`;
  for (const g of library.byCode.values()) {
    const o = document.createElement("option");
    o.value = g.code;
    o.textContent = `${g.name} (${g.code.slice(0, 8)}…)`;
    gestureSelect.appendChild(o);
  }
  setStatus("已加载手势库");
}

async function showGesture(code: string) {
  if (!library || !libraryDir) return;
  const g = library.byCode.get(code);
  if (!g) return;
  samples = [];
  for (const s of g.samples) {
    const imgUrl = await deriveImageURLForSample(g.name, s.path);
    const ts = typeof (s as any).ts === "number" ? (s as any).ts : Date.now();
    samples.push({
      ts,
      features: s.features,
      sampleHash: s.sampleHash,
      imageDataUrl: imgUrl || ""
    });
  }
  renderSamples();
  setStatus(`已加载 ${g.name} 的 ${samples.length} 个样品`);
}

async function startCamera() {
  if (running) return;
  stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
  video.srcObject = stream;
  await video.play();
  resizeCanvas();
  if (!landmarkerPromise) landmarkerPromise = initHandLandmarker();
  landmarker = await landmarkerPromise;
  running = true;
  setStatus("运行中");
  lastTs = performance.now();
  rafId = requestAnimationFrame(loop);
}

function stopCamera() {
  running = false;
  cancelAnimationFrame(rafId);
  if (stream) {
    for (const t of stream.getTracks()) t.stop();
    stream = null;
  }
  setStatus("已停止");
}

function loop(ts: number) {
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawVideo();
  let landmarks2D: Vec2[] | null = null;
  if (landmarker) {
    const res = landmarker.detectForVideo(video, ts);
    landmarks2D = res.landmarks && res.landmarks[0] ? toVec2(res.landmarks[0], canvas.width, canvas.height) : null;
    latestLandmarks = landmarks2D;
  }
  if (previewIndex === null) {
    if (landmarks2D) {
      if (chkMirror.checked) {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        drawOverlay(landmarks2D);
        ctx.restore();
      } else {
        drawOverlay(landmarks2D);
      }
      const feats = extractFeatures(landmarks2D);
      renderFeaturesTable(feats);
    }
  } else {
    const img = new Image();
    img.src = samples[previewIndex].imageDataUrl;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const feats = samples[previewIndex].features;
      renderFeaturesTable(feats);
    };
  }
  if (running) rafId = requestAnimationFrame(loop);
}

btnStart.onclick = () => startCamera();
btnStop.onclick = () => stopCamera();
btnChooseDir.onclick = async () => {
  saveDir = await chooseDirectory();
  setStatus(saveDir ? "已选择保存目录" : "未选择保存目录");
};
btnLoadLib.onclick = async () => {
  libraryDir = await chooseDirectory();
  if (!libraryDir) {
    setStatus("未选择手势库目录");
    return;
  }
  await loadLibraryDir();
};
gestureSelect.onchange = async () => {
  const code = gestureSelect.value;
  if (!code) return;
  await showGesture(code);
};
btnSample.onclick = () => {
  if (!latestLandmarks) {
    setStatus("未检测到手势");
    return;
  }
  const feats = extractFeatures(latestLandmarks);
  const imageDataUrl = captureSampleImage(latestLandmarks);
  samples.push({ ts: Date.now(), features: feats, sampleHash: MD5(JSON.stringify(feats)).toString(), imageDataUrl });
  renderSamples();
  setStatus(`已采样，共 ${samples.length} 个`);
};
btnFinish.onclick = async () => {
  if (!saveDir) {
    setStatus("未选择保存目录");
    return;
  }
  const id = gestureIdInput.value.trim();
  const name = gestureNameInput.value.trim();
  if (!id || !name) {
    setStatus("请输入编号与名称");
    return;
  }
  await saveGestureBatchPairs(saveDir, id, name, samples);
  samples = [];
  renderSamples();
  setStatus("记录完成");
};
btnStartSampling.onclick = () => {
  previewIndex = null;
  setStatus("采样模式");
};
