# Contributing

The project license is pending the publisher's decision. Do not assume a license has been granted. Discuss substantial changes in an issue before sending a PR; avoid evidence-schema or monitoring-semantic changes bundled with UI fixes.

Use Node.js 22 or newer and npm. Install exact development dependencies with `npm ci`. Users installing the script do not need Node.

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npm run build:synthetic
# Or run all seven checks, stopping at the first failure:
npm run verify
```

Current public suite: **141 unit tests and 55 integration tests**, all passing. The private release-validation suite was larger than the public repository test set; one 14-test file with unresolved helper provenance is intentionally not distributed. Do not restore it without resolving provenance.

`npm run format` applies the locked Prettier. Production output is `dist/chatgpt-blackbox-monitor.user.js`; synthetic output and logs are ignored under `test-results/`. Only the production script is a release asset.

Browser regression requires installed Chrome/Edge and a valid official Tampermonkey 5.5.0 unpacked copy outside any live profile. Set `BLACKBOX_CHROME_PATH`, `BLACKBOX_EDGE_PATH`, and `BLACKBOX_EXTENSION_PATH` to your local assets, then run:

```sh
npm run build:synthetic
npm run test:browser -- 1 --only-chrome
npm run test:browser -- 1 --only-edge
npm run test:browser -- 1 --only-chrome --github-ux
npm run test:browser -- 1 --only-edge --github-ux
```

Use `--dom-diagnostic --after` and `--unknown-diagnostic --after` with the same per-browser invocation for stability diagnostics. Test helpers and the harness are retained for regression; local profiles/results are not public evidence. `BLACKBOX_HARNESS_SCRATCH`, `BLACKBOX_RESULTS_DIR` and `BLACKBOX_SYNTHETIC_FILE` may relocate temporary outputs. Do not use your logged-in profile. The harness serves synthetic fixtures only on loopback port 43997.

Fixtures must contain synthetic canaries, never real credentials, account data or chat text. Do not commit screenshots of authenticated conversations, HAR, profiles, diagnostic artifacts or test-results. Explain scope, behavior and validation in PRs. The reviewed source inventory at `tests/fixtures/public-source-hashes.json` intentionally freezes all production files: update it only after an intentional source change has been reviewed, never merely to silence a failure.
