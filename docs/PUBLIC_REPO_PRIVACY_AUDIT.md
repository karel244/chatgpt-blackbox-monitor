# Public repository privacy audit

> Historical packaging audit: the findings below describe that audit stage. The project now has an [MIT License](../LICENSE), [public repository](https://github.com/karel244/chatgpt-blackbox-monitor) and published [v1.1.0 Release](https://github.com/karel244/chatgpt-blackbox-monitor/releases/tag/v1.1.0). Original audit findings are retained.

**Privacy scan: PASS.** No actual secret, account identity, authenticated chat body or local absolute environment path was identified in the reviewed public payload. This is a bounded static and visual audit, not a guarantee about future exports or user-supplied evidence.

## Scope and method

Read the public src/tests/scripts/configs/docs/production bundle as UTF-8 and searched for Cookie, Authorization, Bearer, token assignments, key-shaped `sk-` credentials, session/email/phone terms, local user/volume paths and localhost services. Reviewed matching lines by context; checked credential/JWT patterns and email literals separately. All three previously inspected synthetic PNGs were confirmed byte-identical to the input package; no new screenshot content was introduced. ZIP membership and bytes are checked against the staging after packaging.

The initial v2 text scan reviewed 169 matching lines. Counts below are keyword matches, not secret counts; they describe the recorded scan before this report was synchronized. A final rescan checks the finished payload again.

| Category | Matching lines |
|---|---:|
| defensive runtime code / generic source syntax | 47 |
| dependency metadata | 2 |
| documentation / synthetic builder configuration | 23 |
| synthetic fixture / privacy assertion | 97 |

## Findings

- Authentication terms in production are defensive redaction/path filters, not saved credential values. Requests/responses are transiently parsed for allowlisted evidence. No telemetry or automatic upload endpoint was found.
- Synthetic tests deliberately contain `SECRET_*`, `*_CANARY`, fake header/cookie values and sample chat strings to assert rejection/redaction. They are manufactured fixtures, not captured user data. Email literals all use the example.com domain and occur only in tests; no personal mailbox is configured.
- `sk-` also matches ordinary words such as task labels. The credential-length pattern and JWT-shaped pattern found no values. This pattern check alone would not prove absence; the contextual review is part of the result.
- Loopback hosts/ports in browser/transport tests and synthetic-build code are deliberate local fixtures. Production metadata matches only HTTPS ChatGPT sites. Production has no localhost @match; the builder's dead synthetic branch is retained unchanged and does not expose the synthetic hook in the production build.
- Package registry/source URLs belong to pinned development dependencies or explicitly identified reference projects, not a monitoring service. No fake project owner/repository/update/support URL was added.
- No absolute user home/drive path or known local account name remains in the payload. Browser paths are supplied by environment variables; no browser profiles, local storage dumps or raw evidence logs are shipped.
- Screenshots contain a blank synthetic test page, a Send conversation button, model/route labels and manufactured short capture IDs. No account, private chat, real token/identifier, unrelated browser chrome or third-party artwork is visible. The 429/Retry-After example is synthetic, not live incident evidence.
- Only the production userscript is included in dist. No perf diagnostic or instrumented synthetic userscript is shipped.

## Publication and export boundary

History/preferences use local Tampermonkey storage; browser/extension synchronization is a separate concern. GM storage is not an encrypted vault. Export redaction does not guarantee anonymity: time, model, route, network and environment clues may remain. Never upload Cookie/Authorization/token, real HAR or prompt/answer content; inspect bundles and crop screenshots before sharing. A private security reporting channel is pending setup.

Public source-provenance audit also PASS after the uncertain monitor test file was omitted; see [license audit](LICENSE_AUDIT.md). Project License selection and repository URL remain pending. No GitHub publication occurred.
