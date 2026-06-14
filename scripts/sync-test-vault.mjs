import fs from "node:fs";
import path from "node:path";

const files = ["main.js", "styles.css", "manifest.json"];
const pluginId = "vault-to-dify";
const defaultVaultRoots = [path.resolve("..", "obsidian-dify-sync-test-vault")];
const testVaultRoots = process.env.VAULT2DIFY_TEST_VAULT
	? [path.resolve(process.env.VAULT2DIFY_TEST_VAULT)]
	: defaultVaultRoots;

for (const testVaultRoot of testVaultRoots) {
	const obsidianDir = path.join(testVaultRoot, ".obsidian");
	const pluginDir = path.join(obsidianDir, "plugins", pluginId);
	fs.mkdirSync(pluginDir, { recursive: true });

	for (const file of files) {
		fs.copyFileSync(file, path.join(pluginDir, file));
		console.log(`synced ${file} -> ${pluginDir}`);
	}

	const enabledPluginsPath = path.join(obsidianDir, "community-plugins.json");
	let enabledPlugins = [];
	if (fs.existsSync(enabledPluginsPath)) {
		enabledPlugins = JSON.parse(fs.readFileSync(enabledPluginsPath, "utf8"));
	}
	if (!enabledPlugins.includes(pluginId)) {
		enabledPlugins.push(pluginId);
		fs.writeFileSync(enabledPluginsPath, `${JSON.stringify(enabledPlugins, null, "\t")}\n`);
		console.log(`enabled ${pluginId} in ${enabledPluginsPath}`);
	}
}
