import { IParticleEffect, Vec2 } from "./types";

type Star = {
  r: number;
  a: number;
  spin: number;
  brightness: number;
  size: number;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class NebulaEffect implements IParticleEffect {
  private stars: Star[] = [];
  private _center: Vec2 = { x: 640, y: 360 };
  private _targetCenter: Vec2 = { x: 640, y: 360 };
  private _scale = 1;
  private _targetScale = 1;
  private _rotation = 0;
  private _targetRotation = 0;
  private running = false;
  private swirl = 0;
  private baseCount: number;
  constructor(count = 1200) {
    this.baseCount = count;
    this.reseed();
  }
  private reseed() {
    this.stars = [];
    for (let i = 0; i < this.baseCount; i++) {
      const r = Math.pow(Math.random(), 0.7) * 220 + 20;
      const a = Math.random() * Math.PI * 2;
      const spin = (Math.random() - 0.5) * 0.6;
      const brightness = 0.6 + Math.random() * 0.4;
      const size = Math.random() * 1.6 + 0.4;
      this.stars.push({ r, a, spin, brightness, size });
    }
  }
  setEmitter(p: Vec2 | null): void {
    if (!p) return;
    this._targetCenter = { x: p.x, y: p.y };
    this.running = true;
  }
  trigger(): void {
    this.running = true;
  }
  stop(): void {
    this.running = false;
  }
  update(dt: number): void {
    if (!this.running) return;
    this._center.x = lerp(this._center.x, this._targetCenter.x, 0.25);
    this._center.y = lerp(this._center.y, this._targetCenter.y, 0.25);
    this._scale = lerp(this._scale, this._targetScale, 0.2);
    this._rotation = lerp(this._rotation, this._targetRotation, 0.2);
    this.swirl += dt * 0.5;
    for (const s of this.stars) {
      s.a += s.spin * dt;
    }
  }
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.running) return;
    ctx.save();
    ctx.translate(this._center.x, this._center.y);
    ctx.rotate(this._rotation);
    ctx.scale(this._scale, this._scale);
    for (const s of this.stars) {
      const x = Math.cos(s.a + this.swirl * 0.2) * s.r;
      const y = Math.sin(s.a + this.swirl * 0.2) * s.r;
      ctx.globalAlpha = s.brightness;
      ctx.fillStyle = "#8fd1ff";
      ctx.beginPath();
      ctx.arc(x, y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  // controls
  setCenter(p: Vec2) {
    this._targetCenter = p;
  }
  setScaleFromFactor(f: number) {
    this._targetScale = Math.max(0.3, Math.min(3.0, f));
  }
  setRotationFromAngle(rad: number) {
    this._targetRotation = rad;
  }
  burst() {
    this.reseed();
  }
}
