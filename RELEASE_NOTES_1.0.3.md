# Vault2Dify 1.0.3

## Added

No user-facing features in this release.

## Fixed

- Restored the settings page in older Obsidian runtimes that still call the legacy `display()` settings API.
- Fixed the language menu so switching between Chinese and English immediately refreshes the settings UI.
- Kept destructive confirmation buttons compatible with both newer `setDestructive()` and older Obsidian button APIs.

## Obsidian Review

- Raised the declared minimum Obsidian app version to match the reviewed API surface.
- Added an Obsidian lint gate for Marketplace/API compatibility checks.
- Addressed unsupported API findings tied to `Notice.messageEl` and `ButtonComponent.setDisabled()`.
- Migrated settings refresh behavior toward `getSettingDefinitions()` while keeping a legacy runtime fallback.
- Replaced direct `setWarning()` usage with a compatibility helper that prefers `setDestructive()`.

## Validation

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run install:test-vault`
- Manifest/tag version check in the GitHub Release workflow.
- Artifact attestations for `main.js` and `styles.css` in the GitHub Release workflow.
