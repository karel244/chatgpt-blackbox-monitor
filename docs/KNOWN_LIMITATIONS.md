# Known limitations

- Browser-visible evidence is not server-internal proof: no verification of model weights, GPU/worker, hidden tokens/reasoning budget, scheduling or account treatment. IP, PoW, speed and frontend build cannot establish these claims.
- Unknown means insufficient observed facts. Partial may indicate capture, association, recovery or declared redaction gaps. Conflict preserves contradictory declarations instead of selecting a winner.
- Supported synthetic capture/UI/storage scenarios were exercised on Chrome/Edge with official Tampermonkey 5.5.0. Authenticated Chat/Work and every evolving private server protocol are **not validated**.
- Native BFCache restore is **Not validated / Harness unavailable** in Playwright. Synthetic persisted lifecycle and actual back/forward reinjection/visit isolation are separate passing behaviors.
- History is bounded by 200 conversation rounds, 30 days, 50 MiB and per-capture/queue limits. Auxiliary context shares byte/time budgets. Older rounds may be removed before the count reaches 200. Current Capture is deliberately current-scope; History handles persisted older captures.
- Cleanup conservatively skips malformed/unknown-schema records and marks partial; it does not repair/delete corruption. Invalid skipped storage is outside valid retention candidates, so 50 MiB is not a hard guarantee for damaged or hostile GM storage.
- History views use a restored snapshot; leave and re-enter to refresh newly stored captures. Export/import can fail safely when structures, digests or budgets are invalid.
- Performance improved for the frozen workload, not every future page. UI refresh and bounded persistence/compaction still cost time. Edge retained a 56 ms long task; Pause transitions retained individual control-write long tasks. See [performance](PERFORMANCE.md).
- Redaction does not guarantee anonymity. Time, model, route, network and environment clues remain. Tampermonkey storage is not an encrypted vault, and extension/browser sync is outside this tool's guarantee.
- Manual update is the supported initial release workflow; automatic updates remain unvalidated and a private security contact is pending setup. The [public repository](https://github.com/karel244/chatgpt-blackbox-monitor) and [MIT License](../LICENSE) are established.

Real-user live smoke: preliminary positive feedback after performance-fixed RC.
