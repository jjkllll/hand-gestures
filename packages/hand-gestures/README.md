# hand-gestures

轻量手势库加载与识别（ESM/UMD）

## 安装
```bash
npm i hand-gestures
```

## 使用（ESM）
```ts
import { loadGesturesFromPath, GestureRecognizer } from "hand-gestures";
const lib = await loadGesturesFromPath("D:\\trae\\hand\\assets\\handcode\\gestures");
const rec = new GestureRecognizer();
rec.setLibrary(lib);
rec.setThreshold(0.8);
const res = rec.recognizeFromLandmarks(landmarks);
```

## 使用（UMD）
```html
<script src="dist/hand-gestures.umd.js"></script>
<script>
  (async () => {
    const lib = await HandGestures.loadGesturesFromDirectory(await window.showDirectoryPicker());
    const rec = new HandGestures.GestureRecognizer();
    rec.setLibrary(lib);
    const res = rec.recognizeFromLandmarks(landmarks);
    console.log(res);
  })();
</script>
```

## 数据结构
- 目录：`gestures/<name>/meta.json` 与 `gestures/<name>/data/*.json`
- `meta.json`：`{ id, name }`
- `data/*.json`：`{ features, sampleHash }`
