import { GestureType, Vec2 } from "./types";
import { NebulaEffect } from "./nebula";
import { IConfigurableEffect } from "./types";

function angle(a: Vec2, b: Vec2): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function avg(points: Vec2[], ids: number[]): Vec2 {
  let x = 0,
    y = 0;
  for (const i of ids) {
    x += points[i].x;
    y += points[i].y;
  }
  const n = ids.length;
  return { x: x / n, y: y / n };
}

export class NebulaControls {
  private effect: NebulaEffect;
  private lastGesture: GestureType = GestureType.None;
  private pinchBaseDist = 0;
  private pinchBaseScale = 1;
  private rotateBaseAngle = 0;
  private rotateBaseRotation = 0;
  constructor(effect: NebulaEffect) {
    this.effect = effect;
  }
  apply(gesture: GestureType, landmarks: Vec2[] | null) {
    if (!landmarks || landmarks.length < 21) {
      return;
    }
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const palmCenter = avg(landmarks, [0, 5, 9, 13, 17]);
    if (gesture !== this.lastGesture) {
      if (gesture === GestureType.Pinch) {
        this.pinchBaseDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        this.pinchBaseScale = 1;
      } else if (gesture === GestureType.Victory) {
        this.rotateBaseAngle = angle(indexTip, middleTip);
        this.rotateBaseRotation = 0;
      }
      this.lastGesture = gesture;
    }
    if (gesture === GestureType.OpenPalm) {
      this.effect.setCenter(palmCenter);
      this.effect.trigger();
    } else if (gesture === GestureType.Pinch) {
      const dist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
      const factor = this.pinchBaseScale * (dist / Math.max(10, this.pinchBaseDist));
      this.effect.setScaleFromFactor(factor);
      this.effect.setCenter(indexTip);
      this.effect.trigger();
    } else if (gesture === GestureType.Victory) {
      const ang = angle(indexTip, middleTip);
      const delta = ang - this.rotateBaseAngle;
      this.effect.setRotationFromAngle(this.rotateBaseRotation + delta);
      this.effect.setCenter(avg(landmarks, [8, 12]));
      this.effect.trigger();
    } else if (gesture === GestureType.Point) {
      const s = 1 + (360 - indexTip.y) / 720;
      this.effect.setScaleFromFactor(s);
      this.effect.setCenter(indexTip);
      this.effect.trigger();
    } else if (gesture === GestureType.Fist) {
      this.effect.burst();
      this.effect.trigger();
    }
  }
}

export class BasicControls {
  private effect: IConfigurableEffect;
  private lastGesture: GestureType = GestureType.None;
  private pinchBaseDist = 0;
  constructor(effect: IConfigurableEffect) {
    this.effect = effect;
  }
  apply(gesture: GestureType, landmarks: Vec2[] | null) {
    if (!landmarks || landmarks.length < 21) return;
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const palmCenter = avg(landmarks, [0, 5, 9, 13, 17]);
    if (gesture !== this.lastGesture) {
      if (gesture === GestureType.Pinch) {
        this.pinchBaseDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
      }
      this.lastGesture = gesture;
    }
    if (gesture === GestureType.OpenPalm) {
      this.effect.setEmitter(palmCenter);
      this.effect.configure({ spawn: 30 });
      this.effect.trigger();
    } else if (gesture === GestureType.Pinch) {
      const dist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
      const scale = dist / Math.max(10, this.pinchBaseDist);
      const spawn = Math.floor(15 * scale);
      const sizeMax = 3 * scale;
      this.effect.setEmitter(indexTip);
      this.effect.configure({ spawn, sizeMax });
      this.effect.trigger();
    } else if (gesture === GestureType.Victory) {
      this.effect.setEmitter(indexTip);
      this.effect.configure({ swirl: 1.5 });
      this.effect.trigger();
    } else if (gesture === GestureType.Point) {
      this.effect.setEmitter(indexTip);
      const hueShift = Math.max(0, Math.min(360, 200 + (indexTip.y / 720) * 160));
      this.effect.configure({ hueMin: hueShift - 40, hueMax: hueShift + 40 });
      this.effect.trigger();
    } else if (gesture === GestureType.Fist) {
      this.effect.setEmitter(palmCenter);
      this.effect.configure({ spawn: 120 });
      this.effect.trigger();
    }
  }
}
