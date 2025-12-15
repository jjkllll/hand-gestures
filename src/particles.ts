import { ConfigField, GestureType, IEffectController, IConfigurableEffect, IParticleEffect, Vec2 } from "./types";

type Particle = {
  p: Vec2;
  v: Vec2;
  life: number;
  size: number;
  color: string;
};

class BaseEffect implements IConfigurableEffect {
  protected particles: Particle[] = [];
  protected emitter: Vec2 | null = null;
  protected running = false;
  protected cfg = {
    hueMin: 0,
    hueMax: 360,
    spawn: 20,
    gravity: 300,
    speedMin: 60,
    speedMax: 180,
    sizeMin: 1,
    sizeMax: 3,
    swirl: 0
  };
  setEmitter(p: Vec2 | null): void {
    this.emitter = p;
  }
  trigger(): void {
    this.running = true;
  }
  stop(): void {
    this.running = false;
  }
  update(dt: number): void {}
  render(ctx: CanvasRenderingContext2D): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dtClamp(dtGlobal, 0.016);
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.p.x += pt.v.x * dtGlobal;
      pt.p.y += pt.v.y * dtGlobal;
      ctx.globalAlpha = Math.max(pt.life, 0);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.p.x, pt.p.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  configure(values: Record<string, number | string | boolean>): void {
    for (const k of Object.keys(values)) {
      const v = values[k];
      if (typeof v === "number") (this.cfg as any)[k] = v;
      if (typeof v === "string" && k === "color") (this.cfg as any)[k] = v;
    }
  }
  getConfigSchema(): ConfigField[] {
    return [
      { key: "spawn", label: "每帧生成数量", type: "range", min: 0, max: 200, step: 1, default: this.cfg.spawn },
      { key: "gravity", label: "重力", type: "range", min: -600, max: 600, step: 10, default: this.cfg.gravity },
      { key: "speedMin", label: "速度最小", type: "range", min: 0, max: 400, step: 5, default: this.cfg.speedMin },
      { key: "speedMax", label: "速度最大", type: "range", min: 0, max: 600, step: 5, default: this.cfg.speedMax },
      { key: "sizeMin", label: "尺寸最小", type: "range", min: 0.5, max: 10, step: 0.5, default: this.cfg.sizeMin },
      { key: "sizeMax", label: "尺寸最大", type: "range", min: 0.5, max: 12, step: 0.5, default: this.cfg.sizeMax },
      { key: "hueMin", label: "色相最小", type: "range", min: 0, max: 360, step: 1, default: this.cfg.hueMin },
      { key: "hueMax", label: "色相最大", type: "range", min: 0, max: 360, step: 1, default: this.cfg.hueMax },
      { key: "swirl", label: "旋涡强度", type: "range", min: 0, max: 3, step: 0.05, default: this.cfg.swirl }
    ];
  }
}

let dtGlobal = 0.016;
function dtClamp(v: number, max: number): number {
  return v > max ? max : v;
}
function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export class FountainEffect extends BaseEffect {
  update(dt: number): void {
    dtGlobal = dt;
    if (!this.running || !this.emitter) return;
    for (let i = 0; i < this.cfg.spawn; i++) {
      const v = { x: rand(-50, 50), y: rand(-this.cfg.speedMax, -this.cfg.speedMin) };
      const p: Particle = {
        p: { x: this.emitter.x, y: this.emitter.y },
        v,
        life: 1,
        size: rand(this.cfg.sizeMin, this.cfg.sizeMax),
        color: `hsl(${Math.floor(rand(this.cfg.hueMin, this.cfg.hueMax))},80%,60%)`
      };
      this.particles.push(p);
    }
    for (const pt of this.particles) {
      pt.v.y += this.cfg.gravity * dt;
    }
  }
}

export class ExplosionEffect extends BaseEffect {
  trigger(): void {
    super.trigger();
    if (!this.emitter) return;
    for (let i = 0; i < Math.max(10, this.cfg.spawn * 10); i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(this.cfg.speedMin, this.cfg.speedMax);
      const p: Particle = {
        p: { x: this.emitter.x, y: this.emitter.y },
        v: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
        life: rand(0.6, 1.2),
        size: rand(this.cfg.sizeMin, this.cfg.sizeMax),
        color: `hsl(${Math.floor(rand(this.cfg.hueMin, this.cfg.hueMax))},90%,60%)`
      };
      this.particles.push(p);
    }
    this.running = false;
  }
}

export class TrailEffect extends BaseEffect {
  update(dt: number): void {
    dtGlobal = dt;
    if (!this.running || !this.emitter) return;
    for (let i = 0; i < this.cfg.spawn; i++) {
      const p: Particle = {
        p: { x: this.emitter.x + rand(-3, 3), y: this.emitter.y + rand(-3, 3) },
        v: { x: rand(-this.cfg.speedMin, this.cfg.speedMin), y: rand(-this.cfg.speedMin, this.cfg.speedMin) },
        life: rand(0.4, 0.8),
        size: rand(this.cfg.sizeMin, this.cfg.sizeMax),
        color: `hsl(${Math.floor(rand(this.cfg.hueMin, this.cfg.hueMax))},90%,70%)`
      };
      this.particles.push(p);
    }
  }
}

export class SparksEffect extends BaseEffect {
  update(dt: number): void {
    dtGlobal = dt;
    if (!this.running || !this.emitter) return;
    for (let i = 0; i < this.cfg.spawn; i++) {
      const a = rand(0, Math.PI * 2) + this.cfg.swirl * 0.1;
      const sp = rand(this.cfg.speedMin, this.cfg.speedMax);
      const p: Particle = {
        p: { x: this.emitter.x, y: this.emitter.y },
        v: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
        life: rand(0.5, 0.9),
        size: rand(this.cfg.sizeMin, this.cfg.sizeMax),
        color: `hsl(${Math.floor(rand(this.cfg.hueMin, this.cfg.hueMax))},100%,60%)`
      };
      this.particles.push(p);
    }
  }
}

export class EffectController implements IEffectController {
  private map = new Map<GestureType, IParticleEffect>();
  private lastGesture: GestureType = GestureType.None;
  setEffectForGesture(g: GestureType, effect: IParticleEffect): void {
    this.map.set(g, effect);
  }
  onGesture(g: GestureType, pos: Vec2 | null): void {
    const effect = this.map.get(g);
    if (!effect) return;
    effect.setEmitter(pos);
    if (g !== this.lastGesture) {
      if (g === GestureType.Fist) effect.trigger();
    }
    if (g === GestureType.OpenPalm || g === GestureType.Pinch || g === GestureType.Point || g === GestureType.Victory) {
      effect.trigger();
    }
    this.lastGesture = g;
  }
  update(dt: number): void {
    for (const e of this.map.values()) e.update(dt);
  }
  render(ctx: CanvasRenderingContext2D): void {
    for (const e of this.map.values()) e.render(ctx);
  }
  stop(): void {
    for (const e of this.map.values()) e.stop();
  }
}

export function createDefaultEffects(): Record<GestureType, IParticleEffect> {
  return {
    [GestureType.None]: new TrailEffect(),
    [GestureType.OpenPalm]: new FountainEffect(),
    [GestureType.Fist]: new ExplosionEffect(),
    [GestureType.Pinch]: new TrailEffect(),
    [GestureType.Point]: new TrailEffect(),
    [GestureType.Victory]: new SparksEffect()
  } as unknown as Record<GestureType, IParticleEffect>;
}
