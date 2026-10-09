# GitHub public release packaging report — v2

Date: 2026-10-08. Product version: **1.1.0**. Distribution revision: **public-ready-v2**.

**SOURCE PROVENANCE RELEASE BLOCKER PASS. READY FOR REPOSITORY CREATION: YES.**

| Gate | Result |
|---|---|
| Public repo staging / pruning | PASS |
| Version unified at 1.1.0 | PASS |
| README/docs synchronized | PASS |
| Privacy scan / unchanged synthetic screenshots | PASS |
| License/source provenance audit | PASS — 0 unresolved reference-code overlaps |
| Public tests / builds | PASS |
| Production source/dist byte freeze | PASS |
| Ready for repository creation | YES |

**LICENSE DECISION REQUIRED BEFORE PUBLIC RELEASE. REPOSITORY URL REQUIRED.** MIT remains a recommendation only. No LICENSE or package license field was created. No repository, push, tag or Release was performed. Readiness means local staging is prepared; it does not authorize publishing or replace the remaining [release checklist](GITHUB_RELEASE_CHECKLIST.md).

## Input and precise removal

The sole input for this revision is `chatgpt-blackbox-monitor-v1.1.0-github-public-ready.zip` (SHA-256 `f41f292f0721d7481cbcbf05eb9b929fda4f2e34472ee8831668449fb893261f`). Every one of its 121 files matched the current staging before work began; the original ZIP remains unchanged.

Only `tests/integration/monitor.test.ts` is omitted from the public payload. Its two source-uncertain SSE/WS helpers and 14 tests are not redistributed or rewritten under other names. The complete original internal project, extracted baseline and a private preservation copy still contain the exact original file. No remaining test/helper/assertion or script was edited. Public docs, README and CONTRIBUTING were synchronized with this distribution change.

All 32 `src/**` files and the production dist are byte-identical to the 1.1.0 input ZIP, before and after rebuilding. Package/lock/version metadata, Evidence/storage schemas, Route/Network/History/selection/anchor/scaling/performance behavior and screenshots are unchanged. The builder was executed as required; its output matches the existing production bytes exactly.

## Provenance verification

Before omission, the 64-token exact lexical-window scan reproduced precisely four adjacent matches at public token positions 220–223 and reference positions 847–850, solely in the affected file against Inspector's `tests/integration/page-hook-audit.test.ts`.

After omission: **93 public code files vs 93 fixed reference code files, 0 matched windows, 0 unresolved overlaps**. Scope includes production source, public tests, scripts and the production bundle. Comments are excluded; quoted content, identifiers and literal structure are preserved. No renaming, whitespace trick, string splitting or helper rewrite was used. No identified substantial reference-code matches were found in production. Raw inventories/comparison records stay private outside staging.

Fixed reference commits and license facts are recorded in [LICENSE_AUDIT](LICENSE_AUDIT.md). Inspector's fixed tree has no LICENSE/COPYING, package license field or README reuse grant; Checker and Specimen have MIT license files and README links. Current main was not used to retroactively assume a license. This is a bounded technical provenance audit, not legal advice.

## Public checks rerun

| Check | Result | Measured elapsed |
|---|---|---:|
| format:check | PASS | 2.462 s |
| lint | PASS | 4.920 s |
| typecheck | PASS | 3.178 s |
| test:unit | PASS | 2.080 s |
| test:integration | PASS | 2.453 s |
| build | PASS | 0.437 s |
| build:synthetic | PASS | 0.425 s |

**Unit: 141/141 PASS. Integration: 55/55 PASS.** Zero failures, skips or cancellations. The public integration total decreased by exactly the 14 omitted tests. The prior internal/full input result of 69/69 remains a historical result; it is not the current public count. Child-process wall durations are measured, not estimates. Logs and synthetic output remain outside public staging.

Production is unchanged, so no browser workloads or authenticated live tests were rerun during this membership-only revision. The previously recorded synthetic Chrome/Edge + official Tampermonkey 5.5.0 capture/UI/Unknown/DOM/performance results remain baseline evidence. Native BFCache is still Not validated / Harness unavailable. No new authenticated protocol coverage is claimed.

Real-user live smoke: preliminary positive feedback after performance-fixed RC.

## Privacy and membership

The public content was rescanned for authentication terms, tokens/key/JWT patterns, session/email/phone terms, personal local paths/accounts and loopback services. Matches were reviewed as defensive production code, synthetic fixtures or documentation; no actual credential, account data, real chat body or personal absolute path was identified. Three screenshots match the already-reviewed synthetic assets byte-for-byte. See [privacy audit](PUBLIC_REPO_PRIVACY_AUDIT.md).

No test-results, node_modules, profiles, old failure reports, diagnostic userscripts or internal evidence is included. Production dist contains one file. All remaining source imports and browser provenance paths resolve; local documentation links resolve. The omitted test file is absent from ZIP membership, not merely ignored by a test command.

## Production SHA-256

`dist/chatgpt-blackbox-monitor.user.js`:

```text
704ddc588b8b946ea0114627d0c61db25eea723818ea3608c51a2afa94b4e50f
```

## Size audit

Public v2 payload: **120 files / 1,490,522 bytes**. The input public v1 payload contained 121 files / 1,501,604 bytes.

| Largest files | Bytes |
|---|---:|
| `dist/chatgpt-blackbox-monitor.user.js` | 323,634 |
| `package-lock.json` | 93,945 |
| `tests/browser/p1.mjs` | 64,310 |
| `docs/DEPENDENCY_LICENSES.json` | 58,580 |
| `src/ui/panel.ts` | 43,680 |
| `tests/browser/refactor.mjs` | 34,460 |
| `docs/screenshots/github-route.png` | 34,288 |
| `docs/screenshots/github-network-abnormal.png` | 31,494 |
| `src/history/storage.ts` | 30,824 |
| `src/adapters/monitor.ts` | 29,904 |

The v2 ZIP contains exactly staging-root relative files; all ZIP entries are checked byte-for-byte against staging, with source/dist equality also checked against the input ZIP. ZIP SHA-256 is supplied separately, avoiding a self-referential archive checksum.

Stop state: **SOURCE PROVENANCE RELEASE BLOCKER PASS / Ready for repository creation: YES**. Await publisher's License choice; repository URL and release checklist remain pending. No GitHub actions were performed.
