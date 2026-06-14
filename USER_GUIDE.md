# Vault2Dify User Guide

English | [中文](USER_GUIDE_ZH.md)

Vault2Dify syncs selected Obsidian Markdown notes to Dify Knowledge Bases. It supports local Docker, NAS/Docker, LAN, Tailscale, reverse proxy, and Dify Cloud deployments as long as the Obsidian device can reach the configured Dify service URL.

The plugin UI defaults to English. You can switch between English and Chinese from the language icon in the settings top bar.

## 1. First-Time Setup

Install the plugin first. See [INSTALLATION.md](INSTALLATION.md) for build and manual installation steps.

Open `Settings -> Vault2Dify` and complete:

```text
Fill Key -> Test connection -> Add mapping -> Sync
```

### Fill Key

Enter:

- `Dify API Key`: a Dify Knowledge Base API key that can list knowledge bases and create or update documents.
- `Dify service URL`: the Dify service root reachable from the device running Obsidian.

Examples:

| Deployment | URL |
| --- | --- |
| Local Docker on the same computer | `http://localhost:5000` |
| NAS/Docker or LAN server | `http://dify-host.example.test:5000` |
| NAS through Tailscale | `http://tailnet-device.example.test:5000` |
| Reverse proxy or Dify Cloud | `https://dify.example.com` |

The plugin appends Dify API paths such as `/v1/datasets` automatically. Do not use `localhost` unless Dify and Obsidian run on the same computer.

### Test Connection

Click `Test connection` to verify the API key, service URL, permissions, and Dify Knowledge Base API response. A successful test loads and saves the current knowledge-base list.

If the test fails, use [docs/CONNECTION_TROUBLESHOOTING.md](docs/CONNECTION_TROUBLESHOOTING.md).

### Add Mapping

After knowledge bases load:

1. Choose an Obsidian folder, one Markdown note, or the entire vault.
2. Select one or more target Dify Knowledge Bases.
3. Save the mapping.

New installs do not upload notes automatically. Run a manual sync or enable auto sync after mappings are ready.

## 2. Path Mapping

A mapping controls which Markdown files can sync and where they go.

| Obsidian path | Dify Knowledge Bases |
| --- | --- |
| `Work/ProjectA` | Project A, Team Shared |
| `Reading` | Personal Reading |
| `Inbox/idea.md` | Ideas |
| Entire vault | Personal Knowledge Base |

Rules:

- One Obsidian path can sync to multiple knowledge bases.
- Multiple Obsidian paths can target the same knowledge base.
- Disabled mappings are ignored.
- Deleting a mapping removes local plugin configuration only.
- Deleting a mapping does not delete Obsidian files or Dify remote documents.

Vault2Dify uses the Obsidian file path as the Dify document name, such as `Work/ProjectA/meeting-notes.md`, so same-name files in different folders remain distinct.

## 3. Sync Behavior

Manual sync can be started from:

- Ribbon sync icon.
- Command palette: `Sync to Dify Knowledge Base`.
- Plugin settings: `Sync now`.

Auto sync can listen for Markdown create, modify, and rename events. The periodic full-check interval acts as a fallback when file events are missed.

Current visible sync presets:

| Setting | Choices |
| --- | --- |
| Change debounce | 8 seconds, 15 seconds, 30 seconds |
| Full check interval | 30 minutes, 60 minutes, Off |
| Concurrent uploads | 2 files, 4 files |

Recommended starting point for NAS/Docker or smaller self-hosted Dify deployments:

```text
Auto sync: On
Sync after startup: On
Full check: Every 30 minutes
Change debounce: 8 or 15 seconds
Concurrent uploads: 2 files
```

Sync rules:

- Only Markdown files matching enabled mappings are eligible.
- Unchanged files are skipped when the stored content hash still matches.
- Existing Dify documents are updated first; new documents are created when no match exists.
- A single failed file does not stop the entire batch.
- Local note deletion is recorded locally and does not automatically delete the remote Dify document.

## 4. Diagnostics

The status bar stays short, such as `Dify: Ready`, `Dify: Syncing`, or `Dify: Failed`.

The settings page shows:

- Connection state.
- Active URL and last successful URL.
- Recent sync source.
- Total, synced, skipped, and failed task counts.
- Recent sync URL and error.
- Recently failed files.

Enable `Debug logs` only while diagnosing connection, proxy, API path, or sync failures. Do not share logs that contain API keys or sensitive note content.

## 5. Privacy and Safety

- The plugin reads Markdown files in the current Obsidian vault.
- Only Markdown files matching enabled path mappings are sent to the configured Dify service URL.
- The Dify API key is stored in local Obsidian plugin data.
- The plugin does not send notes to the plugin author or to any service other than the configured Dify endpoint.
- Local note deletion does not automatically delete Dify remote documents.
- Clearing configuration or sync records affects local plugin data only.

See [SECURITY.md](SECURITY.md) for details.

## 6. FAQ

### Should I paste a Dify URL that ends with `/v1`?

You can. The plugin normalizes known suffixes such as `/v1` and `/v1/datasets`, then appends the Dify API path it needs. The clearest value is still the service root, such as `http://dify-host.example.test:5000`.

### Why does opening `/v1/datasets` in a browser show 401?

That can mean the URL routes to Dify correctly but needs authentication. The plugin sends `Authorization: Bearer <Dify API Key>` when loading knowledge bases.

### Can one note sync to several knowledge bases?

Yes. A mapping can target multiple Dify Knowledge Bases.

### Does deleting a local note delete the Dify document?

No. Local deletion does not automatically delete Dify remote documents. Delete remote documents manually in Dify when needed.

### What should I do when a large sync is slow or times out?

Use smaller mappings, lower concurrent uploads to `2 files`, and check Dify service load, network latency, and reverse proxy limits.
