# Changelog

## [1.1.0] - 2026-10-08

### Added

- Browser-visible Route, Network, Environment and local History evidence; local Evidence ZIP export/import and A/B comparison.
- Minimal launcher, main control panel and advanced non-modal workbench; Chinese and English UI.
- Public installation guide, synthetic screenshots, issue form, security guidance and release preparation documents.

### Changed

- Main defaults to Route; Main and Workbench have independent proportional scaling.
- First-use guidance, localized Unknown, clearer clear-data confirmations and recent-summary/export scope explanation.
- Package, userscript and exported tool version aligned to 1.1.0; evidence schemas unchanged.

### Fixed

- Unknown display drift using a recent meaningful display anchor while keeping Current Capture scope strict.
- Repeated persistence of unchanged History captures through revision tracking; redundant final manifest writes removed and cleanup scan streamlined.

### Known limitations

- Browser-visible facts do not prove server-internal execution. Missing or partial evidence remains explicit.
- Authenticated workflows are not comprehensively validated; native BFCache restore is not validated in the automated harness.
- Local storage has multiple budgets. See [limitations](docs/KNOWN_LIMITATIONS.md) and [performance](docs/PERFORMANCE.md).
