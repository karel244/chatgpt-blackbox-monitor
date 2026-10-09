# Public release checklist

Local packaging and automated Node checks are complete. Repository creation and URL setup are confirmed below; other unchecked publication actions remain unverified.

- [x] Public source-provenance blocker removed; public tests/build and privacy scan PASS.
- [ ] User confirms live performance acceptable.
- [x] User chooses License and confirms rights to project contributions.
- [x] Add LICENSE with correct copyright holder and retain applicable notices.
- [x] Create public repo: [https://github.com/karel244/chatgpt-blackbox-monitor](https://github.com/karel244/chatgpt-blackbox-monitor).
- [x] Push clean repository.
- [x] Verify README screenshot rendering and relative links.
- [x] Fill Repository URL: https://github.com/karel244/chatgpt-blackbox-monitor
- [x] Fill Raw install URL: https://raw.githubusercontent.com/karel244/chatgpt-blackbox-monitor/main/dist/chatgpt-blackbox-monitor.user.js
- [x] Fill Issues URL: https://github.com/karel244/chatgpt-blackbox-monitor/issues
- [x] Record Releases page URL: https://github.com/karel244/chatgpt-blackbox-monitor/releases (v1.1.0 Release confirmed).
- [ ] Configure private security reporting channel.
- [x] Add confirmed userscript @homepageURL and @supportURL.
- [ ] Validate automatic updates before adding @updateURL / @downloadURL; both remain absent.
- [x] Rebuild and rerun checks after homepage/support metadata changes: format / lint / typecheck / unit (141/141) / integration (55/55) / production build / synthetic build PASS; version remains 1.1.0.
- [x] Create tag v1.1.0.
- [x] Create GitHub Release v1.1.0.
- [x] Attach production .user.js.
- [x] Verify final SHA-256: Tag blob, Release Notes declaration, replaced Release Asset, remote re-download and W local dist all match b551a2a578666b72aff678adb6f77d6698a14640f6ad47a20930066ead77592c.
- [ ] Fresh-browser install/update smoke.

Do not publish synthetic scripts, diagnostic artifacts, test-results, node_modules, browser profiles or credentials. Project-license selection was not supplied by the packaging agent; actual repository URLs are now recorded above.

**Public source-provenance audit: PASS.** The uncertain monitor test file is omitted from v2 distribution; see [LICENSE_AUDIT](LICENSE_AUDIT.md). MIT License selection and LICENSE addition are confirmed; repository URLs are confirmed above.
