# Vault2Dify 1.0.9

## Metadata sync

- New **Metadata sync** switch under **Sync settings**, directly below **Auto sync**. It defaults to off, including on upgrade.
- Enable it to sync all top-level YAML properties through your enabled path mappings. Existing same-name custom fields are reused; missing fields are created automatically.
- Text, numbers and ISO dates use the corresponding Dify field types. Booleans become text, and lists/objects become JSON text. Existing field types are preserved; incompatible properties are reported in sync diagnostics.
- Remote-only fields remain intact. Removing or emptying a local property, or disabling the switch, does not clear remote values.
- Enabling or re-enabling backfills metadata on the next sync without uploading unchanged content. Metadata failures preserve the document ID and successful content record for metadata-only retry.

## Sync reliability

- Update and rename operations retain the recorded Dify document ID.
- After an update 404, recreate only when a complete remote document list confirms that the original ID is absent.
- Failed updates retain their association and remain eligible for retry. A recreated document must return a new ID.

## Validation

- Existing tests and 15 new metadata regression groups, TypeScript checks and Obsidian lint passed.
- Verified the real plugin UI in Obsidian 1.14.4, with Chinese and English labels.
- Verified against Dify 1.14.0: initial text creation, metadata backfill, updates, disabling and re-enabling. Checked field values after indexing completed, retained document IDs and preserved remote-only metadata.
- Failure, concurrency, multi-knowledge-base and rename branches are covered by automated regressions. This does not establish the cause of every earlier metadata-loss report.

## 中文说明

- **同步设置**中新增**元数据同步**开关，位于自动同步下方，升级后默认关闭，无需选字段或另设映射。
- 开启后自动同步全部顶层 YAML 属性，复用同名自定义字段，自动创建缺少的字段。
- 文本、数字、ISO 日期使用对应 Dify 类型；布尔值转为文本，列表和对象转为 JSON 文本。已有字段类型不自动修改，不兼容属性会在同步诊断中报告。
- 保留远端额外字段；本地属性删除、置空或关闭功能时，不清空远端值。
- 开启或重新开启后，下次同步会为已有文档补齐元数据。元数据失败时保留正文成功记录和文档 ID，下次只重试元数据。
- 修正更新 404 时的重建判断，保留失败任务的原文档关联，减少意外新建文档。

## Upgrade / 升级

Update through Obsidian Community plugins, or extract **Vault2Dify-1.0.9.zip** into `.obsidian/plugins/vault-to-dify/` and reload the plugin. Replace only `main.js`, `manifest.json` and `styles.css`; keep your existing `data.json`.

通过 Obsidian 社区插件更新，或将 **Vault2Dify-1.0.9.zip** 解压至 `.obsidian/plugins/vault-to-dify/` 后重新加载插件。仅替换 `main.js`、`manifest.json`、`styles.css`，保留原有 `data.json`。元数据同步需在升级后自行开启。
