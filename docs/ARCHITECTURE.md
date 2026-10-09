# Architecture

This is a Tampermonkey userscript that observes browser-visible facts. It is an independently developed monitor, not a fork of the reference tools. The released runtime bundles local TypeScript modules; there are no runtime npm dependencies, telemetry endpoints or automatic upload services.

## Capture and evidence

`src/host/` observes fetch, XHR and WebSocket while preserving the page's network semantics. Protocol adapters associate supported request, SSE/WS and reload evidence within document/visit/epoch boundaries. Unsupported or uncertain associations stay unknown/partial rather than being upgraded to facts.

| Grade | Meaning |
|---|---|
| A | Explicit server route declaration under supported protocol and trustworthy association |
| B | Client request intent, including requested model/effort |
| C | Assistant metadata |
| D | Page labels |

C/D never become A. A route match means visible declarations agree; it does not verify model weights, hardware, hidden reasoning or server scheduling. Evidence grades are separate from A/B experiments.

## Journal and history

`src/core/journal.ts` maintains ordered occurrences and capture lifecycle. Revision tracking includes event and control changes. Unchanged captures skip snapshot/redaction/queue/storage work; persisted revisions advance only after the corresponding work is committed. In-flight changes, failure, clear epochs and late events keep their existing semantics.

`src/history/` stores bounded safe snapshots in chunks and commits manifests. Persistent acknowledgement precedes closed-capture memory compaction. The active guard is 32, the journal bound 128; retention targets 200 conversation rounds, 30 days and 50 MiB together. Auxiliary context does not consume conversation quota but remains under time/byte budgets. Declared redaction drops differ from undeclared corruption gaps. Recovery/list/import validate structure and integrity.

## UI and display scope

Launcher → Main → Workbench implements progressive disclosure. Main has Route/Network/Environment/History tabs. Current Capture strictly lists current-scope captures; the recent meaningful anchor is display-only and never changes selection or export target. Stable structural DOM and keyed rows allow updates without repeatedly detaching active controls. Main/Workbench store independent scale preferences; launcher/edge restore do not scale. Tampermonkey business menus remain zero.

## Export, comparison and privacy

Evidence bundles contain seven local files with schema and SHA-256 checks. Export redacts/maps identifiers and coarsens some environment details; history export uses the restored view snapshot and safe related context. Import validates locally, executes nothing and does not write imported captures into history. A/B comparison preserves missing/unknown/not-comparable rather than treating them as equal.

Prompt/answer bodies and authentication values are not persisted as evidence. Transient protocol parsing still occurs. Local storage and exported metadata are not absolutely anonymous or encrypted; users must review before sharing. See [privacy audit](PUBLIC_REPO_PRIVACY_AUDIT.md) and [license/source audit](LICENSE_AUDIT.md).
