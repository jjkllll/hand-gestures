import { GestureEvent, IGestureStore } from "./types";

export class GestureStore implements IGestureStore {
  private recording = false;
  private events: GestureEvent[] = [];
  start(): void {
    this.recording = true;
  }
  stop(): void {
    this.recording = false;
  }
  isRecording(): boolean {
    return this.recording;
  }
  record(e: GestureEvent): void {
    if (!this.recording) return;
    this.events.push(e);
  }
  export(): string {
    return JSON.stringify(
      {
        meta: { version: 1, ts: Date.now() },
        events: this.events
      },
      null,
      2
    );
  }
  clear(): void {
    this.events = [];
  }
}
