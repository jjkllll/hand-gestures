import { IConfigurableEffect, ConfigField } from "./types";

const backdrop = document.getElementById("modal-backdrop") as HTMLDivElement;
const closeBtn = document.getElementById("modal-close") as HTMLButtonElement;
const applyBtn = document.getElementById("modal-apply") as HTMLButtonElement;
const cancelBtn = document.getElementById("modal-cancel") as HTMLButtonElement;
const fieldsEl = document.getElementById("editor-fields") as HTMLDivElement;

let currentEffect: IConfigurableEffect | null = null;
let schema: ConfigField[] = [];
let values: Record<string, number | string> = {};

function buildField(f: ConfigField): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const label = document.createElement("label");
  label.textContent = f.label;
  const input =
    f.type === "range"
      ? Object.assign(document.createElement("input"), {
          type: "range",
          min: String(f.min ?? 0),
          max: String(f.max ?? 100),
          step: String(f.step ?? 1),
          value: String(f.default ?? 0)
        })
      : Object.assign(document.createElement("input"), {
          type: "number",
          min: String(f.min ?? 0),
          max: String(f.max ?? 100),
          step: String(f.step ?? 1),
          value: String(f.default ?? 0)
        });
  const val = document.createElement("span");
  val.textContent = String(input.value);
  input.oninput = () => {
    val.textContent = String((input as HTMLInputElement).value);
    values[f.key] = Number((input as HTMLInputElement).value);
    if (currentEffect) currentEffect.configure({ [f.key]: values[f.key] });
  };
  wrap.appendChild(label);
  wrap.appendChild(input);
  wrap.appendChild(val);
  return wrap;
}

export function openEditor(effect: IConfigurableEffect) {
  currentEffect = effect;
  schema = effect.getConfigSchema();
  values = {};
  fieldsEl.innerHTML = "";
  for (const f of schema) {
    const el = buildField(f);
    fieldsEl.appendChild(el);
    if (typeof f.default !== "undefined") values[f.key] = f.default as number;
  }
  backdrop.classList.remove("hidden");
}

export function closeEditor() {
  backdrop.classList.add("hidden");
}

closeBtn.onclick = () => closeEditor();
cancelBtn.onclick = () => closeEditor();
applyBtn.onclick = () => {
  if (currentEffect) currentEffect.configure(values);
  closeEditor();
};
