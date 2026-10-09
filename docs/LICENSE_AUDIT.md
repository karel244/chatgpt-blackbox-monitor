# License and source audit

> Historical packaging audit: the findings below describe that audit stage. The project now has an [MIT License](../LICENSE), [public repository](https://github.com/karel244/chatgpt-blackbox-monitor) and published [v1.1.0 Release](https://github.com/karel244/chatgpt-blackbox-monitor/releases/tag/v1.1.0). Original audit findings are retained.

**LICENSE DECISION REQUIRED. Recommended: MIT**, subject to the publisher confirming authorship/rights and choosing the license. A permissive license is suitable for this small independently developed userscript; [MIT terms](https://opensource.org/license/mit) require retaining copyright/permission notices when redistributing covered code. This is a recommendation, not an adopted license or a legal clearance. No project LICENSE or package license field has been created.

## Scope and result

**License/source provenance audit: PASS for v2 public distribution.** Re-ran the 64-token exact lexical-window scan against the same three fixed reference commits. It inspected all 93 public production/test/script/bundle files and 93 reference code files, excluding comments while preserving quoted content and original identifiers/literals. There are **0 matched windows / 0 unresolved overlaps** in the remaining public payload. No identified substantial reference-code matches were found in production.

The original four adjacent windows were reproduced before pruning, at the recorded file/token positions. The entire affected `tests/integration/monitor.test.ts` was then omitted from public staging, rather than rewritten. Internal copies and the original input ZIP remain intact. No production bytes, test helpers or remaining test assertions were changed. The public unit suite passes 141/141; integration passes 55/55 after omitting 14 tests. The older private release-validation suite was larger and is not relabeled as the current public result.

Documentation and screenshot content remain the curated, synthetic assets reviewed during packaging. Locked dependencies and their recorded license/notice facts are unchanged. Project licensing and contribution-rights confirmation remain publisher prerequisites. This is a bounded technical provenance audit, not legal advice.

| Component | Source / origin | License / terms | Copied code? | Action |
|---|---|---|---|---|
| Runtime src and bundled dist | Frozen performance-fixed product baseline; independently developed local modules | Project license pending | No identified reference runtime blocks | Publisher chooses license and confirms ownership/contribution rights |
| Public tests/scripts | Reviewed baseline suite with the uncertain monitor test file omitted | Project license pending | 0 matching windows in remaining public files | Keep the omitted file internal; preserve independent provenance for future contributions |
| Node dev dependencies | Exact npm lockfile packages; package manifests and notices inspected | MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Python-2.0 | Installed for development, not vendored in ZIP or bundled as runtime imports | Preserve upstream notices if redistributing their code; inventory below |
| Route Inspector reference | Fixed commit linked below | No LICENSE, package license or README reuse grant found | Affected test file excluded; 0 remaining public matches | Reference only; do not infer permission from public availability |
| Route Checker reference | Fixed commit linked below | MIT, copyright 2026 Yat-mo | Interaction concepts only; no matched runtime blocks | Any future substantive code reuse must retain MIT notices |
| Specimen reference | Fixed commit linked below | MIT, copyright 2026 传康KK-CKNB | Observation concepts only; no matched runtime blocks | Any future substantive code reuse must retain MIT notices |
| Documentation | Baseline product facts, newly written summaries; links to official sources | Project license pending; external references retain their own terms | No reproduced reference article/license text | Link references; no third-party permission implied |
| Three PNG screenshots | Baseline synthetic regression page, locally rendered tool UI | Publisher-created screenshot content; project license pending | No third-party illustration/logo/font file | Clearly label synthetic; no account/chat/real identifier content |
| Generated artwork | None | Not applicable | None | No generated/vendor artwork shipped |

## Reference provenance

- [Route Inspector, commit 05d8d5ab0a263690651a5982ab6cc43aebbd2615](https://github.com/Liu-Bot24/chatgpt-route-inspector/tree/05d8d5ab0a263690651a5982ab6cc43aebbd2615): protocol association/lifecycle study, not a base/fork. No license grant found; public availability does not establish reuse permission.
- [Route Checker MIT license, commit 36353780355138481ef24caac1c0aa9364084593](https://github.com/Yat-mo/chatgpt-route-checker/blob/36353780355138481ef24caac1c0aa9364084593/LICENSE): capsule/settling interaction reference.
- [Specimen MIT license, commit 95117435a8a15754b7145ff47cfafbb9bdd3796e](https://github.com/1837620622/chatgpt-specimen-toolbox/blob/95117435a8a15754b7145ff47cfafbb9bdd3796e/LICENSE): environment/PoW/reload observation reference.

## Removal and fixed-commit verification

Before removal, four adjacent exact 64-token windows occurred in `tests/integration/monitor.test.ts`, against Inspector's `tests/integration/page-hook-audit.test.ts` (public token positions 220–223; reference positions 847–850). The SSE/WS helpers are not copied into this report or reimplemented under different names. The entire test file is **absent from public v2**. Its 14 tests, the original helpers and prior audit evidence remain in the internal complete project. This removes the uncertain material from distribution without asserting anything new about its authorship or licensing. No test helper was changed to conceal the finding.

After removal, the same window length/tokenization reproduces **zero matches** across remaining public src/tests/scripts and production dist. The scan does not rename variables, normalize literals or attempt a cosmetic evasion. Absence of an exact match is not proof of copyright clearance; scope is the declared technical scan plus source/asset review.

Fixed reference trees were rechecked, not current main: Inspector has no LICENSE/COPYING file, no package.json license field, and no README code-reuse grant. Its README's non-affiliation statement is not a license. Checker and Specimen contain the MIT license files/copyrights linked above, with README links to them. No later license is retroactively assumed for an older commit. No reference source or asset is added to this archive.

The built userscript's imports resolve to local source only. CRC32/ZIP structures use conventional format algorithms; no third-party ZIP library or artwork is shipped. There are no runtime npm dependencies. Development dependencies are installed by users from npm, not included in this repository archive.

## Direct development dependencies

| Package | Locked version | Declared license |
|---|---|---|
| @eslint/js | 9.29.0 | MIT |
| @playwright/test | 1.62.1 | Apache-2.0 |
| @types/node | 22.15.32 | MIT |
| @types/ws | 8.18.1 | MIT |
| esbuild | 0.28.2 | MIT |
| eslint | 9.29.0 | MIT |
| prettier | 3.9.9 | MIT |
| tsx | 4.20.5 | MIT |
| typescript | 5.8.3 | Apache-2.0 |
| typescript-eslint | 8.34.1 | MIT |
| ws | 8.18.3 | MIT |

All 188 non-root lockfile entries declare licenses: 154 MIT, 17 Apache-2.0, 9 ISC, 6 BSD-2-Clause, 1 BSD-3-Clause and 1 Python-2.0. All 136 packages installed on this platform matched their lockfile license declarations; other entries are platform-optional packages. Direct dependency license/notice files were read. `argparse` carries its Python/PSF historical license file; do not discard it if redistributing that dependency. No GPL/AGPL/LGPL declaration was found in the lockfile. See [complete dependency inventory](DEPENDENCY_LICENSES.json), including exact registry tarball URLs and installed notice filenames.

Dependencies' licenses do not assign a license to this project. Lockfile and package pins are unchanged except root version metadata; no dependency was upgraded during packaging. Final legal suitability and ownership remain the publisher's responsibility; this is a bounded technical provenance audit.
