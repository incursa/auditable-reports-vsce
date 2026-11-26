# Repository instructions

1. Keep Report Markdown as a text-first format. Do not make a custom editor the default source editor.
2. Compile every preview through the bundled canonical compiler and `artifact.json`; never render directives directly.
3. Treat the live webview as editing feedback, not the authoritative Paged.js or PDF result.
4. Keep webview resources local, preserve the restrictive Content Security Policy, and require Workspace Trust before starting Python.
5. Run `npm run compiler:verify` after any runtime/compiler change.
6. Run `npm run test:all` after changing preview behavior, the compiler boundary, or fixtures.
7. Run `npm run brand:verify` after changing product assets or README screenshots.
8. Preserve the synthetic feature-tour fixture as the preview baseline until it is intentionally replaced.
9. Do not add customer data, credentials, signed URLs, or proprietary report content.
10. Record architectural changes in `docs/ARCHITECTURE.md` and user-visible changes in `CHANGELOG.md`.
11. Keep durable documentation free of branch, commit, deployment, point-in-time validation, test-count, package-count, and unfinished-work status. Put release history in `CHANGELOG.md` and reproducible proof in maintained validation artifacts.
