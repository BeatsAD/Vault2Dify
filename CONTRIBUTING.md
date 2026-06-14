# Contributing

Thanks for helping improve `Vault2Dify`.

## Development Setup

```bash
npm install
npm test
npm run typecheck
npm run build
```

The plugin entry point is `main.ts`. The built Obsidian plugin file is `main.js`.

## Local Testing

1. Build the plugin.
2. Copy `main.js`, `manifest.json`, and `styles.css` into:

   ```text
   .obsidian/plugins/vault-to-dify/
   ```

3. Enable the plugin in Obsidian.
4. Test with a reachable Dify knowledge base API, such as NAS/Docker, local Docker, LAN server, public reverse proxy, or Dify Cloud.

## Pull Request Guidelines

- Keep changes focused.
- Update documentation when behavior changes.
- Run `npm test`, `npm run typecheck`, and `npm run build` before opening a pull request.
- Do not include API keys, Obsidian vault data, or private/internal Dify URLs in commits.
- Do not commit `node_modules`.
- Do not commit personal Obsidian plugin data files.

## Useful Areas to Improve

- Better sync result details.
- More actionable connection diagnostics.
- Unit tests for URL normalization, folder matching, mapping parsing, and sync planning.
- Gradual extraction from `main.ts` into smaller modules.
