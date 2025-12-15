import { IConfigurableEffect } from "./types";
import { NebulaEffect } from "./nebula";
import { FountainEffect, ExplosionEffect, TrailEffect, SparksEffect } from "./particles";
export type EffectId = "nebula" | "fountain" | "explosion" | "trail" | "sparks";

export function createEffect(id: EffectId): IConfigurableEffect {
  switch (id) {
    case "nebula":
      return new NebulaEffect(1400);
    case "fountain":
      return new FountainEffect();
    case "explosion":
      return new ExplosionEffect();
    case "trail":
      return new TrailEffect();
    case "sparks":
      return new SparksEffect();
    default:
      return new NebulaEffect(1400);
  }
}

export const EFFECT_OPTIONS: Array<{ id: EffectId; label: string }> = [
  { id: "nebula", label: "星云" },
  { id: "fountain", label: "喷泉" },
  { id: "explosion", label: "爆炸" },
  { id: "trail", label: "拖尾" },
  { id: "sparks", label: "火花" }
];
