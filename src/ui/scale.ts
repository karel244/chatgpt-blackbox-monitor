import type { UIPreferences } from "./preferences.ts";

export const MAIN_SCALE_KEY = "blackbox.ui.mainScale";
export const WORKBENCH_SCALE_KEY = "blackbox.ui.workbenchScale";
export function validScale(value: unknown) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0.75 &&
    value <= 1.4
    ? value
    : 1;
}
export function boundedScale(value: number) {
  return Math.max(0.75, Math.min(1.4, value));
}
export function scaleGeometry(
  scale: number,
  width: number,
  height: number,
  vw: number,
  vh: number,
) {
  const availableWidth = Math.max(1, vw - 16),
    availableHeight = Math.max(1, vh - 16);
  const baseWidth = Math.min(width, availableWidth),
    baseHeight = Math.min(height, availableHeight);
  return {
    baseWidth,
    baseHeight,
    effective: Math.min(
      validScale(scale),
      availableWidth / baseWidth,
      availableHeight / baseHeight,
    ),
  };
}
// One transform scales the complete surface and its native hitboxes together.
export function installScale(
  surface: HTMLElement,
  width: number,
  height: number,
  key: string,
  label: () => string,
  changed: () => void,
  prefs?: UIPreferences,
) {
  const doc = surface.ownerDocument,
    win = doc.defaultView!;
  let stored: unknown;
  try {
    stored = prefs?.get(key);
  } catch {
    /* session default */
  }
  let requested = validScale(stored),
    geometry = scaleGeometry(
      requested,
      width,
      height,
      win.innerWidth,
      win.innerHeight,
    );
  const grip = doc.createElement("button");
  grip.type = "button";
  grip.className = "scale-handle";
  const icon = doc.createElement("span");
  icon.textContent = "◢";
  icon.setAttribute("aria-hidden", "true");
  grip.append(icon);
  Object.assign(grip.style, {
    position: "absolute",
    right: "0",
    bottom: "0",
    width: "24px",
    height: "24px",
    minHeight: "24px",
    padding: "0",
    border: "0",
    background: "transparent",
    cursor: "nwse-resize",
    touchAction: "none",
    zIndex: "3",
  });
  surface.append(grip);
  const refresh = () => {
    const viewport = win.visualViewport;
    geometry = scaleGeometry(
      requested,
      width,
      height,
      viewport?.width ?? win.innerWidth,
      viewport?.height ?? win.innerHeight,
    );
    const properties = {
      width: geometry.baseWidth + "px",
      height: geometry.baseHeight + "px",
      maxWidth: geometry.baseWidth + "px",
      maxHeight: geometry.baseHeight + "px",
      transform: `scale(${geometry.effective})`,
      transformOrigin: "top left",
      resize: "none",
    };
    for (const [name, value] of Object.entries(properties)) {
      const property = name as keyof typeof properties;
      if (surface.style[property] !== value) surface.style[property] = value;
    }
    surface.dataset.scale = String(requested);
    surface.dataset.effectiveScale = String(geometry.effective);
    surface.dataset.baseWidth = String(geometry.baseWidth);
    surface.dataset.baseHeight = String(geometry.baseHeight);
    if (grip.getAttribute("aria-label") !== label()) {
      grip.setAttribute("aria-label", label());
      grip.title = label();
    }
  };
  const save = () => {
    try {
      prefs?.set(key, requested);
    } catch {
      /* usable session scale */
    }
  };
  let start: {
    x: number;
    y: number;
    scale: number;
    width: number;
    height: number;
  } | null = null;
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    start = {
      x: e.clientX,
      y: e.clientY,
      scale: geometry.effective,
      width: geometry.baseWidth,
      height: geometry.baseHeight,
    };
    grip.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };
  const move = (e: PointerEvent) => {
    if (!start) return;
    requested = boundedScale(
      start.scale +
        ((e.clientX - start.x) * start.width +
          (e.clientY - start.y) * start.height) /
          (start.width ** 2 + start.height ** 2),
    );
    refresh();
    changed();
    e.preventDefault();
  };
  const end = () => {
    if (!start) return;
    start = null;
    save();
  };
  const keyboard = (e: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
      return;
    e.preventDefault();
    e.stopPropagation();
    requested = boundedScale(
      requested + (["ArrowRight", "ArrowUp"].includes(e.key) ? 0.05 : -0.05),
    );
    refresh();
    changed();
    save();
  };
  grip.addEventListener("pointerdown", down);
  grip.addEventListener("pointermove", move);
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
  grip.addEventListener("keydown", keyboard);
  refresh();
  return {
    refresh,
    get scale() {
      return requested;
    },
    dispose() {
      grip.removeEventListener("pointerdown", down);
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", end);
      grip.removeEventListener("pointercancel", end);
      grip.removeEventListener("keydown", keyboard);
      grip.remove();
    },
  };
}
