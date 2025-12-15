export type Vec2 = { x: number; y: number };

export enum GestureType {
  None = 0,
  OpenPalm = 1,
  Fist = 2,
  Pinch = 3,
  Point = 4,
  Victory = 5
}

export type GestureEvent = {
  t: number;
  code: GestureType;
  pos: Vec2 | null;
};

export interface IGestureDetector {
  detect(landmarks: Vec2[] | null): { gesture: GestureType; position: Vec2 | null };
}

export interface IGestureStore {
  start(): void;
  stop(): void;
  record(e: GestureEvent): void;
  isRecording(): boolean;
  export(): string;
  clear(): void;
}

export interface IParticleEffect {
  setEmitter(p: Vec2 | null): void;
  trigger(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  stop(): void;
}

export interface IEffectController {
  setEffectForGesture(g: GestureType, effect: IParticleEffect): void;
  onGesture(g: GestureType, pos: Vec2 | null): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  stop(): void;
}

export type ConfigField = {
  key: string;
  label: string;
  type: "number" | "range" | "color";
  min?: number;
  max?: number;
  step?: number;
  default?: number | string;
};

export interface IConfigurableEffect extends IParticleEffect {
  configure(values: Record<string, number | string | boolean>): void;
  getConfigSchema(): ConfigField[];
}
