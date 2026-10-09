# ChatGPT Blackbox Monitor 1.1.0

## What it does

Observes browser-visible ChatGPT requested models, explicit route declarations, request thinking effort, network/environment facts and local conversation history. It cannot prove internal model weights, hidden reasoning or server scheduling.

## Highlights

Minimal launcher → Main → non-modal Workbench; Chinese/English; default Route; independent proportional scaling; bounded local History and redacted evidence bundles; local A/B comparison. Unknown display drift and repeated unchanged History persistence were fixed in the validated product baseline. Public version metadata is now unified at 1.1.0.

## Install

Install official Tampermonkey and enable user-script execution. Import [production .user.js](../dist/chatgpt-blackbox-monitor.user.js), refresh ChatGPT and send a new message. Online installation: [production Raw userscript](https://raw.githubusercontent.com/karel244/chatgpt-blackbox-monitor/main/dist/chatgpt-blackbox-monitor.user.js). Initial updating is manual.

## Privacy

No telemetry/automatic upload path; no persistence of full prompts/answers or authentication values. Local exports retain some contextual clues. Inspect before sharing; never upload credentials, raw HAR or real chat text.

## Known limitations

Unknown/Partial remain explicit. Storage budgets and protocol coverage apply. Authenticated Chat/Work and native BFCache restore are not comprehensively validated. See [known limitations](KNOWN_LIMITATIONS.md).

## Verified environments

Product baseline: synthetic Chrome/Edge + official Tampermonkey 5.5.0 capture, UI, Unknown long-run and DOM stability validation. Public v2 packaging: full Static/Node checks and production/synthetic builds repeated; unit 141/141 and integration 55/55 passed. One uncertain 14-test file is omitted from distribution. Functional logic is unchanged. After adding public @homepageURL/@supportURL metadata, format/lint/typecheck, unit 141/141, integration 55/55, production build and synthetic build all passed again. No new authenticated validation is claimed.

Real-user live smoke: preliminary positive feedback after performance-fixed RC.

## SHA-256

Production `chatgpt-blackbox-monitor.user.js`:

```text
b551a2a578666b72aff678adb6f77d6698a14640f6ad47a20930066ead77592c
```

The [GitHub repository](https://github.com/karel244/chatgpt-blackbox-monitor) has been created. The project uses the [MIT License](../LICENSE), which has been added. The [v1.1.0 Release](https://github.com/karel244/chatgpt-blackbox-monitor/releases/tag/v1.1.0) is published; use its production userscript asset for manual installation.

**Public source-provenance audit: PASS.** The uncertain monitor test file is omitted from v2 distribution; see [LICENSE_AUDIT](LICENSE_AUDIT.md). MIT License and repository URLs are confirmed above.
