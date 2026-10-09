export interface StyleHealth {
  method: "adoptedStyleSheets" | "property-fallback";
  status: "Complete" | "Partial" | "Failed";
  reason: string;
}
export type StyleRole =
  | "shell"
  | "bar"
  | "control"
  | "daily"
  | "cell"
  | "panel"
  | "pre"
  | "textarea"
  | "drag"
  | "status";
export const CSS_TEXT = `
:host{all:initial;color-scheme:light;--bb-surface:#fff;--bb-subtle:#f3f6f6;--bb-text:#19242e;--bb-muted:#64737e;--bb-border:#dbe2e6;--bb-accent:#14786b;--bb-tint:#eaf4f0;--bb-danger:#a23d39;font:13px/1.5 "Segoe UI","Microsoft YaHei",system-ui,sans-serif;color:var(--bb-text)}
:host([data-theme=dark]){color-scheme:dark;--bb-surface:#1d2932;--bb-subtle:#263540;--bb-text:#e8eff3;--bb-muted:#9caeb9;--bb-border:#3e505c;--bb-accent:#a1d9c5;--bb-tint:#253e37;--bb-danger:#ffa8a0}
:host([hidden]){display:none!important}*{box-sizing:border-box}[hidden]{display:none!important}.shell{display:contents;pointer-events:none}
button,input,select,textarea{font:inherit;color:inherit;max-width:100%;box-sizing:border-box}button,summary,select{cursor:pointer}
button{min-height:32px;padding:7px 10px;border:1px solid var(--bb-border);border-radius:8px;background:var(--bb-surface)}button:hover{background:var(--bb-subtle);border-color:var(--bb-accent)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid var(--bb-accent);outline-offset:2px}
select,input,textarea{background:var(--bb-surface);border:1px solid var(--bb-border);border-radius:7px;padding:5px 8px}select{min-height:32px}textarea{width:100%;height:70px}
.launcher{display:block;border-radius:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 12px;font-size:12px;text-align:left;box-shadow:0 3px 14px #12243218;cursor:grab;touch-action:none;user-select:none}.launcher[data-tone=match]{color:var(--bb-accent)}.launcher[data-tone=error]{color:var(--bb-danger)}
.quick,.panel{background:var(--bb-surface);color:var(--bb-text);border:1px solid var(--bb-border);border-radius:18px;box-shadow:0 20px 70px #12243224;overflow:hidden;padding:0;font:13px/1.5 "Segoe UI","Microsoft YaHei",system-ui,sans-serif}.panel{border-radius:20px;resize:none;min-width:240px;min-height:240px}
.surface-header{display:flex;align-items:center;gap:8px;min-height:56px;flex-shrink:0;padding:12px 16px;border-bottom:1px solid var(--bb-border);cursor:grab;touch-action:none;user-select:none}.surface-header>strong{font-size:15px;font-weight:650;margin-right:auto}.surface-header button{font-size:12px}.surface-header .icon{border:0;background:none;width:32px;height:32px;min-width:32px;padding:0;display:inline-grid;place-items:center;font-size:20px}.work-title>strong{order:1}.work-title button:first-of-type{order:0}.work-title button:last-of-type{order:2}
.capture-context{padding:10px 16px;min-height:48px;border-bottom:1px solid var(--bb-border);display:flex;gap:10px!important;flex-wrap:nowrap!important;flex-shrink:0}.capture-context span{font-size:11px;color:var(--bb-muted);white-space:nowrap}.capture-context select{font-size:12px;flex:1;min-width:0}.context-slot{flex-shrink:0}
.tabs{display:flex;padding:0 16px;border-bottom:1px solid var(--bb-border);min-height:44px;flex-shrink:0}.tabs button{flex:1;border:0;border-radius:0;background:none;color:var(--bb-muted);border-bottom:2px solid transparent;font-size:12px;white-space:nowrap;padding:6px}.tabs [aria-selected=true]{border-bottom-color:var(--bb-accent);color:var(--bb-accent);font-weight:650}
.cards:focus{outline:none}.cards{flex:1;min-height:0;overflow:auto;padding:16px 20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-content:start}.card{padding:0 0 8px;min-width:0;overflow-wrap:anywhere}.card small{display:block;color:var(--bb-muted);font-size:11px;margin-bottom:4px}.card strong{display:block;font-size:13px;font-weight:600}.cards>details,.cards>.history-row,.cards>button{grid-column:1/-1}.cards .history-row{font-size:12px}.cards>details{font-size:12px}
.surface-footer,.panel>.bar{min-height:62px;display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--bb-border);flex-shrink:0}.surface-footer button{font-size:12px;white-space:nowrap}.primary{margin-left:auto;background:var(--bb-accent);color:var(--bb-surface);border-color:var(--bb-accent)}.primary:hover{background:var(--bb-accent);filter:brightness(.94)}
.cards>.conclusion{grid-column:1/-1;background:var(--bb-tint);border:1px solid var(--bb-border);border-radius:10px;padding:10px 12px}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:8px 0}.history-row{display:flex;align-items:center;gap:8px}.history-caption{flex:1;min-width:0;overflow-wrap:anywhere}.history-caption strong,.history-caption span,.history-caption small{display:block}.history-caption small{color:var(--bb-muted);font-size:10px}.history-row .history-export{width:28px;min-width:28px;min-height:28px;padding:2px;margin:0;flex-shrink:0;background:none;border-color:transparent}
:host(:not([data-theme=dark])) .cards>.conclusion small{color:var(--bb-text)}
.settings-popover{position:absolute;top:52px;right:12px;width:min(320px,calc(100% - 24px));max-height:380px;overflow:auto;z-index:2;padding:12px;background:var(--bb-surface);border:1px solid var(--bb-border);border-radius:12px;box-shadow:0 8px 30px #12243224}.settings-popover label{display:flex;gap:8px;align-items:center}.settings-popover button{margin:4px}.evidence-content>.settings-popover{position:static;width:auto;box-shadow:none;max-height:none}
.work-row{display:flex;flex:1;min-height:0}.work-nav{width:160px;flex-shrink:0;border-right:1px solid var(--bb-border);background:var(--bb-subtle);padding:14px 10px;overflow:auto}.work-nav button{display:block;width:100%;margin-bottom:4px;text-align:left;border:0;background:none;color:var(--bb-muted);font-size:12px}.work-nav [aria-current=page]{color:var(--bb-accent);background:var(--bb-tint);font-weight:650}.work-nav details{font-size:11px}.import-controls{font-size:11px;padding:8px 0}.import-controls input{width:100%;font-size:10px}
.evidence-content{flex:1;min-width:0;min-height:0;overflow:auto;padding:20px 24px}.evidence-content>.badge{display:block;padding:12px;margin-bottom:12px;background:var(--bb-tint);border:1px solid var(--bb-border);border-radius:10px;font-size:13px}.evidence-content p{font-size:12px;color:var(--bb-muted)}.timeline-row{padding:10px 12px;margin:8px 0;border:1px solid var(--bb-border);border-radius:10px;font-size:12px;overflow-wrap:anywhere}.timeline-row>div{font-family:Consolas,monospace}.timeline-row summary{font-size:11px}
summary{padding:6px 0;color:var(--bb-muted)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 Consolas,monospace;padding:12px;background:var(--bb-subtle);border-radius:8px}.history-row,.evidence-content>div{padding:8px 0;border-bottom:1px solid var(--bb-border)}.history-row button,.evidence-content>div>button{font-size:11px;margin-left:8px}.status{font-size:11px;color:var(--bb-muted);overflow-wrap:anywhere;max-height:44px;overflow:auto;padding:0 16px;flex-shrink:0}.status:empty{display:none}
.restore{position:fixed;width:16px;height:32px;padding:0;min-width:16px;min-height:32px;opacity:.55;background:var(--bb-accent);color:var(--bb-surface);border:0;border-radius:8px;pointer-events:auto;z-index:2147483001}.restore:hover,.restore:focus-visible{opacity:1}
@media(max-width:760px){.work-row{flex-direction:column}.work-nav{width:100%;display:flex;overflow:auto;flex-shrink:0;border-right:0;border-bottom:1px solid var(--bb-border);padding:6px}.work-nav button{width:auto;white-space:nowrap;margin:0}.work-nav details,.import-controls{min-width:130px}.evidence-content{padding:12px}.surface-header{padding:10px 12px}.surface-header>strong{font-size:13px}.surface-footer{padding:10px 12px;gap:4px}.surface-footer button{font-size:11px;padding:5px}.cards{padding:14px;gap:10px}}
`;
export const IA_CSS = "";
export type Surface = "launcher" | "main" | "workbench";
export function setSurfaceVisible(
  el: HTMLElement,
  visible: boolean,
  kind: Surface,
) {
  el.hidden = !visible;
  el.style.display = visible
    ? kind === "launcher"
      ? "block"
      : "flex"
    : "none";
}
export function applySurfaceCriticalStyle(el: HTMLElement, kind: Surface) {
  Object.assign(el.style, {
    position: "fixed",
    pointerEvents: "auto",
    flexDirection: "column",
    width: kind === "launcher" ? "380px" : kind === "main" ? "460px" : "960px",
    height: kind === "launcher" ? "36px" : kind === "main" ? "560px" : "680px",
    maxWidth: "calc(100vw - 24px)",
    maxHeight: "calc(100dvh - 24px)",
    boxSizing: "border-box",
    overflow: "hidden",
  });
  setSurfaceVisible(el, !el.hidden, kind);
}
export function applyFallbackStructure(el: HTMLElement) {
  for (const header of el.querySelectorAll<HTMLElement>(".surface-header"))
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      minHeight: "56px",
      flexShrink: "0",
      touchAction: "none",
      cursor: "grab",
    });
  for (const footer of el.querySelectorAll<HTMLElement>(".surface-footer,.bar"))
    Object.assign(footer.style, {
      display: "flex",
      gap: "8px",
      flexShrink: "0",
      padding: "12px",
    });
  for (const body of el.querySelectorAll<HTMLElement>(
    ".cards,.evidence-content",
  ))
    Object.assign(body.style, {
      flex: "1",
      minHeight: "0",
      minWidth: "0",
      overflow: "auto",
      padding: "12px",
    });
  for (const row of el.querySelectorAll<HTMLElement>(".work-row"))
    Object.assign(row.style, { display: "flex", flex: "1", minHeight: "0" });
  for (const nav of el.querySelectorAll<HTMLElement>(".work-nav"))
    Object.assign(nav.style, {
      width: "160px",
      flexShrink: "0",
      overflow: "auto",
    });
  for (const menu of el.querySelectorAll<HTMLElement>(".settings-popover"))
    Object.assign(menu.style, {
      position: "absolute",
      right: "12px",
      top: "52px",
      maxHeight: "380px",
      overflow: "auto",
      zIndex: "2",
      background: "Canvas",
      color: "CanvasText",
      border: "1px solid GrayText",
      padding: "12px",
    });
}

export function applyHostCriticalStyle(host: HTMLElement) {
  host.style.position = "fixed";
  host.style.right = "8px";
  host.style.top = "8px";
  host.style.zIndex = "2147483000";
  host.style.maxWidth = "calc(100vw - 16px)";
  host.style.pointerEvents = "none";
}
export function applyShellCriticalStyle(shell: HTMLElement) {
  shell.style.display = "contents";
  shell.style.pointerEvents = "none";
}
export function applyElementStyle(el: HTMLElement, role: StyleRole) {
  const styles: Record<StyleRole, Partial<CSSStyleDeclaration>> = {
    shell: {
      font: "12px system-ui",
      background: "Canvas",
      color: "CanvasText",
      border: "1px solid GrayText",
      borderRadius: "8px",
      padding: "8px",
      boxShadow: "0 2px 9px #0003",
    },
    bar: { display: "flex", gap: "4px", flexWrap: "wrap" },
    control: { font: "inherit", maxWidth: "100%", boxSizing: "border-box" },
    daily: {
      display: "grid",
      gridTemplateColumns: "100px 1fr",
      gap: "2px",
      margin: "8px 0",
    },
    cell: { margin: "0", overflowWrap: "anywhere" },
    panel: {
      resize: "none",
      overflow: "auto",
      maxWidth: "calc(100vw - 32px)",
      maxHeight: "calc(100dvh - 24px)",
      minWidth: "160px",
      minHeight: "100px",
    },
    pre: {
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      font: "11px ui-monospace",
    },
    textarea: { width: "100%", height: "70px" },
    drag: { touchAction: "none" },
    status: { overflowWrap: "anywhere" },
  };
  Object.assign(el.style, styles[role]);
}
export function installVisualStyles(
  shadow: ShadowRoot,
  win: Window,
): StyleHealth {
  try {
    const Constructor = (
      win as Window & { CSSStyleSheet: typeof CSSStyleSheet }
    ).CSSStyleSheet;
    if (typeof Constructor !== "function" || !("adoptedStyleSheets" in shadow))
      return {
        method: "property-fallback",
        status: "Partial",
        reason: "constructed_stylesheet_unavailable",
      };
    const sheet = new Constructor();
    sheet.replaceSync(CSS_TEXT + IA_CSS);
    shadow.adoptedStyleSheets = [sheet];
    if (shadow.adoptedStyleSheets[0] !== sheet || !sheet.cssRules.length)
      throw Error("ineffective");
    return {
      method: "adoptedStyleSheets",
      status: "Complete",
      reason: "same_document_stylesheet_installed",
    };
  } catch {
    return {
      method: "property-fallback",
      status: "Partial",
      reason: "constructed_stylesheet_rejected",
    };
  }
}
