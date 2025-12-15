import { FilesetResolver, HandLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { Vec2 } from "./types";

export async function initHandLandmarker(): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
  const landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
    },
    runningMode: "VIDEO",
    numHands: 1
  });
  return landmarker;
}

export function toVec2(landmarks: NormalizedLandmark[] | undefined, w: number, h: number): Vec2[] | null {
  if (!landmarks || landmarks.length === 0) return null;
  return landmarks.map(l => ({ x: l.x * w, y: l.y * h }));
}
