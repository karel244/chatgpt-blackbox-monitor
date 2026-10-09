# Public release checklist

Local packaging and automated Node checks are complete. Publication actions below remain undone.

- [x] Public source-provenance blocker removed; public tests/build and privacy scan PASS.
- [ ] User confirms live performance acceptable.
- [ ] User chooses License and confirms rights to project contributions.
- [ ] Add LICENSE with correct copyright holder and retain applicable notices.
- [ ] Create public repo.
- [ ] Push clean repository.
- [ ] Verify README screenshot rendering and relative links.
- [ ] Fill Repository URL.
- [ ] Fill Raw install URL.
- [ ] Fill Issues URL.
- [ ] Configure private security reporting channel.
- [ ] Optionally add userscript homepage/support/update metadata.
- [ ] Rebuild and rerun checks if metadata changed.
- [ ] Create tag v1.1.0.
- [ ] Create GitHub Release v1.1.0.
- [ ] Attach production .user.js.
- [ ] Verify SHA-256 against the final asset, updating Release Notes if rebuilt.
- [ ] Fresh-browser install/update smoke.

Do not publish synthetic scripts, diagnostic artifacts, test-results, node_modules, browser profiles or credentials. Project-license selection and repository URLs have intentionally not been supplied by the packaging agent.

**Public source-provenance audit: PASS.** The uncertain monitor test file is omitted from v2 distribution; see [LICENSE_AUDIT](LICENSE_AUDIT.md). License selection and repository URLs remain pending.
