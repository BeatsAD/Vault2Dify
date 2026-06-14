# Changelog

All notable changes to this project will be documented in this file.

## 1.0.0 - 2026-06-08

### Added

- Chinese-first Obsidian settings, notices, status bar, and commands.
- Dify API connection configuration for primary, LAN, and public URLs.
- Endpoint strategy selection with automatic fallback.
- Connection testing and knowledge base refresh through `GET /v1/datasets`.
- Folder-to-knowledge-base mappings.
- One folder to multiple Dify knowledge bases.
- Multiple folders to one Dify knowledge base.
- Event-based sync for Markdown file create, modify, and rename events.
- Startup sync and periodic full-scan fallback.
- Request timeout, retry, concurrency, sync queue, and sync lock handling.
- Dify document path compatibility for `create-by-text` / `update-by-text` and `create_by_text` / `update_by_text`.
- Sync records keyed by `knowledge base ID + file path`.
- Remote document naming based on Obsidian file path to avoid same-name conflicts.
- Local deletion recording without automatic remote deletion.
- Optional Dify indexing status checks.
- Debug logging and sync record reset tools.
- Friendlier connection diagnostics for common Dify API, permission, timeout, and network errors.
- Settings diagnostics for active Dify endpoint and recent sync details.
- Test foundation for sync utilities such as URL normalization, folder matching, ID parsing, numeric clamping, and sync record keys.
- Gradual source split for shared types, Dify API client, sync record helpers, and path/parsing utilities.
- Progressive settings experience with a first-run path: fill the Dify API Key, test the connection, refresh knowledge bases, then add a folder mapping.
- Connection health overview for current availability, active Dify address, last successful address, recent sync status, and clearer failure feedback.
- Card-based folder mappings with enable/disable state, knowledge base tags, edit controls, and delete confirmation that explains local and remote deletion boundaries.
- Mapping modal flow for selecting an Obsidian folder, choosing one or more Dify knowledge bases, and saving an enabled or disabled mapping.
- Sync diagnostics panel for recent sync source, totals, duration, active address, errors, and recently failed files.
- Short status bar messages such as ready, syncing, and failed, with longer details moved into settings diagnostics.
- Settings review layout with top language/help/GitHub actions and four recent-sync summary metrics.
- Connection action row for clearing config and testing the Dify connection; successful tests refresh and save the knowledge base list.
- API key show/hide control in the connection section.
- Table-based path mappings with index, Obsidian path, knowledge base tags, status switch, and icon-only edit/delete controls.
- Tested settings summary view-model for recent sync metrics and connection tones.

### Changed

- Renamed the release identity to Vault2Dify, including plugin metadata, package metadata, GitHub links, installation paths, and settings/help copy.
- Updated release metadata in `package.json`, `package-lock.json`, `manifest.json`, and `versions.json` to `1.0.0`.
- Updated README, Chinese user guide, installation notes, and release checklist for the settings review experience.
- Reconciled current documentation with the latest shipped plugin UI, including path mappings, fixed sync-setting choices, and hidden compatibility fields.

### Validation

- Added release checklist coverage for version consistency, setup flow, Dify connection checks, folder mappings, sync behavior, local deletion policy, release assets, and privacy boundaries.

### Documentation

- Added Chinese user guide.
- Added public release readiness plan.
- Added security and privacy documentation.
- Updated installation guide for multi-knowledge-base mappings.
