import { installPosition, type UIPreferences } from "./preferences.ts";
import { installScale, MAIN_SCALE_KEY, WORKBENCH_SCALE_KEY } from "./scale.ts";
import { installLayers, reconcileChildren, setButtonIcon } from "./layers.ts";
import { I18n } from "./i18n.ts";
import { historyDisplay, launcherFacts } from "./cleanup.ts";
import {
  applyHostCriticalStyle,
  applyShellCriticalStyle,
  applySurfaceCriticalStyle,
  applyFallbackStructure,
  setSurfaceVisible,
  applyElementStyle,
  installVisualStyles,
  type StyleRole,
} from "./style.ts";
import type { Journal } from "../core/journal.ts";
import type { Context } from "../host/types.ts";
import { summarize, type Bundle } from "../history/bundle.ts";
import { safeSnapshot, type Snapshot } from "../history/safety.ts";
import type { HistoryStore } from "../history/storage.ts";
import {
  HistoryOperation,
  recoverHistoryView,
  exportHistoryRecord,
} from "./history-view.ts";
import {
  createDescriptor,
  validateDescriptor,
  type Descriptor,
} from "../compare/experiment.ts";
import type { Experiments } from "../compare/experiment.ts";
import { compareBundles, baseline } from "../compare/compare.ts";
import {
  chooseCapture,
  currentCaptures,
  displayConversation,
  timelinePage,
} from "./projection.ts";
interface Actions {
  preferences?: UIPreferences;
  checkHooks?: () => void;
  captureStatus?: () => unknown;
  context: () => Context;
  active: () => boolean;
  pause: () => void;
  resume: () => void;
  clearCurrent: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  clearAll: () => Promise<void>;
  flush: () => Promise<void>;
  export: (id: string) => Promise<{ bytes: Uint8Array; preview: unknown }>;
  import: (bytes: Uint8Array) => Promise<Bundle>;
}
export function installPanel(
  doc: Document,
  journal: Journal,
  history: HistoryStore,
  experiments: Experiments,
  actions: Actions,
  i18n = new I18n(),
) {
  const win = doc.defaultView!;
  const bindings = new Set<() => void>();
  const historyBindings = new Set<() => void>();
  const bind = (update: () => void, transient = false) => {
    (transient ? historyBindings : bindings).add(update);
    update();
  };
  const labelAttribute = (el: HTMLElement, attribute: string, label: string) =>
    bind(() => el.setAttribute(attribute, i18n.t(label)));
  const labelText = (el: HTMLElement, label: string, transient = false) =>
    bind(() => {
      el.textContent = i18n.t(label);
    }, transient);
  const historyOperation = new HistoryOperation(() => win.performance.now());
  let historyView: Awaited<ReturnType<typeof recoverHistoryView>> | null = null,
    historyReading = false,
    historyGeneration = 0,
    historyScope = "";
  const invalidateHistoryView = () => {
    historyBindings.clear();
    historyGeneration++;
    historyView = null;
    historyReading = false;
  };
  const host = doc.createElement("div");
  host.id = "chatgpt-blackbox-monitor";
  applyHostCriticalStyle(host);
  const shadow = host.attachShadow({ mode: "open" });
  const styleHealth = installVisualStyles(shadow, win);
  const styled = (el: HTMLElement, role: StyleRole) => {
    if (styleHealth.method === "property-fallback") applyElementStyle(el, role);
  };
  const shell = doc.createElement("section");
  shell.className = "shell";
  applyShellCriticalStyle(shell);
  styled(shell, "shell");
  labelAttribute(shell, "aria-label", "ChatGPT Blackbox Monitor");
  shadow.append(shell);
  const bar = doc.createElement("div");
  bar.className = "bar";
  styled(bar, "bar");
  shell.append(bar);
  const button = (
    label: string,
    parent: HTMLElement,
    run: () => void,
    transient = false,
  ) => {
    const b = doc.createElement("button");
    bind(() => {
      if (!b.dataset.icon) b.textContent = i18n.t(label);
      b.setAttribute("aria-label", i18n.t(label));
      b.title = i18n.t(label);
    }, transient);
    styled(b, "control");
    b.addEventListener("click", run);
    parent.append(b);
    return b;
  };
  const status = doc.createElement("div");
  status.className = "status";
  styled(status, "status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  let currentNotice = "";
  const notice = (text: string) => {
    currentNotice = text;
    status.textContent = i18n.t(text).slice(0, 512);
    workStatus.textContent = status.textContent;
  };
  const guard = (fn: () => Promise<void>) => {
    void fn().catch(() =>
      notice(
        "Operation failed or unsupported input. History remains available.",
      ),
    );
  };
  let hidden = false,
    manual: string | null = null,
    lastVisit = "",
    optionInventory = "",
    pageIndex = 0,
    selected: Snapshot | null = null,
    descriptor: Descriptor | null = null;
  const imported: Bundle[] = [];
  const pairs: ReturnType<typeof compareBundles>[] = [];
  const open = button("View details", shell, () => {
    layers.show();
    open.setAttribute("aria-expanded", "true");
    render();
    position.refresh();
  });
  open.className = "launcher title";
  open.setAttribute("aria-controls", "blackbox-main");
  applySurfaceCriticalStyle(open, "launcher");
  open.setAttribute("aria-expanded", "false");
  const hide = button("Hide", bar, () => {
    hidden = true;
    layers.close();
    setSurfaceVisible(open, false, "launcher");
    restore.hidden = false;
    position.refresh();
  });
  const pause = button("Pause", bar, () => {
    if (actions.active()) actions.pause();
    else actions.resume();
    render();
  });
  const restore = button(
    "Restore monitor",
    shadow as unknown as HTMLElement,
    () => {
      hidden = false;
      layers.close();
      restore.hidden = true;
      render();
      position.refresh();
      open.focus();
    },
  );
  restore.className = "restore";
  restore.hidden = true;
  Object.assign(restore.style, {
    position: "fixed",
    width: "16px",
    height: "32px",
    padding: "0",
    opacity: "0.65",
    pointerEvents: "auto",
    zIndex: "2147483001",
  });
  bind(() => {
    restore.textContent = "●";
  });
  const position = installPosition(
    open,
    open,
    open,
    restore,
    actions.preferences,
  );
  const select = doc.createElement("select");
  styled(select, "control");
  labelAttribute(select, "aria-label", "Current capture");
  select.addEventListener("change", () => {
    manual = select.value;
    pageIndex = 0;
    render();
  });

  const panel = doc.createElement("section");
  panel.className = "panel";
  panel.id = "blackbox-workbench";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  styled(panel, "panel");
  applySurfaceCriticalStyle(panel, "workbench");
  panel.hidden = true;
  labelAttribute(panel, "aria-label", "Forensic evidence");
  shell.append(panel);
  const toolbar = doc.createElement("div");
  toolbar.className = "bar";
  styled(toolbar, "bar");
  const workHeader = doc.createElement("header");
  workHeader.className = "work-title surface-header";
  const workHeading = doc.createElement("strong");
  labelText(workHeading, "Evidence Workbench");
  workHeader.append(workHeading);
  const workContext = doc.createElement("div");
  workContext.className = "context-slot";
  const workRow = doc.createElement("div");
  workRow.className = "work-row";
  const navigation = doc.createElement("nav");
  navigation.className = "work-nav";
  labelAttribute(navigation, "aria-label", "Workbench navigation");
  panel.append(workHeader, workContext, workRow, toolbar);
  workRow.append(navigation);
  const close = () => {
    invalidateHistoryView();
    panel.hidden = true;
    layers.close();
    position.refresh();
    open.setAttribute("aria-expanded", "false");
    open.focus();
  };
  button("Back to controls", workHeader, () => {
    layers.show();
    render();
  });
  const workClose = button("Close", workHeader, close);
  workClose.className = "icon";
  setButtonIcon(doc, workClose, "×");
  const category = doc.createElement("select");
  styled(category, "control");
  labelAttribute(category, "aria-label", "Evidence section");
  for (const name of [
    "Advanced settings",
    "Timeline",
    "A/B/C/D",
    "Transport / Timing",
    "Network / Cloudflare / PoW / IP",
    "Environment / Frontend Build",
    "Capture Health / Storage",
    "History",
    "Redaction preview",
    "Experiment",
    "Compare",
  ]) {
    const o = doc.createElement("option");
    o.value = name;
    labelText(o, name);
    category.append(o);
  }
  category.hidden = true;
  toolbar.append(category);
  const navigationLabels = [
    ["Route evidence", "A/B/C/D"],
    ["Timeline", "Timeline"],
    ["Network", "Network / Cloudflare / PoW / IP"],
    ["Environment", "Environment / Frontend Build"],
    ["History", "History"],
    ["A/B compare", "Compare"],
    ["System / Health", "Capture Health / Storage"],
    ["Advanced settings", "Advanced settings"],
  ];
  for (const [label, value] of navigationLabels) {
    const b = button(label!, navigation, () => {
      category.value = value!;
      invalidateHistoryView();
      pageIndex = 0;
      render();
    });
    b.dataset.category = value;
  }
  const secondaryNav = doc.createElement("details");
  const secondaryLabel = doc.createElement("summary");
  labelText(secondaryLabel, "More evidence");
  secondaryNav.append(secondaryLabel);
  for (const name of [
    "Transport / Timing",
    "Redaction preview",
    "Experiment",
  ]) {
    const b = button(name, secondaryNav, () => {
      category.value = name;
      invalidateHistoryView();
      pageIndex = 0;
      render();
    });
    b.dataset.category = name;
  }
  navigation.append(secondaryNav);
  const languageLabel = doc.createElement("label");
  const languageText = doc.createElement("span");
  labelText(languageText, "Language");
  const language = doc.createElement("select");
  styled(language, "control");
  labelAttribute(language, "aria-label", "Language");
  for (const [value, label] of [
    ["zh-CN", "简体中文"],
    ["en-US", "English"],
  ]) {
    const option = doc.createElement("option");
    option.value = value!;
    option.textContent = label!;
    language.append(option);
  }
  language.value = i18n.locale;
  languageLabel.append(languageText, language);
  toolbar.append(languageLabel);
  language.addEventListener("change", () => {
    try {
      i18n.setLocale(language.value);
    } catch {
      notice(
        "Operation failed or unsupported input. History remains available.",
      );
      language.value = i18n.locale;
    }
  });
  category.addEventListener("change", () => {
    invalidateHistoryView();
    pageIndex = 0;
    render();
  });
  button("Previous page", toolbar, () => {
    pageIndex = Math.max(0, pageIndex - 1);
    render();
  });
  button("Next page", toolbar, () => {
    pageIndex++;
    render();
  });
  button("Export ZIP", toolbar, () =>
    guard(async () => {
      if (!selected) throw Error("no_capture");
      const r = await actions.export(selected.start.capture_id);
      download(r.bytes, "blackbox-evidence.zip");
      notice("Sanitized local ZIP exported. Review it before sharing.");
    }),
  );
  button("Clear current", toolbar, () =>
    guard(async () => {
      if (!win.confirm(i18n.t("Confirm clear current"))) return;
      if (selected) await actions.clearCurrent(selected.start.capture_id);
      invalidateHistoryView();
      manual = null;
      render();
    }),
  );
  button("Clear history", toolbar, () =>
    guard(async () => {
      if (!win.confirm(i18n.t("Confirm clear history"))) return;
      await actions.clearHistory();
      invalidateHistoryView();
      render();
    }),
  );
  button("Clear all", toolbar, () =>
    guard(async () => {
      if (!win.confirm(i18n.t("Confirm clear all"))) return;
      await actions.clearAll();
      invalidateHistoryView();
      manual = null;
      render();
    }),
  );
  const file = doc.createElement("input");
  styled(file, "control");
  file.type = "file";
  file.accept = ".zip";
  file.multiple = true;
  labelAttribute(
    file,
    "aria-label",
    "Import evidence ZIPs for local comparison",
  );
  const importControls = doc.createElement("div");
  importControls.className = "import-controls";
  const importLabel = doc.createElement("span");
  labelText(importLabel, "Import evidence ZIPs for local comparison");
  importControls.append(importLabel, file);
  navigation.append(importControls);
  file.addEventListener("change", () =>
    guard(async () => {
      const files = [...(file.files ?? [])];
      file.value = "";
      if (files.length > 2) throw Error("pair_limit");
      const bundles = [];
      for (const f of files) {
        if (f.size > 20 * 1048576) throw Error("file_limit");
        bundles.push(
          await actions.import(new Uint8Array(await f.arrayBuffer())),
        );
      }
      imported.push(...bundles);
      while (imported.length > 2) imported.shift();
      category.value = "Compare";
      render();
      notice("Local import validated; no history writes or upload.");
    }),
  );
  const section = doc.createElement("div");
  let contentTarget = section,
    structuralKey = "",
    redactionRevision = "";
  section.tabIndex = -1;
  labelAttribute(section, "aria-label", "Evidence content");
  section.className = "evidence-content";
  workRow.append(section);
  const experimentForm = doc.createElement("div");
  const descriptorInput = doc.createElement("textarea");
  styled(descriptorInput, "control");
  styled(descriptorInput, "textarea");
  labelAttribute(
    descriptorInput,
    "aria-label",
    "Local experiment descriptor JSON",
  );
  descriptorInput.maxLength = 16384;
  experimentForm.append(descriptorInput);
  button("Create experiment", experimentForm, () => {
    descriptor = createDescriptor("task-1", "browser-local");
    descriptorInput.value = JSON.stringify(descriptor, null, 2);
    notice(
      "Edit task, replicate, browser label and declared conditions; share the same UUID with the second browser.",
    );
  });
  button("Save descriptor", experimentForm, () =>
    guard(async () => {
      descriptor = validateDescriptor(JSON.parse(descriptorInput.value));
      await experiments.save(descriptor);
      notice(
        "Descriptor saved locally. Account condition is manual declaration only.",
      );
    }),
  );
  const descriptorFile = doc.createElement("input");
  styled(descriptorFile, "control");
  descriptorFile.type = "file";
  descriptorFile.accept = ".json";
  labelAttribute(
    descriptorFile,
    "aria-label",
    "Import local experiment descriptor",
  );
  experimentForm.append(descriptorFile);
  descriptorFile.addEventListener("change", () =>
    guard(async () => {
      const f = descriptorFile.files?.[0];
      descriptorFile.value = "";
      if (!f || f.size > 16384) throw Error("descriptor_limit");
      descriptor = validateDescriptor(JSON.parse(await f.text()));
      descriptorInput.value = JSON.stringify(descriptor, null, 2);
      await experiments.save(descriptor);
      notice("Descriptor imported locally.");
    }),
  );
  button("Export descriptor", experimentForm, () => {
    if (!descriptor) return;
    download(
      new TextEncoder().encode(JSON.stringify(descriptor, null, 2)),
      "blackbox-experiment.json",
      "application/json",
    );
  });
  const key = doc.createElement("input");
  styled(key, "control");
  key.type = "password";
  key.maxLength = 64;
  labelAttribute(key, "placeholder", "Optional shared 64 hex key");
  labelAttribute(key, "aria-label", "Optional shared local experiment key");
  experimentForm.append(key);
  button("Save local key", experimentForm, () =>
    guard(async () => {
      if (!descriptor) throw Error("no_descriptor");
      const value = key.value;
      key.value = "";
      await experiments.save(descriptor, value);
      notice("Shared key stored only locally; absent from evidence exports.");
    }),
  );
  const prompt = doc.createElement("textarea");
  styled(prompt, "control");
  styled(prompt, "textarea");
  labelAttribute(
    prompt,
    "placeholder",
    "Optional transient exact user content",
  );
  prompt.maxLength = 1048576;
  labelAttribute(
    prompt,
    "aria-label",
    "Optional transient user content for HMAC association",
  );
  experimentForm.append(prompt);
  button("Bind current run", experimentForm, () =>
    guard(async () => {
      if (!selected || !descriptor) throw Error("no_selected_descriptor");
      const value = prompt.value;
      prompt.value = "";
      await experiments.bind(
        selected.start.capture_id,
        descriptor,
        value ? [value] : undefined,
      );
      notice(
        "Independent run bound. Content discarded; hash does not prove equal context.",
      );
    }),
  );
  button("Clear experiment", experimentForm, () =>
    guard(async () => {
      if (descriptor) await history.clearExperiment(descriptor.experiment_uuid);
      descriptor = null;
      descriptorInput.value = "";
      key.value = "";
      prompt.value = "";
      notice("Local experiment cleared.");
    }),
  );
  const threshold = doc.createElement("input");
  styled(threshold, "control");
  threshold.type = "number";
  threshold.value = "10";
  threshold.min = "1";
  labelAttribute(threshold, "aria-label", "Timing ratio flag threshold");
  const absolute = doc.createElement("input");
  styled(absolute, "control");
  absolute.type = "number";
  absolute.value = "10000";
  absolute.min = "0";
  labelAttribute(
    absolute,
    "aria-label",
    "Timing absolute difference threshold in ms",
  );
  const compareControls = doc.createElement("div");
  compareControls.append(threshold, absolute);
  button("Compare / add pair", compareControls, () => {
    if (imported.length !== 2) return;
    const p = compareBundles(imported[0]!, imported[1]!, {
      ratio: Number(threshold.value),
      absolute_ms: Number(absolute.value),
    });
    if (
      !pairs.some(
        (x) => JSON.stringify(x.run_ids) === JSON.stringify(p.run_ids),
      )
    )
      pairs.push(p);
    if (pairs.length > 200) pairs.shift();
    render();
  });
  const settings = doc.createElement("details");
  const settingsTitle = doc.createElement("summary");
  labelText(settingsTitle, "Settings");
  settings.append(settingsTitle, languageLabel);
  const management = doc.createElement("details"),
    managementTitle = doc.createElement("summary");
  labelText(managementTitle, "Data management");
  management.append(managementTitle);
  const controlButtons = [...toolbar.querySelectorAll("button")];
  for (const b of controlButtons.filter(
    (b) =>
      b.textContent === i18n.t("Clear current") ||
      b.textContent === i18n.t("Clear history") ||
      b.textContent === i18n.t("Clear all"),
  ))
    management.append(b);
  const diagnostics = doc.createElement("details"),
    diagnosticsTitle = doc.createElement("summary");
  labelText(diagnosticsTitle, "Diagnostics");
  diagnostics.append(diagnosticsTitle);
  button("Check hook health", diagnostics, () => {
    actions.checkHooks?.();
  });
  button("Capture status", diagnostics, () => {
    layers.openWorkbench("Capture Health / Storage");
  });
  settings.append(hide, management, diagnostics);
  const exportButton = controlButtons.find(
    (b) => b.textContent === i18n.t("Export ZIP"),
  )!;
  const advanced = (name = "Timeline") => {
    invalidateHistoryView();
    category.value = name;
    panel.hidden = false;
    render();
    section.focus();
    position.refresh();
  };
  let recentGeneration = 0;
  const layers = installLayers(
    doc,
    shell,
    panel,
    select,
    [pause, exportButton],
    settings,
    i18n,
    button,
    advanced,
    (parent) => {
      const generation = ++recentGeneration;
      guard(async () => {
        const view = await recoverHistoryView(
          () => actions.flush(),
          () => history.list(),
          historyOperation,
        );
        if (generation !== recentGeneration || !parent.isConnected) return;
        for (const r of view.rows.slice(0, 20)) {
          const line = doc.createElement("div");
          line.className = "history-row";
          const display = historyDisplay(r.snapshot, i18n),
            caption = doc.createElement("div"),
            heading = doc.createElement("strong"),
            states = doc.createElement("span"),
            secondary = doc.createElement("small");
          caption.className = "history-caption";
          heading.textContent = `${display.time} · ${display.model}`;
          heading.title = `${display.modelSource}: ${display.model}`;
          states.textContent = `${display.verdict} · ${display.effort} · ${display.duration}`;
          secondary.textContent = `${display.modelSource} · #${display.id} · ${i18n.enum(r.completeness)}`;
          caption.append(heading, states, secondary);
          line.append(caption);
          const b = doc.createElement("button");
          b.textContent = "↗";
          b.title = i18n.t("Export this history round");
          b.className = "history-export";
          b.setAttribute(
            "aria-label",
            i18n.t("Export this history round") +
              " " +
              r.manifest.capture_id.slice(0, 8),
          );
          b.addEventListener("click", () =>
            guard(async () => {
              await exportHistoryRecord(
                view,
                r,
                (bytes) => download(bytes, "blackbox-history.zip"),
                historyOperation,
              );
            }),
          );
          line.append(b);
          parent.append(line);
        }
      });
    },
    (layer) => {
      setSurfaceVisible(open, layer === "launcher", "launcher");
      setSurfaceVisible(layers.quick, layer === "main", "main");
      setSurfaceVisible(panel, layer === "workbench", "workbench");
      open.setAttribute("aria-expanded", String(layer !== "launcher"));
      position.refresh();
      mainPosition?.refresh();
      workPosition?.refresh();
      if (layer === "launcher") open.focus();
    },
  );
  applySurfaceCriticalStyle(layers.quick, "main");
  if (styleHealth.method === "property-fallback") {
    applyFallbackStructure(layers.quick);
    applyFallbackStructure(panel);
  }
  setSurfaceVisible(layers.quick, false, "main");
  setSurfaceVisible(panel, false, "workbench");
  const unusedRestore = doc.createElement("button");
  const mainScale = installScale(
    layers.quick,
    460,
    560,
    MAIN_SCALE_KEY,
    () => i18n.t("Scale Main"),
    () => mainPosition.refresh(),
    actions.preferences,
  );
  const workScale = installScale(
    panel,
    960,
    680,
    WORKBENCH_SCALE_KEY,
    () => i18n.t("Scale Workbench"),
    () => workPosition.refresh(),
    actions.preferences,
  );
  const mainPosition = installPosition(
    layers.quick,
    layers.quick,
    layers.quick.querySelector(".main-title")!,
    unusedRestore,
    actions.preferences,
    "blackbox.ui.main.position",
    mainScale.refresh,
  );
  const workPosition = installPosition(
    panel,
    panel,
    workHeader,
    unusedRestore,
    actions.preferences,
    "blackbox.ui.workbench.position",
    workScale.refresh,
  );
  layers.quick.append(status);
  const workStatus = doc.createElement("div");
  workStatus.className = "status";
  workStatus.setAttribute("role", "status");
  panel.append(workStatus);
  button("Export ZIP", toolbar, () => exportButton.click());
  const theme = () => {
    const scheme = win.getComputedStyle(doc.documentElement).colorScheme;
    const background = doc.body
      ? win.getComputedStyle(doc.body).backgroundColor
      : "";
    const rgb = background.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
    const darkBackground =
      rgb &&
      Number(rgb[1]) * 0.2126 +
        Number(rgb[2]) * 0.7152 +
        Number(rgb[3]) * 0.0722 <
        128;
    host.dataset.theme =
      scheme === "dark" ||
      (scheme !== "light" && darkBackground) ||
      (scheme !== "light" &&
        win.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
  };
  const media = win.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", theme);
  const themeObserver = new (
    win as Window & { MutationObserver: typeof MutationObserver }
  ).MutationObserver(theme);
  themeObserver.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ["style", "class"],
  });
  if (doc.body)
    themeObserver.observe(doc.body, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  theme();
  function download(bytes: Uint8Array, name: string, type = "application/zip") {
    const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type }),
      ),
      a = doc.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function text(value: unknown) {
    if (typeof value === "string") {
      const p = doc.createElement("p");
      p.textContent = i18n.t(value);
      contentTarget.append(p);
      return;
    }
    const object = value as {
      conclusion?: string;
      page?: number;
      pages?: number;
      total?: number;
      health?: { completeness: string };
    } | null;
    if (object?.conclusion) {
      const badge = doc.createElement("strong");
      badge.textContent = i18n.enum(object.conclusion);
      contentTarget.append(badge);
    }
    if (object?.page) {
      const p = doc.createElement("p");
      p.textContent = `${i18n.t("Page")} ${object.page} / ${object.pages} · ${object.total}`;
      contentTarget.append(p);
      return;
    }
    const detail = doc.createElement("details"),
      label = doc.createElement("summary"),
      pre = doc.createElement("pre");
    label.textContent = i18n.t("Raw fields");
    styled(pre, "pre");
    pre.textContent = JSON.stringify(value, null, 2).slice(0, 50000);
    detail.append(label, pre);
    contentTarget.append(detail);
  }
  function render() {
    if (hidden) return;
    const context = actions.context();
    const scope = `${context.document_id}:${context.visit_id}:${context.epoch}`;
    if (historyScope !== scope) {
      invalidateHistoryView();
      historyScope = scope;
    }
    if (lastVisit !== context.visit_id) {
      manual = null;
      pageIndex = 0;
      lastVisit = context.visit_id;
    }
    const snapshots = journal
      .ids()
      .map((id) => journal.snapshot(id))
      .filter((s): s is Snapshot => !!s);
    const current = currentCaptures(snapshots, context);
    selected = chooseCapture(snapshots, context, manual);
    const inventory = JSON.stringify(
      current.map((s) => [s.start.capture_id, s.start.transport]),
    );
    if (inventory !== optionInventory) {
      optionInventory = inventory;
      const optionDraft: Node[] = [];
      for (const s of current) {
        const o = doc.createElement("option");
        o.value = s.start.capture_id;
        o.textContent = `${s.start.transport}: ${s.start.capture_id.slice(0, 8)}`;
        optionDraft.push(o);
      }
      reconcileChildren(select, optionDraft);
    }
    if (selected) select.value = selected.start.capture_id;
    const pauseLabel = i18n.t(actions.active() ? "Pause" : "Resume");
    if (pause.textContent !== pauseLabel) {
      pause.textContent = pauseLabel;
      pause.setAttribute("aria-label", pauseLabel);
      pause.title = pauseLabel;
    }
    const presentation = (snapshot: Snapshot | null) => {
      const safe = snapshot ? safeSnapshot(snapshot) : null,
        summary = safe ? summarize(safe) : null;
      const last = (ns: string, f: string) =>
        safe?.events
          .filter((e) => e.field_namespace === ns && e.field === f)
          .at(-1)?.value ?? i18n.enum("Unknown");
      const duration =
        !snapshot || snapshot.start.mode === "reload"
          ? "Unknown"
          : summary?.capture_health.lifecycle === "Closed"
            ? summary.timing.total_ms === null
              ? "Unknown"
              : `${(summary.timing.total_ms / 1000).toFixed(1)}s total`
            : `${Math.max(0, (win.performance.now() - snapshot.start.started_at) / 1000).toFixed(1)}s elapsed`;
      const values = [
        last("request", "model"),
        last("server_ste_metadata", "model_slug"),
        last("resolved", "resolved_model_slug"),
        i18n.enum(last("request", "thinking_effort")),
        i18n.composite(
          summary?.capture_health.completeness ?? "Unknown",
          summary?.route_verdict.verdict ?? "Unknown",
          !actions.active(),
        ),
        i18n.duration(i18n.enum(duration)),
        i18n.enum(summary?.network_verdict ?? "Unknown"),
      ];
      return { safe, summary, values };
    };
    const strict = presentation(selected),
      { safe, summary } = strict;
    const display = displayConversation(snapshots, context, manual),
      shown =
        display.snapshot === selected ? strict : presentation(display.snapshot);
    const displayHelp = !display.snapshot
      ? i18n.t(
          "No conversation evidence yet. Send a new message to inspect it. Click the capsule to open the panel.",
        )
      : display.source === "recent"
        ? i18n.t(
            "Showing a recent conversation summary. Export ZIP uses Current capture above; export older rounds from History.",
          )
        : "";
    open.dataset.duration = String(shown.values[5]);
    open.dataset.captureHealth = String(shown.values[4]);
    layers.update(
      shown.values,
      shown.safe,
      shown.summary,
      snapshots.filter(
        (s) =>
          s.start.context.document_id === context.document_id &&
          s.start.context.epoch ===
            (display.snapshot?.start.context.epoch ?? context.epoch) &&
          ["environment", "network", "requirements"].includes(s.start.mode),
      ),
      `${!selected ? i18n.t("No capture in current scope") + " · " : ""}${display.source === "recent" ? i18n.t("Recent meaningful conversation") + " #" + display.snapshot!.start.capture_id.slice(0, 8) + " · " : ""}${displayHelp}`,
    );
    const route = shown.summary?.route_verdict.verdict ?? "Unknown";
    const facts = launcherFacts(shown.safe);
    const fullModel =
      facts.modelSource === "Unknown" ? i18n.enum("Unknown") : facts.model;
    const model = fullModel.replace(/^gpt-/, "");
    const launcherText = `${facts.abnormal ? "⚠" : "●"} ${!actions.active() ? i18n.enum("Paused") : facts.abnormal ? i18n.enum(facts.status) : i18n.enum(route)} · ${model} · ${shown.values[3]} · ${shown.values[5]}`;
    if (open.textContent !== launcherText) open.textContent = launcherText;
    const launcherTitle = `${displayHelp ? displayHelp + " / " : ""}${display.source === "recent" ? i18n.t("Recent meaningful conversation") : i18n.t("Current capture")} #${display.snapshot?.start.capture_id ?? "—"} / ${JSON.stringify(display.snapshot?.start.context ?? context)} / ${facts.modelSource}: ${fullModel} / ${i18n.t("Thinking Effort")}: ${shown.values[3]} / ${i18n.t("Network Status")}: ${shown.values[6]}`;
    if (open.title !== launcherTitle) {
      open.title = launcherTitle;
      open.setAttribute("aria-description", launcherTitle);
    }
    open.dataset.displaySource = display.source;
    open.dataset.captureId = display.snapshot?.start.capture_id ?? "";
    open.dataset.modelSource = facts.modelSource;
    open.dataset.tone = !actions.active()
      ? "unknown"
      : route.includes("Mismatch") ||
          route.includes("Conflict") ||
          (shown.summary &&
            shown.summary.network_verdict !== "OK" &&
            shown.summary.network_verdict !== "Unknown")
        ? "error"
        : route === "Route Match"
          ? "match"
          : "unknown";
    position.refresh();
    mainPosition.refresh();
    workPosition.refresh();
    if (panel.hidden) return;
    for (const b of navigation.querySelectorAll("button[data-category]"))
      b.setAttribute(
        "aria-current",
        b.getAttribute("data-category") === category.value ? "page" : "false",
      );
    importControls.hidden = !["Experiment", "Compare"].includes(category.value);
    if (category.value === "History" && (historyView || historyReading)) return;
    const viewKey = JSON.stringify([
      scope,
      selected?.start.capture_id,
      category.value,
      pageIndex,
      i18n.locale,
      historyGeneration,
    ]);
    const changedView = structuralKey !== viewKey;
    if (changedView) section.replaceChildren();
    structuralKey = viewKey;
    // History owns one asynchronous, generation-guarded structural render.
    const draft =
      category.value === "History" ? section : doc.createElement("div");
    contentTarget = draft;
    try {
      const verdictBadge = doc.createElement("strong");
      verdictBadge.className = "badge";
      verdictBadge.textContent = `${i18n.t("Route verdict")}: ${i18n.enum(summary?.route_verdict.verdict ?? "Unknown")} · ${i18n.enum(summary?.capture_health.completeness ?? "Unknown")}`;
      contentTarget.append(verdictBadge);
      if (category.value === "Advanced settings") {
        settings.hidden = false;
        contentTarget.append(changedView ? settings : settings.cloneNode(true));
        return;
      }
      if (category.value === "Experiment") {
        contentTarget.append(
          changedView ? experimentForm : experimentForm.cloneNode(true),
        );
        return;
      }
      if (category.value === "Compare") {
        contentTarget.append(
          changedView ? compareControls : compareControls.cloneNode(true),
        );
        if (imported.length === 2) {
          text(
            compareBundles(imported[0]!, imported[1]!, {
              ratio: Number(threshold.value),
              absolute_ms: Number(absolute.value),
            }),
          );
          text(baseline(pairs));
        } else
          text(
            "Import two local evidence ZIPs. Explicit UUID/task/replicate required; display IDs do not pair runs.",
          );
        return;
      }
      if (category.value === "History") {
        if (!historyReading) {
          historyReading = true;
          const generation = historyGeneration;
          guard(async () => {
            try {
              const view = await recoverHistoryView(
                () => actions.flush(),
                () => history.list(),
                historyOperation,
              );
              if (
                category.value === "History" &&
                generation === historyGeneration &&
                !panel.hidden
              ) {
                historyView = view;
                section.replaceChildren();
                for (const r of view.rows) {
                  const line = doc.createElement("div");
                  const caption = doc.createElement("span");
                  bind(() => {
                    caption.textContent = `${r.manifest.capture_id.slice(0, 8)} ${i18n.enum(r.completeness)} ${r.read_only ? i18n.enum("read-only") : ""} ${r.notes.join(",")}`;
                  }, true);
                  line.append(caption);
                  button(
                    "Export history " + r.manifest.capture_id.slice(0, 8),
                    line,
                    () =>
                      guard(async () => {
                        const result = await exportHistoryRecord(
                          view,
                          r,
                          (bytes) => download(bytes, "blackbox-history.zip"),
                          historyOperation,
                          () => {
                            const active = actions.context();
                            return (
                              view === historyView &&
                              generation === historyGeneration &&
                              active.document_id === context.document_id &&
                              active.visit_id === context.visit_id &&
                              active.epoch === context.epoch
                            );
                          },
                        );
                        if (!result) {
                          notice(
                            "History export failed. Check operation health.",
                          );
                          return;
                        }
                        if (!result.related_available) {
                          const relatedNotice = doc.createElement("span");
                          labelText(
                            relatedNotice,
                            " Related context unavailable; exported evidence remains conversation-only.",
                            true,
                          );
                          line.append(relatedNotice);
                        }
                      }),
                    true,
                  );
                  section.append(line);
                }
                historyOperation.mark("rows_rendered", {
                  conversation_rows: view.rows.length,
                });
                historyOperation.success();
              }
            } finally {
              if (generation === historyGeneration) historyReading = false;
            }
          });
        }
        return;
      }
      if (category.value === "Capture Health / Storage") {
        text({
          health: summary?.capture_health ?? null,
          controls: safe?.controls ?? [],
          storage: history.health,
          ui_style: styleHealth,
          ui_operation: historyOperation.snapshot,
          diagnostics: actions.captureStatus?.(),
        });
        return;
      }
      if (category.value === "Redaction preview") {
        const revision = JSON.stringify([
          viewKey,
          safe?.events.length,
          safe?.controls.length,
        ]);
        // Do not launch duplicate exports or append repeated details on a data tick.
        if (!changedView && redactionRevision === revision) {
          for (const node of [...section.childNodes].slice(1))
            contentTarget.append(node.cloneNode(true));
          return;
        }
        redactionRevision = revision;
        if (selected)
          guard(async () => {
            const r = await actions.export(selected!.start.capture_id);
            if (
              category.value === "Redaction preview" &&
              structuralKey === viewKey
            ) {
              const result = doc.createElement("div");
              result.append(section.firstChild!.cloneNode(true));
              contentTarget = result;
              try {
                text(r.preview);
              } finally {
                contentTarget = section;
              }
              reconcileChildren(section, [...result.childNodes]);
            }
          });
        return;
      }
      if (!safe) {
        text("Unknown: no bound capture in this visit.");
        return;
      }
      const related = snapshots
        .filter(
          (s) =>
            s.start.context.document_id === context.document_id &&
            s.start.context.epoch === context.epoch &&
            ["environment", "network", "requirements"].includes(s.start.mode),
        )
        .flatMap((s) => safeSnapshot(s).events);
      const all = [...safe.events, ...related];
      let shown = all;
      if (category.value === "A/B/C/D")
        shown = all.filter((e) => ["A", "B", "C", "D"].includes(e.level));
      if (category.value === "Environment / Frontend Build")
        shown = all.filter(
          (e) => e.level === "E" && !e.field_namespace.startsWith("pow"),
        );
      if (category.value === "Network / Cloudflare / PoW / IP")
        shown = all.filter(
          (e) =>
            e.level === "N" ||
            e.field_namespace.startsWith("pow") ||
            e.field === "client_ip",
        );
      if (category.value === "Transport / Timing") {
        text({
          transport: safe.start.transport,
          timing: summary!.timing,
          controls: safe.controls,
        });
        shown = all.filter(
          (e) =>
            e.transport === "websocket" ||
            e.field_namespace.startsWith("network.web") ||
            e.field_namespace === "timing",
        );
      }
      const rows = timelinePage({ ...safe, events: shown }, pageIndex);
      pageIndex = rows.page;
      text({ page: rows.page + 1, pages: rows.pages, total: rows.total });
      for (const e of rows.events) {
        const row = doc.createElement("article");
        row.className = "timeline-row";
        row.dataset.eventId = e.event_id;
        const caption = doc.createElement("div");
        caption.textContent = `${((e.monotonic_ms - safe.start.started_at) / 1000).toFixed(3)}s · ${e.level} · ${i18n.t(e.field)} · ${typeof e.value === "object" ? i18n.t("Details") : String(e.value).slice(0, 100)}`;
        const detail = doc.createElement("details"),
          rawLabel = doc.createElement("summary"),
          raw = doc.createElement("pre");
        rawLabel.textContent = i18n.t("Raw fields");
        raw.textContent = JSON.stringify(
          i18n.display({
            level: e.level,
            index: e.event_index,
            field: `${e.field_namespace}.${e.field}`,
            value: e.value,
            old_value: e.old_value,
            new_value: e.new_value,
            scope: e.task_scope,
            source: e.source_path,
            transport: e.transport,
            channel: e.channel,
            observed: e.timestamp,
            availability: e.availability ?? e.value_state,
            association: e.association,
            late: e.late_metadata,
            revision: e.revision,
          }),
        ).slice(0, 2048);
        detail.append(rawLabel, raw);
        row.append(caption, detail);
        contentTarget.append(row);
      }
    } finally {
      contentTarget = section;
      if (draft !== section) reconcileChildren(section, [...draft.childNodes]);
    }
  }
  shell.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (!panel.hidden || !layers.quick.hidden)) {
      e.stopPropagation();
      close();
    }
  });
  const mount = () => {
    if (doc.documentElement && !host.isConnected)
      doc.documentElement.append(host);
    render();
  };
  if (doc.documentElement) mount();
  else doc.addEventListener("DOMContentLoaded", mount, { once: true });
  const unsubscribeLocale = i18n.subscribe(() => {
    shadow.host.setAttribute("lang", i18n.locale);
    for (const update of [...bindings, ...historyBindings]) update();
    language.value = i18n.locale;
    notice(currentNotice);
    render();
  });
  host.setAttribute("lang", i18n.locale);
  const timer = setInterval(render, 1000);

  return {
    host,
    shadow,
    i18n,
    styleHealth,
    position,
    layers,
    get operationHealth() {
      return historyOperation.snapshot;
    },
    show: () => {
      hidden = false;
      layers.close();
      restore.hidden = true;
      render();
    },
    render,
    dispose: () => {
      unsubscribeLocale();
      bindings.clear();
      historyBindings.clear();
      clearInterval(timer);
      position.dispose();
      mainPosition.dispose();
      workPosition.dispose();
      mainScale.dispose();
      workScale.dispose();
      themeObserver.disconnect();
      media.removeEventListener("change", theme);
      layers.dispose();
      host.remove();
    },
    get selected() {
      return selected?.start.capture_id ?? null;
    },
  };
}
