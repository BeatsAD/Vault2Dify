# Vault2Dify

English | [中文](README_ZH.md)

Sync selected Obsidian Markdown notes to one or more Dify Knowledge Bases.

Vault2Dify is a desktop-only Obsidian plugin for users who keep notes in Obsidian and use Dify for personal or team knowledge-base Q&A. It syncs only the Markdown notes that match your enabled path mappings to the Dify service URL you configure.

The plugin UI defaults to English. You can switch to Chinese from the language icon in the settings top bar.

## Features

- Map an Obsidian folder, one Markdown note, or the entire vault to one or more Dify Knowledge Bases.
- Load available knowledge bases by testing your Dify API key with `GET /v1/datasets`.
- Sync manually from the ribbon, command palette, or settings page.
- Optionally sync on Markdown create, modify, and rename events, with a periodic full-check fallback.
- Use one Dify service URL for local Docker, NAS/Docker, LAN, Tailscale, reverse proxy, or Dify Cloud deployments.
- Store sync records by knowledge base and Obsidian file path so same-name files in different folders remain distinct.
- Keep deletion conservative: local note deletion and mapping deletion do not automatically delete remote Dify documents.
- Support English and Chinese settings, notices, commands, and status messages.

## Quick Start

Build the plugin:

```bash
npm install
npm run build
```

Copy the release files into your vault:

```text
.obsidian/plugins/vault-to-dify/
├── main.js
├── manifest.json
└── styles.css
```

Enable `Vault2Dify` from `Settings -> Community plugins -> Installed plugins`, then open `Settings -> Vault2Dify`.

First-time setup:

1. Enter your Dify Knowledge Base API key.
2. Enter the Dify service URL reachable from the device running Obsidian.
3. Test the connection to load knowledge bases.
4. Add a path mapping.
5. Run a manual sync or enable auto sync.

New installs do not upload notes until you configure a mapping and start sync.

More details:

- [Installation guide](INSTALLATION.md)
- [User guide](USER_GUIDE.md)
- [Connection troubleshooting](docs/CONNECTION_TROUBLESHOOTING.md)

## Dify Service URL Examples

Use the service root that Obsidian can reach. The plugin appends Dify API paths such as `/v1/datasets` automatically.

| Deployment | Example |
| --- | --- |
| Local Docker on the same computer | `http://localhost:5000` |
| NAS/Docker or LAN server | `http://dify-host.example.test:5000` |
| NAS through Tailscale | `http://tailnet-device.example.test:5000` |
| Reverse proxy or Dify Cloud | `https://dify.example.com` |

Do not use `localhost` unless Dify and Obsidian run on the same computer.

## Privacy and Network Use

- The plugin reads Markdown files in the current Obsidian vault.
- Only Markdown files matching enabled path mappings are sent to your configured Dify service URL.
- The Dify API key is stored in local Obsidian plugin data.
- The plugin does not send notes to the plugin author or to any service other than your configured Dify endpoint.
- Local note deletion does not automatically delete Dify remote documents.
- Deleting a path mapping removes local plugin configuration only.

See [SECURITY.md](SECURITY.md) for details.

## Platform Support

This release is desktop-only. Mobile support is not enabled until it has been tested separately.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Release Files

Attach only these files to a release:

```text
main.js
manifest.json
styles.css
```

Do not include `node_modules`, API keys, local Obsidian vault data, plugin data files, sync records, prototypes, or local archives.

## License

MIT License
