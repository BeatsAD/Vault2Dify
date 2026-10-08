# Vault2Dify 1.0.8

## Fixed

- Keep the four sync summary cards in a single row across settings window sizes.
- Use compact, consistent spacing between connection labels and inputs.
- Remove the unwanted separator below the API Key input and between sync settings.
- Include pagination inside the bordered mapping card, with horizontal scrolling confined to the table.
- Align the auto-sync label and switch on the same row.
- Keep pagination text and arrow buttons compact in narrow windows.

## Validation

- All 62 automated checks, TypeScript checks, and Obsidian lint passed.
- Checked Obsidian 1.14.4 in embedded and independent settings windows, with Chinese/English content and dark/light themes.
- Verified narrow layouts and container boundaries, empty/single-page/multi-page mappings, table scrolling, and twelve consecutive refreshes.
- Verified password visibility, dropdown changes, auto-sync toggling, mapping toggling, and pagination using temporary test data.
- Built and deployed to the external test vault, preserving its existing configuration.

## 中文说明

- 四张统计卡片改为一行四列。
- 缩小 API Key、Dify 服务地址标签与输入框的间距，去掉多余分隔线。
- 路径映射的外框完整包含分页组件，表格可以独立横向滚动。
- 自动同步文字与开关保持同一行、垂直居中。
- 去掉同步设置的多余横线，改善窄窗口分页布局。

更新时仅替换 `main.js`、`manifest.json` 和 `styles.css`，保留原有的 `data.json`。
