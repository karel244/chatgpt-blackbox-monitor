export async function inspectHitTest(page) {
  return page.evaluate(() => {
    const ui = window.__BLACKBOX_SYNTHETIC__?.ui;
    const host = ui?.host,
      shadow = ui?.shadow;
    const shell = shadow?.querySelector(".shell");
    const hide = shadow?.querySelector(
      `button[aria-label="${ui.i18n?.t("Hide") ?? "Hide"}"]`,
    );
    if (!host || !shadow || !shell || !hide) return { available: false };
    const geometry = (el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        left: r.left,
      };
    };
    const computed = (el) => {
      const s = window.getComputedStyle(el);
      return Object.fromEntries(
        [
          "position",
          "display",
          "pointer-events",
          "z-index",
          "top",
          "right",
          "left",
          "width",
          "height",
          "overflow",
          "visibility",
        ].map((k) => [k, s.getPropertyValue(k)]),
      );
    };
    const label = (el) =>
      el
        ? {
            tagName: el.tagName,
            id: el.id,
            aria_label: el.getAttribute("aria-label"),
            relationship:
              el === host
                ? "monitor_host"
                : el === hide
                  ? "Hide"
                  : el.getRootNode() === shadow
                    ? "monitor_shadow"
                    : el.tagName === "BODY"
                      ? "page_body"
                      : "page_other",
          }
        : null;
    const rect = geometry(hide),
      center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const documentHits = document.elementsFromPoint(center.x, center.y);
    const shadowHit =
      typeof shadow.elementFromPoint === "function"
        ? shadow.elementFromPoint(center.x, center.y)
        : null;
    const hostStyle = computed(host),
      shellStyle = computed(shell);
    const violations = window.__BLACKBOX_CSP_DIAGNOSTIC__ ?? [];
    return {
      available: true,
      host: {
        computed: hostStyle,
        rect: geometry(host),
        inline_properties: {
          position: host.style.position,
          pointerEvents: host.style.pointerEvents,
          zIndex: host.style.zIndex,
        },
      },
      shell: { computed: shellStyle, rect: geometry(shell) },
      hide: {
        computed: computed(hide),
        rect,
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          computed(hide).visibility !== "hidden",
        enabled: !hide.disabled,
        center,
      },
      document_hit_test: documentHits.map(label),
      shadow_hit_test: {
        availability:
          typeof shadow.elementFromPoint === "function"
            ? "available"
            : "unavailable",
        target: label(shadowHit),
      },
      inline_shadow_style_count: shadow.querySelectorAll("style").length,
      adopted_stylesheet_count: shadow.adoptedStyleSheets?.length ?? null,
      style_health: ui.styleHealth ?? null,
      violations,
      verdict: {
        csp_host_inline_style_blocked:
          hostStyle.position !== "fixed" &&
          violations.some((v) => v.effectiveDirective.startsWith("style")),
        csp_shadow_style_blocked:
          shellStyle["pointer-events"] !== "auto" &&
          violations.some((v) => v.effectiveDirective.startsWith("style")),
        host_not_fixed: hostStyle.position !== "fixed",
        host_pointer_style_missing: hostStyle["pointer-events"] !== "none",
        shell_pointer_style_missing: shellStyle["pointer-events"] !== "auto",
        button_not_hit_target: shadowHit !== hide,
        body_overlays_button: documentHits[0]?.tagName === "BODY",
      },
    };
  });
}
export async function diagnoseCsp(page) {
  const before = await inspectHitTest(page);
  const adoption = await page.evaluate(() => {
    const { host, shadow } = window.__BLACKBOX_SYNTHETIC__.ui;
    let result = {
      method: "adoptedStyleSheets",
      status: "Unavailable",
      error_code: null,
    };
    try {
      const sheet = new window.CSSStyleSheet();
      sheet.replaceSync(
        ".shell{display:block;pointer-events:auto;width:300px;max-width:calc(100vw - 16px);max-height:45vh;overflow:auto;padding:8px;box-sizing:border-box}.bar{display:flex;gap:4px;flex-wrap:wrap}[hidden]{display:none!important}",
      );
      shadow.adoptedStyleSheets = [sheet];
      result = {
        method: "adoptedStyleSheets",
        status: "Installed",
        error_code: null,
      };
    } catch {
      result = {
        method: "adoptedStyleSheets",
        status: "Rejected",
        error_code: "constructed_sheet_rejected",
      };
    }
    return {
      ...result,
      host_document_same: host.ownerDocument === document,
      adopted_count: shadow.adoptedStyleSheets?.length ?? null,
    };
  });
  const adopted = await inspectHitTest(page);
  await page.evaluate(() => {
    const { host, shadow } = window.__BLACKBOX_SYNTHETIC__.ui;
    shadow.adoptedStyleSheets = [];
    host.style.position = "fixed";
    host.style.right = "8px";
    host.style.top = "8px";
    host.style.zIndex = "2147483000";
    host.style.maxWidth = "calc(100vw - 16px)";
    host.style.pointerEvents = "none";
    const shell = shadow.querySelector(".shell");
    shell.style.pointerEvents = "auto";
    shell.style.display = "block";
    shell.style.width = "300px";
    shell.style.maxWidth = "calc(100vw - 16px)";
    shell.style.maxHeight = "45vh";
    shell.style.overflow = "auto";
    shell.style.boxSizing = "border-box";
  });
  const fallback = await inspectHitTest(page);
  return {
    before,
    adoption,
    adopted,
    fallback,
    scope:
      "Frozen failed production logic; isolated test-only CSS interventions after baseline hit-test. No fixture CSP changes or force click.",
  };
}
