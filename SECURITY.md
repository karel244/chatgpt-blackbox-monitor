# Security and privacy reports

Version 1.1.0 is the current packaged version. There is no formal support or response-time commitment yet.

Do not put cookies, Authorization headers, access/session tokens, raw HAR, account identifiers, or real prompt/answer text in public issues. Use a minimal synthetic reproduction and a screenshot cropped to this tool. Manually inspect every Evidence ZIP before sharing; redaction does not guarantee anonymity.

For potentially sensitive security reports, do not post secrets publicly. A private contact channel will be added after repository setup. No private email or reporting URL has been configured.

The tool has no telemetry or automatic upload path. Requests/responses are transiently parsed for allowlisted evidence; local history and preferences use Tampermonkey storage, which is not an encrypted vault. Browser/extension synchronization settings have separate privacy implications.

If an export may expose sensitive material, stop sharing it and preserve only a local copy for investigation. See [privacy audit](docs/PUBLIC_REPO_PRIVACY_AUDIT.md).
