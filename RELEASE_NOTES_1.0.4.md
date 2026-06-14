# Vault2Dify 1.0.4

## Added

No user-facing features in this release.

## Fixed

- Removed Marketplace-disallowed ESLint rule disable comments from plugin source.
- Removed debug console output so Obsidian Marketplace lint no longer reports `obsidianmd/rule-custom-message`.

## Obsidian Review

- Addressed the `Disabling 'obsidianmd/rule-custom-message' is not allowed` review error.
- Kept the Obsidian lint gate in the local and CI validation path.
- Preserved the existing `minAppVersion` alignment at `1.13.0`.

## Validation

- `npm run lint:obsidian`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run install:test-vault`
- Manifest/tag version check in the GitHub Release workflow.
- Artifact attestations for `main.js` and `styles.css` in the GitHub Release workflow.
