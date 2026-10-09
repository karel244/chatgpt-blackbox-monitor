# Repository setup proposal

These are suggestions only; no repository, push, tag or Release has been created.

| Setting | Recommendation |
|---|---|
| Name | chatgpt-blackbox-monitor |
| Visibility | Public, after publisher resolves release prerequisites |
| Description | Tampermonkey userscript for browser-visible ChatGPT route, network, environment and local history evidence. |
| Default branch | main |
| Issues | Enabled; use the sanitized bug form |
| Discussions | Optional; off initially |
| Wiki | Off initially |
| Projects | Off unless needed |
| Release/tag | v1.1.0 |
| Topics | chatgpt, tampermonkey, userscript, debugging, network-monitoring, developer-tools |

Use this ZIP's root contents as the repository root; preserve source, lockfile, production dist and synthetic screenshots. Do not add internal evidence, profiles or dependencies. Do not initialize a second README or select a license automatically when creating the repository.

**LICENSE DECISION REQUIRED BEFORE PUBLIC RELEASE.** The publisher must choose and add LICENSE; recommendation and source obligations are in [license audit](LICENSE_AUDIT.md). **REPOSITORY URL REQUIRED** before online install/support/update links can be finalized. Confirm live performance, execute the [release checklist](GITHUB_RELEASE_CHECKLIST.md), and verify README image/link rendering.

**Public source-provenance audit: PASS.** The uncertain monitor test file is omitted from v2 distribution; see [LICENSE_AUDIT](LICENSE_AUDIT.md). License selection and repository URLs remain pending.
