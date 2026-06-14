# Installation Guide

English | [中文](INSTALLATION_ZH.md)

This guide explains how to build, install, and first configure `Vault2Dify`.

Related docs:

- [User guide](USER_GUIDE.md)
- [Connection troubleshooting](docs/CONNECTION_TROUBLESHOOTING.md)

## Prerequisites

- Obsidian desktop app.
- A reachable Dify Knowledge Base API.
- A Dify Knowledge Base API key with permission to list knowledge bases and create or update documents.
- At least one Dify Knowledge Base.
- Node.js and npm if you build from source.

## Build

Run these commands in the plugin source directory:

```bash
npm install
npm run build
```

The build creates `main.js` in the project root.

## Manual Install

Create this folder inside your Obsidian vault:

```text
.obsidian/plugins/vault-to-dify/
```

Copy only these files into it:

```text
main.js
manifest.json
styles.css
```

Then restart Obsidian if needed and enable `Vault2Dify` from `Settings -> Community plugins -> Installed plugins`.

## First-Time Configuration

Open `Settings -> Vault2Dify` and complete the setup flow:

1. Enter your Dify Knowledge Base API key.
2. Enter the Dify service URL reachable from the device running Obsidian.
3. Click `Test connection` to verify the key, URL, permissions, and Dify API response.
4. Add a mapping from an Obsidian folder, Markdown note, or the entire vault to one or more Dify Knowledge Bases.

If knowledge bases change later in Dify, refresh the list from the mapping area.

## Dify Service URL

Enter the service root that the Obsidian device can reach. The plugin appends Dify API paths such as `/v1/datasets` automatically.

| Scenario | Use |
| --- | --- |
| Local Docker on the same computer | `http://localhost:5000` |
| NAS/Docker or LAN server | `http://dify-host.example.test:5000` |
| NAS through Tailscale | `http://tailnet-device.example.test:5000` |
| Cloud server with public port | `http://public-ip:2280` |
| Reverse proxy or Dify Cloud | `https://dify.example.com` |

Rules:

- Do not use `localhost` unless Dify and Obsidian run on the same computer.
- Do not use container-only hostnames such as `api:5001`.
- If you omit `http://` or `https://`, the plugin tries `http://`.
- If you paste a URL ending in `/v1` or `/v1/datasets`, the plugin normalizes it to the service root.

Example:

```text
Configured URL: http://dify-host.example.test:5000
Knowledge-base request: http://dify-host.example.test:5000/v1/datasets
```

## Troubleshooting

Use [docs/CONNECTION_TROUBLESHOOTING.md](docs/CONNECTION_TROUBLESHOOTING.md) for the full connection matrix.

Quick checks:

- Confirm Dify is running and reachable from the Obsidian device.
- Confirm the API key belongs to the same Dify instance and has knowledge-base permissions.
- Confirm the configured URL points to Dify, not to a NAS/admin web page.
- Confirm a reverse proxy forwards `/v1/datasets`.
- If files do not sync, confirm they are `.md` files and match an enabled mapping with at least one selected knowledge base.

## Release Package

GitHub releases should attach only the user-installable plugin files:

```text
main.js
manifest.json
styles.css
```

Do not include:

- `node_modules`
- API keys
- local Obsidian vault data
- plugin data files
- sync records
- prototype files
- local archives or private review notes
