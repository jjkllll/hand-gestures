import { GestureType, IGestureDetector, Vec2 } from "./types";

const W = 0;
const THUMB = { mcp: 2, ip: 3, tip: 4 };
const INDEX = { mcp: 5, pip: 6, dip: 7, tip: 8 };
const MIDDLE = { mcp: 9, pip: 10, dip: 11, tip: 12 };
const RING = { mcp: 13, pip: 14, dip: 15, tip: 16 };
const PINKY = { mcp: 17, pip: 18, dip: 19, tip: 20 };

function d(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function fingerExtended(points: Vec2[], mcp: number, pip: number, tip: number, scale: number): boolean {
  const dmcpTip = d(points[mcp], points[tip]);
  const dmcpPip = d(points[mcp], points[pip]);
  return dmcpTip > dmcpPip * 1.2 && dmcpTip > scale * 0.7;
}

function thumbPinching(points: Vec2[], scale: number): boolean {
  const dist = d(points[THUMB.tip], points[INDEX.tip]);
  return dist < scale * 0.4;
}

function scaleRef(points: Vec2[]): number {
  return d(points[W], points[MIDDLE.mcp]);
}

export class GestureDetector implements IGestureDetector {
  private last: GestureType = GestureType.None;
  detect(landmarks: Vec2[] | null): { gesture: GestureType; position: Vec2 | null } {
    if (!landmarks || landmarks.length < 21) return { gesture: GestureType.None, position: null };
    const s = scaleRef(landmarks);
    const idx = fingerExtended(landmarks, INDEX.mcp, INDEX.pip, INDEX.tip, s);
    const mid = fingerExtended(landmarks, MIDDLE.mcp, MIDDLE.pip, MIDDLE.tip, s);
    const ring = fingerExtended(landmarks, RING.mcp, RING.pip, RING.tip, s);
    const pink = fingerExtended(landmarks, PINKY.mcp, PINKY.pip, PINKY.tip, s);
    const pinch = thumbPinching(landmarks, s);
    const allExtended = idx && mid && ring && pink;
    const noneExtended = !idx && !mid && !ring && !pink;
    let gesture = GestureType.None;
    if (pinch) {
      gesture = GestureType.Pinch;
    } else if (allExtended) {
      gesture = GestureType.OpenPalm;
    } else if (noneExtended) {
      gesture = GestureType.Fist;
    } else if (idx && !mid && !ring && !pink) {
      gesture = GestureType.Point;
    } else if (idx && mid && !ring && !pink) {
      gesture = GestureType.Victory;
    } else {
      gesture = this.last;
    }
    const pos = pinch ? landmarks[INDEX.tip] : landmarks[MIDDLE.mcp];
    this.last = gesture;
    return { gesture, position: pos };
  }
}
