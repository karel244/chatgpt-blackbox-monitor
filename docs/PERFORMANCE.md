# Performance

The earlier release candidate caused conspicuous page jank. PERF-B was repeated History processing: every one-second flush re-snapshotted and redacted unchanged captures, queued them and performed GM reads/writes. Revision/persisted-revision tracking now skips unchanged work before snapshot/redaction/storage. Duplicate final manifest writes were removed; cleanup reads valid metadata efficiently while preserving retention and conservative corruption behavior. Timer frequencies and evidence rules were not relaxed.

The same 90-second synthetic 80×48 workload was measured before/after in Chrome/Edge + official Tampermonkey 5.5.0. These are recorded product-baseline results, not measurements rerun during version packaging.

| Chrome launcher metric | Before | After | Change |
|---|---:|---:|---:|
| Renderer TaskDuration | 9053 ms | 2193 ms | −75.78% |
| Long tasks | 90 | 0 | 90 fewer |
| GM_set calls | 9080 | 593 | −93.47% |
| Serialized write rate | 10.94 MB/min | 1.93 MB/min | −82.36% |

Chrome Main: 2666 ms, zero long tasks. Workbench: 3204 ms, zero long tasks. Pause: 928 ms with one 69 ms control-persistence task. Edge improvement was directionally consistent: launcher 2573 ms, TaskDuration −72.15%, one approximately 56 ms long task; Pause retained one approximately 67 ms task.

TaskDuration is renderer task time, not CPU percentage. Write rate is the collector's UTF-8 JSON serialization estimate, not physical disk writes. Nested function totals cannot be added. No FPS improvement or zero-overhead claim is made. Unchanged idle captures avoid repeated persistence, while legitimate events/control changes still incur work.

Real-user live smoke: preliminary positive feedback after performance-fixed RC.

User experience remains the final check for an authenticated page. Synthetic passing results cannot guarantee all page workloads or future protocol revisions.
