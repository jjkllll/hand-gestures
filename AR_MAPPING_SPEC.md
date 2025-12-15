# AR 映射与编码规范

## 编码规则
- 手势编码：`code = MD5(id:name)`，其中：
  - `id`：手势编号（字符串）
  - `name`：手势名称（字符串）
- 统一索引：在 `gestures/<name>/samples.md5` 中维护每次样品新增的图片与数据的 MD5 校验行。

## 目录结构
- 根数据目录（示例）：`handcode\gestures\`
- 手势批次目录：`gestures/<name>/`
  - `images/sample-<n>-<hash8>.png`
  - `data/sample-<n>-<hash8>.json`
  - `samples.md5`
  - `meta.json`：`{ id, name, code, count, ts, version }`

## 特征格式
- 21 点特征，掌心居中、手掌尺度归一化：
  - `features = [ (x1-Cx)/S, (y1-Cy)/S, ..., (x21-Cx)/S, (y21-Cy)/S ]`
  - `C`：掌心中心，为 `{0,5,9,13,17}` 平均
  - `S`：尺度，为 `distance(0,9)`（腕到中指 MCP）

## 运行时映射
- 输入：手势编码 `code` 或名称 `name`
- 输出：AR 引擎事件集与参数（示例）
  - `translate`: `{ x, y, z }`（2D场景取 `{ x, y }`）
  - `scale`: `factor`
  - `rotate`: `angle` 或 `{ yaw, pitch, roll }`
  - `burst`: `trigger: true`
  - `color`: `{ hueMin, hueMax }`
  - `params`: `{ spawn, gravity, speedMin, speedMax, sizeMin, sizeMax, swirl }`

## 默认映射示例
- `OpenPalm` → `translate`，源跟随掌心中心 `C`
- `Pinch` → `scale`，捏合距离相对基准映射到 `factor`
- `Victory` → `rotate`，食指尖到中指尖的角度变化
- `Point` → `color+translate`，色相区间随指尖位置变化
- `Fist` → `burst+params`，刷新或强度上升

## 配置与扩展
- 参数编辑面板映射到 `params` 字段，运行时实时生效并可持久化
- 支持多手映射（左右手分工），不同编码绑定到不同事件集合
- 建议在 AR 引擎中建立统一接口：`applyGesture(code, payload)`，其中 `payload` 来自上述事件结构

## 证据链与合规
- 每次批次采样完成，更新 `samples.md5` 与 `meta.json`，保留图片与数据的 MD5 校验和相对路径
- 建议专利提交时附：`samples.md5`、若干样品 PNG/JSON、`HAND_LANDMARKS.md` 与本规范文件
