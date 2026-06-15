# Vault2Dify 1.0.6

## Added

- No user-facing features in this release.

## Fixed

- Fixed the settings page heading layout so the Vault2Dify title, subtitle, and major section titles align naturally with the settings content.
- Tightened the spacing between the Vault2Dify title and subtitle.
- Kept the Directory mapping title aligned with the Add mapping button while preserving consistent title-to-content spacing across Connection, Directory mapping, and Sync settings.

## Obsidian Review

- Kept the fix scoped to the production settings UI and avoided prototype, sync behavior, or mapping logic changes.
- Added regression coverage for heading alignment, subtitle spacing, and section action alignment without relying on transform or manual offset patches.

## Validation

- `git diff --check`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run install:test-vault`
