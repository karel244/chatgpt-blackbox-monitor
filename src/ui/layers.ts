import { I18n } from "./i18n.ts";
import type { Snapshot } from "../history/safety.ts";
import type { Summary } from "../history/bundle.ts";
import { networkDisplay, viewportText } from "./cleanup.ts";
// Reconcile a detached presentation draft without replacing interactive live nodes.
// Browser-owned open/value/focus state stays on the original nodes.
export function reconcileChildren(parent: Node, desired: Node[]) {
  const existing = [...parent.childNodes];
  const key = (node: Node) =>
    node.nodeType === 1
      ? ((node as HTMLElement).dataset.eventId ?? null)
      : null;
  const keyed = new Map(existing.filter((n) => key(n)).map((n) => [key(n), n]));
  const retained = new Set<Node>();
  desired.forEach((candidate, index) => {
    const candidateKey = key(candidate);
    const old = candidateKey ? keyed.get(candidateKey) : existing[index];
    const compatible =
      old &&
      old.nodeType === candidate.nodeType &&
      old.nodeName === candidate.nodeName &&
      key(old) === candidateKey;
    const live = compatible ? old : candidate;
    if (compatible && live !== candidate) {
      if (live.nodeType === 3) {
        if (live.nodeValue !== candidate.nodeValue)
          live.nodeValue = candidate.nodeValue;
      } else if (live.nodeType === 1) {
        const a = live as Element,
          b = candidate as Element;
        for (const attr of [...b.attributes]) {
          if (
            ["open", "style"].includes(attr.name) ||
            (attr.name === "value" && a.tagName !== "OPTION")
          )
            continue;
          if (a.getAttribute(attr.name) !== attr.value)
            a.setAttribute(attr.name, attr.value);
        }
        reconcileChildren(live, [...candidate.childNodes]);
      }
    }
    retained.add(live);
    if (parent.childNodes[index] !== live)
      parent.insertBefore(live, parent.childNodes[index] ?? null);
  });
  for (const old of existing)
    if (!retained.has(old) && old.parentNode === parent)
      parent.removeChild(old);
}
export const QUICK_TABS = [
  "Route",
  "Network",
  "Environment",
  "History",
] as const;
export function setButtonIcon(
  doc: Document,
  button: HTMLButtonElement,
  glyph: string,
) {
  button.dataset.icon = glyph;
  const icon = doc.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = glyph;
  button.replaceChildren(icon);
}
export function installLayers(
  doc: Document,
  shell: HTMLElement,
  workbench: HTMLElement,
  selector: HTMLElement,
  controls: HTMLElement[],
  settings: HTMLElement,
  i18n: I18n,
  button: (
    label: string,
    parent: HTMLElement,
    run: () => void,
  ) => HTMLButtonElement,
  advanced: (category?: string) => void,
  loadHistory: (parent: HTMLElement) => void,
  onLayer: (layer: "launcher" | "main" | "workbench") => void = () => {},
) {
  const quick = doc.createElement("section");
  quick.className = "quick";
  quick.id = "blackbox-main";
  quick.setAttribute("role", "dialog");
  quick.setAttribute("aria-modal", "false");
  quick.hidden = true;
  const top = doc.createElement("div");
  top.className = "main-title surface-header";
  const heading = doc.createElement("strong");
  top.append(heading);
  const menu = button("More options", top, () => {
    settings.hidden = !settings.hidden;
  });
  menu.className = "icon more";
  setButtonIcon(doc, menu, "···");
  const contextSlot = doc.createElement("div");
  contextSlot.className = "context-slot";
  const context = doc.createElement("div");
  context.className = "capture-context";
  Object.assign(context.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    alignItems: "center",
    maxWidth: "100%",
  });
  const contextLabel = doc.createElement("span"),
    brief = doc.createElement("small");
  context.append(contextLabel, selector, brief);
  quick.append(contextSlot);
  shell.insertBefore(context, workbench);
  const syncContext = () => {
    const daily = quick.hidden && workbench.hidden;
    context.hidden = daily;
    if (!daily) {
      const slot = quick.hidden
        ? workbench.querySelector(".context-slot")
        : contextSlot;
      if (slot && context.parentElement !== slot) slot.append(context);
    }
    selector.hidden = daily;
    contextLabel.hidden = daily;
    brief.hidden = !daily;
    contextLabel.textContent = i18n.t("Current capture");
    brief.textContent =
      (selector as HTMLSelectElement).selectedOptions?.[0]?.textContent ??
      i18n.enum("Unknown");
  };
  const close = () => {
    quick.hidden = true;
    workbench.hidden = true;
    onLayer("launcher");
    syncContext();
  };
  const closeButton = button("Close", top, close);
  closeButton.className = "icon";
  setButtonIcon(doc, closeButton, "×");
  quick.prepend(top);
  const tabs = doc.createElement("div");
  tabs.className = "tabs";
  tabs.setAttribute("role", "tablist");
  const content = doc.createElement("div");
  let cardsTarget = content,
    structuralKey = "",
    presentationKey = "";
  content.className = "cards";
  content.tabIndex = -1;
  const displayContext = doc.createElement("small");
  displayContext.className = "display-context";
  quick.append(displayContext);
  let current: (typeof QUICK_TABS)[number] = "Route",
    data: {
      values: unknown[];
      safe: Snapshot | null;
      summary: Summary | null;
      related: Snapshot[];
    } | null = null;
  const tabButtons = new Map<string, HTMLButtonElement>();
  for (const name of QUICK_TABS) {
    const b = button(name, tabs, () => {
      current = name;
      render(true);
    });
    b.setAttribute("role", "tab");
    tabButtons.set(name, b);
  }
  quick.append(tabs, content);
  tabs.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const index = QUICK_TABS.indexOf(current);
    current =
      e.key === "Home"
        ? QUICK_TABS[0]
        : e.key === "End"
          ? QUICK_TABS[QUICK_TABS.length - 1]!
          : QUICK_TABS[
              (index + (e.key === "ArrowRight" ? 1 : QUICK_TABS.length - 1)) %
                QUICK_TABS.length
            ]!;
    render(true);
    tabButtons.get(current)?.focus();
  });
  const operations = doc.createElement("div");
  operations.className = "surface-footer";
  operations.append(...controls);
  const openWorkbench = (name = "Timeline") => {
    quick.hidden = true;
    settings.hidden = true;
    workbench.hidden = false;
    syncContext();
    onLayer("workbench");
    advanced(name);
  };
  button("Advanced evidence", operations, () => openWorkbench()).className =
    "primary";
  settings.className = "settings-popover";
  settings.hidden = true;
  quick.append(operations, settings);
  shell.append(quick);
  const card = (name: string, value: unknown) => {
    const c = doc.createElement("div");
    c.className = "card";
    const label = doc.createElement("small"),
      body = doc.createElement("strong");
    label.textContent = i18n.t(name);
    body.textContent = String(value ?? i18n.enum("Unknown"));
    body.title = body.textContent;
    c.append(label, body);
    cardsTarget.append(c);
    return c;
  };
  const details = (name: string, fields: [string, unknown][]) => {
    const container = doc.createElement("details"),
      title = doc.createElement("summary"),
      grid = doc.createElement("div");
    title.textContent = i18n.t(name);
    title.setAttribute("aria-label", i18n.t(name));
    grid.className = "detail-grid";
    const previous = cardsTarget;
    cardsTarget = grid;
    for (const [name, value] of fields) card(name, value);
    cardsTarget = previous;
    container.append(title, grid);
    cardsTarget.append(container);
  };
  function render(fresh = false) {
    syncContext();
    if (quick.hidden) return;
    if (heading.textContent !== i18n.t("Monitor title"))
      heading.textContent = i18n.t("Monitor title");
    if (quick.getAttribute?.("aria-label") !== i18n.t("Quick controls"))
      quick.setAttribute("aria-label", i18n.t("Quick controls"));
    for (const [name, b] of tabButtons)
      if (b.getAttribute?.("aria-selected") !== String(current === name))
        b.setAttribute("aria-selected", String(current === name));
    if (current === "History") {
      structuralKey = "";
      if (fresh || !content.childNodes.length) {
        content.replaceChildren();
        loadHistory(content);
        button("All history", content, () => {
          openWorkbench("History");
        });
      }
      return;
    }
    if (!data) return;
    const viewKey = JSON.stringify([
      current,
      data.safe?.start.capture_id,
      i18n.locale,
    ]);
    const nextPresentation = JSON.stringify([viewKey, data]);
    if (!fresh && presentationKey === nextPresentation) return;
    presentationKey = nextPresentation;
    if (structuralKey !== viewKey) content.replaceChildren();
    structuralKey = viewKey;
    const draft = doc.createElement("div");
    cardsTarget = draft;
    try {
      const last = (namespace: string, field: string) =>
        [
          ...(data!.safe?.events ?? []),
          ...data!.related.flatMap((s) => s.events),
        ]
          .filter(
            (e) => e.field_namespace.includes(namespace) && e.field === field,
          )
          .at(-1)?.value;
      if (current === "Route") {
        card(
          "Route verdict",
          i18n.enum(data.summary?.route_verdict.verdict ?? "Unknown"),
        ).className += " conclusion";
        ["Requested", "Server Route", "Resolved Route"].forEach((name, index) =>
          card(name, data!.values[index]),
        );
        card("Thinking Effort", data.values[3]);
        details("Evidence details", [
          [
            "Response effort",
            i18n.enum(last("response", "thinking_effort") ?? "Unknown"),
          ],
          ["fast_convo", last("response", "fast_convo")],
          ...["A", "B", "C", "D"].map((level): [string, unknown] => [
            level,
            data!.safe?.events.filter((e) => e.level === level).length ?? 0,
          ]),
        ]);
      } else if (current === "Network") {
        const network = networkDisplay(data.safe);
        card("Network Status", i18n.enum(network.status)).className +=
          " conclusion";
        card("HTTP status", network.http);
        for (const [name, value] of network.alerts) card(name, value);
        details(
          "Detailed diagnostics",
          network.fields.map(([name, value]): [string, unknown] => [
            name,
            name === "PoW"
              ? (value ?? last("pow", "association_status"))
              : value,
          ]),
        );
      } else {
        const events = data.related
          .flatMap((s) => s.events)
          .filter((e) => e.level === "E");
        for (const field of [
          "browser",
          "browser_version",
          "os",
          "viewport",
          "timezone",
          "online",
        ]) {
          const rawField =
            (
              {
                browser_version: "browser_major",
                build_marker: "build_id",
                asset_set: "asset_set_hash",
              } as Record<string, string>
            )[field] ?? field;
          const value =
            field === "viewport"
              ? viewportText(
                  events.filter((e) => e.field === "viewport.width").at(-1)
                    ?.value,
                  events.filter((e) => e.field === "viewport.height").at(-1)
                    ?.value,
                  events.filter((e) => e.field === "device_pixel_ratio").at(-1)
                    ?.value,
                )
              : events.filter((e) => e.field === rawField).at(-1)?.value;
          card(
            field,
            field === "online" && typeof value === "boolean"
              ? i18n.t(value ? "Online" : "Offline")
              : value,
          );
        }
        details("Technical details", [
          [
            "build_marker",
            events.filter((e) => e.field === "build_id").at(-1)?.value,
          ],
          [
            "asset_set",
            events.filter((e) => e.field === "asset_set_hash").at(-1)?.value,
          ],
        ]);
      }
      const raw = doc.createElement("details"),
        label = doc.createElement("summary"),
        pre = doc.createElement("pre");
      label.textContent = i18n.t("Raw fields");
      pre.textContent = JSON.stringify(
        {
          events: data.safe?.events.slice(-20),
          related: data.related.map((s) => ({
            mode: s.start.mode,
            events: s.events.slice(-5),
          })),
        },
        null,
        2,
      ).slice(0, 50000);
      raw.append(label, pre);
      cardsTarget.append(raw);
    } finally {
      cardsTarget = content;
      reconcileChildren(content, [...draft.childNodes]);
    }
  }
  const unsubscribe = i18n.subscribe(() => render(true));
  return {
    quick,
    context,
    content,
    close,
    openWorkbench,
    show() {
      current = "Route";
      quick.hidden = false;
      workbench.hidden = true;
      settings.hidden = true;
      quick.append(settings);
      onLayer("main");
      render(true);
      content.focus();
    },
    update(
      values: unknown[],
      safe: Snapshot | null,
      summary: Summary | null,
      related: Snapshot[],
      provenance = "",
    ) {
      data = { values, safe, summary, related };
      if (displayContext.textContent !== provenance)
        displayContext.textContent = provenance;
      displayContext.hidden = !provenance;
      quick.dataset.captureId = safe?.start.capture_id ?? "";
      render();
    },
    dispose() {
      unsubscribe();
    },
  };
}
