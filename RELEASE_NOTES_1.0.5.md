# Vault2Dify 1.0.5

## Added

No user-facing features in this release.

## Fixed

- Restored Marketplace installs for Obsidian 1.12.7 public stable users.
- Declared `1.0.5` compatible with Obsidian `1.12.7` so the community plugin browser no longer falls back to the unavailable `1.0.0` release.
- Kept previous release compatibility records unchanged to avoid rewriting historical release metadata.

## Obsidian Review

- Updated the release metadata path used by the GitHub Release workflow so future tags load matching release notes.
- Added a release notes existence check before creating GitHub releases.

## Validation

- `npm test`
- `npm run lint:obsidian`
- `npm run typecheck`
- `npm run build`
- `npm run install:test-vault`
- Manifest/tag version check in the GitHub Release workflow.
- Release notes existence check in the GitHub Release workflow.
