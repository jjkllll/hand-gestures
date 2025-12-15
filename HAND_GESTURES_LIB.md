# 手势库集成说明（ESM/UMD）

## ESM（import 方式）
- 统一接口：`src/handlib/index.ts`
- 引用：
```ts
import HandGestures from "./src/handlib/index";

// 从静态资源加载（assets/handcode/gestures）
const { recognizer, on } = await HandGestures.easySetupFromStatic({ threshold: 0.8, windowSize: 3 });
on("your-gesture-code", ({ id, code, name, distance }) => {
  // 业务联动
});

// 从目录加载（浏览器）
const dir = await window.showDirectoryPicker();
const lib = await HandGestures.loadFromDirectory(dir);
const rec = HandGestures.createRecognizer(lib, { threshold: 0.8 });
const res = rec.recognizeFromLandmarks(landmarks);

// 从路径加载（Node）
const lib2 = await HandGestures.loadFromPath("D:\\trae\\hand\\assets\\handcode\\gestures");
```

## UMD（script 标签方式）
- 文件位置：`lib/hand-gestures.umd.js`
- 引用：
```html
<script src="/lib/hand-gestures.umd.js"></script>
<script>
  // 通过目录选择加载库（浏览器）
  (async () => {
    const dir = await window.showDirectoryPicker();
    const lib = await HandGestures.loadFromDirectory(dir);
    const rec = HandGestures.createRecognizer(lib, { threshold: 0.8 });
    // landmarks 为 21 个关键点的像素坐标数组
    const res = rec.recognizeFromLandmarks(landmarks);
    console.log(res); // { id, code, name, distance } 或 null
  })();
</script>
```

## 统一编码与特征
- 编码：`code = MD5(id:name)`，用于唯一映射手势身份
- 特征：以掌心中心对齐，并按腕到中指 MCP 尺度归一化，长度 42（21 点）
- 目录结构要求：`gestures/<name>/meta.json` 与 `gestures/<name>/data/*.json`（包含 `features` 与 `sampleHash`）

## 开箱即用建议
- 将你的手势库复制/打包到项目的 `assets/handcode/gestures`，并用 `HandGestures.easySetupFromStatic()` 直接加载
- 若作为独立 npm 包发布，建议将 `src/handlib/index.ts` 作为 `exports` 的入口，并同时生成 UMD 版本

## 事件与映射
- 识别结果：`{ id, code, name, distance }`
- 可结合 `src/gesturelib/mapper.ts` 注册编码与业务回调，并在识别成功后触发应用层事件
