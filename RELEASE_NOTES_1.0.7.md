# Vault2Dify 1.0.7

## Fixed

- Fixed duplicate settings pages accumulating after refreshes and squeezing content into narrow columns.
- Removed the duplicate plugin title and description beside the settings page.
- Fixed field labels displaying `[object DocumentFragment]` in independent settings windows.
- Kept field values, required markers, and existing settings controls working across refreshes.

## Validation

- All 62 automated checks, TypeScript checks, and Obsidian lint passed.
- Checked Obsidian 1.13.7 and 1.14.4 in embedded and independent settings windows.
- Verified twelve consecutive refreshes, Chinese/English switching, narrow-window layouts, field persistence, API key show/hide, and clearing connection configuration using test fixtures.
- Built and deployed the plugin to the external test vault; verified the deployed files match the build.

## 中文说明

- 修复设置页刷新后重复叠加、内容被挤压成窄列的问题。
- 移除设置页旁重复出现的插件标题和说明。
- 修复独立设置窗口中的字段名称显示为 `[object DocumentFragment]` 的问题。
- 保留字段值、必填标记和现有控件交互。

更新时仅替换 `main.js`、`manifest.json` 和 `styles.css`，保留原有的 `data.json`。
