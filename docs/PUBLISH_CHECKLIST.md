# Publish checklist — @stellar-sharpy/sdk 0.3.0

No `npm publish` is run by automation; this is a dry-run proof only.

1. `npm test` — vitest unit suite green (offline, no network).
2. `npm run examples:typecheck` — `tsc --noEmit` over `examples/*.ts` green.
3. `npm run build` — tsup ESM + CJS + DTS green (`dist/`).
4. `npm pack --dry-run` — verifies `files` includes `dist/README/LICENSE/CHANGELOG`.
5. Bump `SDK_VERSION` in `src/buildinfo.ts` + `package.json` + CHANGELOG for release.
6. `npm publish --dry-run` output saved for review (do NOT publish from scripts).

Build proof (2026-09-10):
- `npm test`: 100+ tests green (see CI / PR bodies).
- `npm run build`: tsup ESM + CJS + DTS green.
