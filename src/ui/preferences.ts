export const POSITION_KEY = "blackbox.ui.position";
export interface UIPreferences {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
}
export function validPosition(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== "object") return null;
  const { x, y } = value as { x?: unknown; y?: unknown };
  return typeof x === "number" &&
    typeof y === "number" &&
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 0 &&
    y >= 0 &&
    x <= 1e7 &&
    y <= 1e7
    ? { x, y }
    : null;
}
export function clampPosition(
  x: number,
  y: number,
  width: number,
  vw: number,
  vh: number,
  height = 44,
) {
  return {
    x: Math.max(0, Math.min(x, Math.max(0, vw - width - 8))),
    y: Math.max(
      0,
      Math.min(y, Math.max(0, vh - Math.min(Math.max(44, height), vh) - 8)),
    ),
  };
}
export function installPosition(
  host: HTMLElement,
  shell: HTMLElement,
  title: HTMLElement,
  restore: HTMLElement,
  prefs?: UIPreferences,
  key = POSITION_KEY,
  beforeMeasure?: () => void,
) {
  const win = host.ownerDocument.defaultView!;
  let stored: unknown;
  try {
    stored = prefs?.get(key);
  } catch {
    /* safe default */
  }
  let position = validPosition(stored),
    dragging = false,
    dx = 0,
    dy = 0,
    startX = 0,
    startY = 0,
    moved = false;
  let suppressClick = false;
  const refresh = () => {
    if (shell.hidden) return;
    const viewport = win.visualViewport;
    const vw = viewport?.width ?? win.innerWidth,
      vh = viewport?.height ?? win.innerHeight;
    if (beforeMeasure) beforeMeasure();
    else {
      shell.style.maxWidth = Math.max(120, vw - 16) + "px";
      shell.style.maxHeight = Math.max(44, vh - 16) + "px";
    }
    const r = shell.getBoundingClientRect();
    const centered = key === "blackbox.ui.workbench.position";
    const p = clampPosition(
      position?.x ??
        Math.max(
          0,
          centered ? (vw - (r.width || 960)) / 2 : vw - (r.width || 300) - 28,
        ),
      position?.y ?? (centered ? 70 : key === POSITION_KEY ? 96 : 88),
      r.width || 300,
      vw,
      vh,
      r.height,
    );
    position = p;
    host.style.right = "auto";
    host.style.left = p.x + (viewport?.offsetLeft ?? 0) + "px";
    host.style.top = p.y + (viewport?.offsetTop ?? 0) + "px";
    restore.style.left = p.x + (r.width || 300) / 2 < vw / 2 ? "0px" : "auto";
    restore.style.right = restore.style.left === "auto" ? "0px" : "auto";
    restore.style.top = Math.min(Math.max(8, p.y), Math.max(8, vh - 40)) + "px";
  };
  const down = (e: PointerEvent) => {
    if (
      e.button !== 0 ||
      (e.target !== title &&
        (e.target as Element).closest("button,input,select,a"))
    )
      return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    dx = e.clientX - host.getBoundingClientRect().left;
    dy = e.clientY - host.getBoundingClientRect().top;
    title.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 5)
      return;
    moved = true;
    suppressClick = true;
    position = { x: e.clientX - dx, y: e.clientY - dy };
    refresh();
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (!moved) return;
    win.setTimeout(() => {
      suppressClick = false;
    }, 0);
    refresh();
    try {
      prefs?.set(key, position);
    } catch {
      /* session position remains usable */
    }
  };
  const click = (e: MouseEvent) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  title.addEventListener("click", click, true);
  title.addEventListener("pointerdown", down);
  title.addEventListener("pointermove", move);
  title.addEventListener("pointerup", end);
  title.addEventListener("pointercancel", end);
  win.addEventListener("resize", refresh);
  win.visualViewport?.addEventListener("resize", refresh);
  win.visualViewport?.addEventListener("scroll", refresh);
  const Constructor = (
    win as Window & { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver;
  const observer =
    typeof Constructor === "function" ? new Constructor(refresh) : null;
  observer?.observe(shell);
  return {
    refresh,
    get position() {
      return position;
    },
    dispose() {
      observer?.disconnect();
      title.removeEventListener("click", click, true);
      title.removeEventListener("pointerdown", down);
      title.removeEventListener("pointermove", move);
      title.removeEventListener("pointerup", end);
      title.removeEventListener("pointercancel", end);
      win.removeEventListener("resize", refresh);
      win.visualViewport?.removeEventListener("resize", refresh);
      win.visualViewport?.removeEventListener("scroll", refresh);
    },
  };
}
