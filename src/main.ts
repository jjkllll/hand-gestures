import { initHandLandmarker, toVec2 } from "./handsPipeline";
import { GestureDetector } from "./gesture";
import { NebulaEffect } from "./nebula";
import { NebulaControls, BasicControls } from "./controls";
import { IConfigurableEffect } from "./types";
import { EFFECT_OPTIONS, createEffect, EffectId } from "./effectsRegistry";
import { openEditor } from "./ui";
import { chooseDirectory, saveGestureSample } from "./recorder";
import { loadGesturesFromDirectory, loadGesturesFromStatic, GestureRecognizer, applyGesture } from "./gesturelib";
import { GestureStore } from "./store";
import { GestureType, Vec2 } from "./types";

const video = document.getElementById("webcam") as HTMLVideoElement;
const canvas = document.getElementById("overlay") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const btnStart = document.getElementById("btn-start") as HTMLButtonElement;
const btnStop = document.getElementById("btn-stop") as HTMLButtonElement;
const btnRecord = document.getElementById("btn-record") as HTMLButtonElement;
const btnExport = document.getElementById("btn-export") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;
const effectSelect = document.getElementById("effect-select") as HTMLSelectElement;
const btnEditEffect = document.getElementById("btn-edit-effect") as HTMLButtonElement;
const chkMirror = document.getElementById("chk-mirror") as HTMLInputElement;
const btnChooseDir = document.getElementById("btn-choose-dir") as HTMLButtonElement;
const btnSaveGesture = document.getElementById("btn-save-gesture") as HTMLButtonElement;
const gestureLabelSel = document.getElementById("gesture-label") as HTMLSelectElement;
const btnOpenRecordPanel = document.getElementById("btn-open-record-panel") as HTMLButtonElement;
const btnLoadLibrary = document.getElementById("btn-load-library") as HTMLButtonElement;
const btnOpenAnalysis = document.getElementById("btn-open-analysis") as HTMLButtonElement;
const recognitionInfo = document.getElementById("recognition-info") as HTMLDivElement;

let stream: MediaStream | null = null;
let running = false;
let rafId = 0;
let lastTs = performance.now();
let landmarkerPromise: Promise<any> | null = null;
let landmarker: any = null;
let saveDir: FileSystemDirectoryHandle | null = null;
let latestLandmarks: Vec2[] | null = null;
let recognizer: GestureRecognizer | null = null;

const detector = new GestureDetector();
const store = new GestureStore();
let activeEffect: IConfigurableEffect = new NebulaEffect(1400);
let controls: NebulaControls | BasicControls = new NebulaControls(activeEffect as NebulaEffect);

function initEffectOptions() {
  effectSelect.innerHTML = "";
  for (const opt of EFFECT_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.id;
    o.textContent = opt.label;
    effectSelect.appendChild(o);
  }
  effectSelect.value = "nebula";
}
initEffectOptions();

function switchEffect(id: EffectId) {
  activeEffect = createEffect(id);
  controls = id === "nebula" ? new NebulaControls(activeEffect as NebulaEffect) : new BasicControls(activeEffect);
}
switchEffect("nebula");
autoLoadLibrary();

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
  activeEffect.stop();
  if (stream) {
    for (const t of stream.getTracks()) t.stop();
    stream = null;
  }
  setStatus("已停止");
}

function drawVideoToCanvas() {
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

function drawLandmarksOverlay(points: Vec2[]) {
  ctx.save();
  ctx.strokeStyle = "rgba(0,255,180,0.8)";
  ctx.lineWidth = 2;
  const chains = [
    [0, 5, 9, 13, 17, 0],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
    [2, 3, 4]
  ];
  for (const chain of chains) {
    ctx.beginPath();
    for (let i = 0; i < chain.length; i++) {
      const p = points[chain[i]];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,255,180,0.8)";
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function loop(ts: number) {
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawVideoToCanvas();
  let gesture = GestureType.None;
  let pos: Vec2 | null = null;
  let landmarks2D: Vec2[] | null = null;
  if (landmarker) {
    const res = landmarker.detectForVideo(video, ts);
    landmarks2D = res.landmarks && res.landmarks[0] ? toVec2(res.landmarks[0], canvas.width, canvas.height) : null;
    latestLandmarks = landmarks2D;
    const g = detector.detect(landmarks2D);
    gesture = g.gesture;
    pos = g.position;
    controls.apply(gesture, landmarks2D);
    if (recognizer) {
      const r = recognizer.recognizeFromLandmarks(landmarks2D);
      if (r) {
        recognitionInfo.textContent = `编号 ${r.id} 名称 ${r.name} 编码 ${r.code} 距离 ${r.distance.toFixed(3)}`;
        applyGesture(r.code, { id: r.id, code: r.code, name: r.name, t: Date.now() });
      } else {
        recognitionInfo.textContent = "未识别";
      }
    } else {
      recognitionInfo.textContent = "未加载库";
    }
  }
  if (landmarks2D) {
    if (chkMirror.checked) {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      drawLandmarksOverlay(landmarks2D);
      ctx.restore();
    } else {
      drawLandmarksOverlay(landmarks2D);
    }
  }
  activeEffect.update(dt);
  if (chkMirror.checked) {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    activeEffect.render(ctx);
    ctx.restore();
  } else {
    activeEffect.render(ctx);
  }
  if (store.isRecording()) {
    store.record({ t: Date.now(), code: gesture, pos });
  }
  if (running) rafId = requestAnimationFrame(loop);
}

btnStart.onclick = () => startCamera();
btnStop.onclick = () => stopCamera();
btnRecord.onclick = () => {
  if (store.isRecording()) {
    store.stop();
    btnRecord.textContent = "开始记录";
    setStatus("记录停止");
  } else {
    store.clear();
    store.start();
    btnRecord.textContent = "停止记录";
    setStatus("记录中");
  }
};
btnExport.onclick = () => {
  const data = store.export();
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gesture-log.json";
  a.click();
  URL.revokeObjectURL(url);
};

effectSelect.onchange = () => {
  const id = effectSelect.value as EffectId;
  switchEffect(id);
};
btnEditEffect.onclick = () => openEditor(activeEffect);
btnOpenRecordPanel.onclick = () => {
  location.href = "/record.html";
};
btnOpenAnalysis.onclick = () => {
  location.href = "/analysis.html";
};
btnChooseDir.onclick = async () => {
  saveDir = await chooseDirectory();
  setStatus(saveDir ? "已选择保存目录" : "未选择保存目录");
};
btnSaveGesture.onclick = async () => {
  if (!saveDir || !latestLandmarks) {
    setStatus("未选择目录或无手势数据");
    return;
  }
  const name = gestureLabelSel.value;
  const sample = await saveGestureSample(saveDir, latestLandmarks, name);
  setStatus(`已保存 ${name} 编码:${sample.code.slice(0, 8)}…`);
};
btnLoadLibrary.onclick = async () => {
  const dir = await chooseDirectory();
  if (!dir) {
    setStatus("未选择手势库目录");
    return;
  }
  const lib = await loadGesturesFromDirectory(dir);
  recognizer = new GestureRecognizer();
  recognizer.setLibrary(lib);
  recognizer.setThreshold(0.8);
  recognitionInfo.textContent = "已加载库，等待识别…";
  setStatus("手势库已加载");
};

async function autoLoadLibrary() {
  try {
    const lib = await loadGesturesFromStatic();
    if (lib.byCode.size > 0) {
      recognizer = new GestureRecognizer();
      recognizer.setLibrary(lib);
      recognizer.setThreshold(0.8);
      recognitionInfo.textContent = "已加载库，等待识别…";
      setStatus("手势库已加载");
    }
  } catch {}
}
