# Security and Privacy

This plugin is designed for users who want to sync Obsidian Markdown notes to an accessible Dify knowledge base API, including NAS/Docker, local Docker, LAN server, public reverse proxy, and Dify Cloud scenarios.

## What the Plugin Reads

- Markdown files (`.md`) in the current Obsidian vault.
- Plugin settings stored by Obsidian.
- Local sync records created by this plugin.

The plugin does not process images, PDFs, attachments, or non-Markdown files.

Only Markdown files that match enabled path mappings are eligible for sync. A path mapping can target a folder, a single Markdown note, or the entire vault.

## What the Plugin Sends

The plugin sends Markdown content only to the Dify API URL configured by the user.

It uses these Dify API paths:

- `GET /v1/datasets`
- `GET /v1/datasets/{dataset_id}/documents`
- `POST /v1/datasets/{dataset_id}/document/create-by-text`
- `POST /v1/datasets/{dataset_id}/documents/{document_id}/update-by-text`
- Optional: `GET /v1/datasets/{dataset_id}/documents/{batch}/indexing-status`

The plugin does not send note content to the plugin author or to any service other than the configured Dify endpoint.

## API Key Storage

The Dify API key is stored in Obsidian plugin data on the user's device. Treat that local data as sensitive.

Recommendations:

- Do not commit your Obsidian `.obsidian` folder to a public repository.
- Do not share plugin data files that contain your Dify API key.
- Use a Dify API key with the minimum permissions needed for knowledge base sync.
- Rotate the API key if it may have been exposed.

## Remote Deletion Policy

The plugin does not automatically delete Dify remote documents when local notes are deleted. Local deletions are recorded in plugin sync state, but Dify documents remain available until the user deletes them manually in Dify.

Deleting a path mapping only removes the local mapping configuration. It does not delete Obsidian files and does not delete Dify remote documents.

This is intentional and reduces the chance of accidental data loss.

## Release Privacy Boundary

Release packages should contain only:

- `main.js`
- `manifest.json`
- `styles.css`

Release packages must not contain:

- `node_modules`
- Dify API keys
- local Obsidian vault data
- plugin data files or local sync records

## Reporting Security Issues

If you find a security issue, please do not post sensitive details in a public issue. Open a GitHub security advisory if available, or contact the repository maintainer through the private channel listed on the repository.
