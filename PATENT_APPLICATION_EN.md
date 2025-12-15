# AR Interaction Control System Based on Gesture Encoding and Normalized Features (Patent Draft)

## Abstract
This invention discloses an AR interaction control system and a supporting sampling method and encoding standard. By detecting hand landmarks, normalizing coordinates, and ensuring mirrored rendering consistency, the system maps gestures to configurable interaction effects and establishes a stable MD5-based gesture identity and batch sample storage structure (image/data paired by filename) for unified, cross-project, cross-device invocation. The solution provides: a sampling panel, paired storage in `images/` and `data/` folders, configurable effects and gesture control, and a continuous MD5 record file for evidential integrity. Applicable to AR/VR interaction, game engines, HCI, and gesture training.

## Technical Field
Computer vision, human-computer interaction, augmented reality (AR), particularly a gesture sampling, encoding, and unified invocation system based on hand landmarks.

## Background
Conventional gesture interaction faces issues such as inconsistent encoding, distributed sampling, mirroring and coordinate mismatches, and hard-to-reuse effect control. This invention integrates normalization, stable coding, sampling, storage, control, and editing to deliver a unified, extensible engineering solution.

## Summary
1. Provide a sampling panel to collect both images and normalized landmark features as samples.  
2. Use “gesture id + gesture name” to form a stable unique MD5 identity for gestures.  
3. Store paired samples in the same gesture directory under `images/` and `data/` with identical filenames.  
4. Maintain `samples.md5` in the same directory, recording MD5 checksums and relative paths for both image and data after each save.  
5. Apply consistent mirroring and rendering transforms to video, overlays, and effects to align visual and interaction directions.  
6. Map gestures to configurable effects (e.g., nebula translation/scale/rotation/burst), supporting parameter editing and gesture linkage.  
7. Use a unified feature format (palm-centered, hand-scale normalized) for cross-project invocation.  
8. Support batch dataset generation by gesture name with continuous MD5 appending for a complete chain of evidence.

## Claims (Examples)
1. An AR gesture interaction control system comprising camera input, hand landmark detection, coordinate normalization, mirrored rendering consistency, configurable effect control, and sampling/encoding storage, wherein:  
   - Normalization uses the palm center as origin and the distance from wrist to middle MCP as scale;  
   - Mirrored consistency applies the same transform to video, overlays, and effects;  
   - Sampling and encoding use `MD5(id:name)` as gesture identity and store paired image/data in separate subfolders under the same directory.
2. The system of claim 1, wherein the storage module automatically appends two records to `samples.md5` (image and data) after each sample save.  
3. The system of claim 1 or 2, wherein sample data contains normalized features of 21 hand landmarks in `[x1', y1', x2', y2', …]`.  
4. The system of any of claims 1–3, wherein gesture identity is `MD5(id:name)` for cross-project and batch mapping.  
5. The system of any of claims 1–4, wherein the configurable effect control supports translation, scale, rotation, burst, and parameter editing (spawn rate, gravity, speed, size, hue, swirl).  
6. The system of any of claims 1–5, wherein mirrored rendering applies `translate(width,0) + scale(-1,1)` at draw time.  
7. A gesture sampling method comprising: choosing a save directory, entering gesture id and name, clicking “sample” to generate paired image/data, and clicking “finish” to write a batch with MD5 records.  
8. The method of claim 7, wherein sample images are cropped based on landmark bounding box and scaled to a fixed size.  
9. The method of claim 7 or 8, wherein the sample list supports view/resample/delete and writes paired files with identical base names to `images/` and `data/`.  
10. The system or method of any of claims 1–9, wherein the unified data structure and MD5 records prove integrity and immutability, aiding patent evidence and engineering delivery.  
11. A gesture-to-AR mapping method, wherein gesture identity (`MD5(id:name)`) maps to AR engine events (translation, scale, rotation, burst, color, parameter edits) and loads configurations via a unified interface.  
12. The method of claim 11, wherein mapping configurations can be edited in real time and persisted with a parameter schema (ranges/defaults).

## Brief Description of Drawings
Fig.1 System architecture; Fig.2 Sampling panel UI; Fig.3 Batch directory structure and `samples.md5`; Fig.4 Gesture-to-effect mapping; Fig.5 Normalization; Fig.6 Mirrored rendering; Fig.7 Paired filenames and MD5 flow.

## Detailed Description (Code References)
- Landmark indices and finger groups: `src/gesture.ts:3-8`  
- Pixel conversion: `src/handsPipeline.ts:17-20`  
- Mirroring consistency: `src/main.ts:42-51, 83-95, 129-137`; `src/record.ts:49-59, 218-226`  
- Normalized features: `src/recorder.ts:21-41`  
- Batch paired storage and MD5: `src/recorder.ts:191-241`  
- Sampling UI and logic: `record.html`, `src/record.ts:244-280`  
- Effect control and editing: `src/particles.ts`, `src/effectsRegistry.ts`, `src/ui.ts`

## Encoding and Dataset Directory (External)
- Example output root: `D:\trae\handcode\gestures\`  
- For each gesture (e.g., `Victory/`):  
  - `images/sample-<n>-<hash8>.png`  
  - `data/sample-<n>-<hash8>.json`  
  - `samples.md5` (MD5 records for image/data)  
  - `meta.json` (batch info)  
- See `HAND_LANDMARKS.md` for coordinate and normalization references.

## Advantages
Unified normalized coordinates and stable coding; paired storage with MD5 evidence; mirrored rendering alignment; configurable effects; modular extensibility.

## Industrial Applicability
Applicable to AR/VR, HCI, and training datasets; gesture identity enables consistent integration with engines (Unity/Unreal/WebXR) via mapping to interaction events.

## Filing Notes
This draft should be further formatted and refined by a patent attorney according to jurisdictional requirements.
