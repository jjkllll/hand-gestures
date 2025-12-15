import { loadGesturesFromDirectory, buildCodebook } from "./gesturelib";

const btnLoad = document.getElementById("btn-load") as HTMLButtonElement;
const codeSelect = document.getElementById("code-select") as HTMLSelectElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;
const kFactorInput = document.getElementById("k-factor") as HTMLInputElement;
const tipWeightInput = document.getElementById("tip-weight") as HTMLInputElement;
const baseWeightInput = document.getElementById("base-weight") as HTMLInputElement;
const btnApply = document.getElementById("btn-apply") as HTMLButtonElement;
const meanCanvas = document.getElementById("mean-canvas") as HTMLCanvasElement;
const distCanvas = document.getElementById("dist-canvas") as HTMLCanvasElement;
const mctx = meanCanvas.getContext("2d") as CanvasRenderingContext2D;
const dctx = distCanvas.getContext("2d") as CanvasRenderingContext2D;

let lib: any = null;
let codebook: any = null;

function setStatus(s: string) {
  statusEl.textContent = s;
}

function weightsFromInputs(dim: number) {
  const tipW = Number(tipWeightInput.value);
  const baseW = Number(baseWeightInput.value);
  const w = new Array(dim).fill(baseW);
  const tips = [4, 8, 12, 16, 20];
  for (const i of tips) {
    const xi = i * 2;
    const yi = xi + 1;
    if (xi < dim) w[xi] = tipW;
    if (yi < dim) w[yi] = tipW;
  }
  return w;
}

function drawMean(mean: number[]) {
  mctx.clearRect(0, 0, meanCanvas.width, meanCanvas.height);
  const cx = meanCanvas.width / 2;
  const cy = meanCanvas.height / 2;
  const s = 120;
  const pts = [];
  for (let i = 0; i < mean.length; i += 2) {
    const x = cx + mean[i] * s;
    const y = cy + mean[i + 1] * s;
    pts.push({ x, y });
  }
  const chains = [
    [0, 5, 9, 13, 17, 0],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
    [2, 3, 4]
  ];
  mctx.strokeStyle = "rgba(0,255,180,0.9)";
  mctx.lineWidth = 2;
  for (const chain of chains) {
    mctx.beginPath();
    for (let i = 0; i < chain.length; i++) {
      const p = pts[chain[i]];
      if (i === 0) mctx.moveTo(p.x, p.y);
      else mctx.lineTo(p.x, p.y);
    }
    mctx.stroke();
  }
  mctx.fillStyle = "rgba(0,255,180,0.9)";
  for (const p of pts) {
    mctx.beginPath();
    mctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    mctx.fill();
  }
}

function drawHistogram(vals: number[], threshold: number) {
  dctx.clearRect(0, 0, distCanvas.width, distCanvas.height);
  if (vals.length === 0) return;
  const w = distCanvas.width;
  const h = distCanvas.height;
  const bins = 24;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const bw = w / bins;
  const counts = new Array(bins).fill(0);
  for (const v of vals) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(((v - min) / Math.max(1e-6, max - min)) * bins)));
    counts[idx]++;
  }
  const maxCount = Math.max(...counts);
  for (let i = 0; i < bins; i++) {
    const barH = (counts[i] / Math.max(1, maxCount)) * (h - 30);
    dctx.fillStyle = "#39c5bb";
    dctx.fillRect(i * bw + 2, h - barH - 20, bw - 4, barH);
  }
  const tx = ((threshold - min) / Math.max(1e-6, max - min)) * w;
  dctx.strokeStyle = "#ff6a00";
  dctx.lineWidth = 2;
  dctx.beginPath();
  dctx.moveTo(tx, 0);
  dctx.lineTo(tx, h);
  dctx.stroke();
}

btnLoad.onclick = async () => {
  const dir = await (window as any).showDirectoryPicker();
  lib = await loadGesturesFromDirectory(dir);
  const anyEntry = Array.from(lib.byCode.values())[0];
  const dim = anyEntry && anyEntry.samples[0] ? anyEntry.samples[0].features.length : 42;
  codebook = buildCodebook(lib, weightsFromInputs(dim), Number(kFactorInput.value));
  codeSelect.innerHTML = "";
  for (const g of lib.byCode.values()) {
    const o = document.createElement("option");
    o.value = g.code;
    o.textContent = `${g.name} (${g.code.slice(0,8)}…)`;
    codeSelect.appendChild(o);
  }
  setStatus("已加载手势库");
  if (codeSelect.value) {
    const e = codebook.entries.find((x: any) => x.code === codeSelect.value);
    if (e) {
      drawMean(e.mean);
      drawHistogram(e.dists, e.threshold);
    }
  }
};

codeSelect.onchange = () => {
  if (!codebook) return;
  const e = codebook.entries.find((x: any) => x.code === codeSelect.value);
  if (e) {
    drawMean(e.mean);
    drawHistogram(e.dists, e.threshold);
  }
};

btnApply.onclick = () => {
  if (!lib) return;
  const anyEntry = Array.from(lib.byCode.values())[0];
  const dim = anyEntry && anyEntry.samples[0] ? anyEntry.samples[0].features.length : 42;
  codebook = buildCodebook(lib, weightsFromInputs(dim), Number(kFactorInput.value));
  const e = codebook.entries.find((x: any) => x.code === codeSelect.value);
  if (e) {
    drawMean(e.mean);
    drawHistogram(e.dists, e.threshold);
  }
  setStatus("已应用配置");
};
