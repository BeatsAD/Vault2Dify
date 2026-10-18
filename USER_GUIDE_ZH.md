# Vault2Dify 用户指南

[English](USER_GUIDE.md) | 中文

Vault2Dify 会将选定的 Obsidian Markdown 笔记同步到 Dify 知识库。只要运行 Obsidian 的设备能访问你配置的 Dify 服务地址，就可以用于本机 Docker、NAS/Docker、局域网、Tailscale、反向代理或 Dify Cloud。

插件界面默认使用英文。你可以在设置页顶部的语言图标中切换英文和中文。

## 1. 首次设置

请先安装插件。构建和手动安装步骤见 [INSTALLATION_ZH.md](INSTALLATION_ZH.md)。

打开 `设置 -> Vault2Dify`，按顺序完成：

```text
填写 Key -> 测试连接 -> 新增映射 -> 同步
```

### 填写 Key

填写：

- `Dify API Key`：具备列出知识库、创建或更新文档权限的 Dify 知识库 API Key。
- `Dify 服务地址`：运行 Obsidian 的设备可以访问的 Dify 服务根地址。

示例：

| 部署方式 | 地址 |
| --- | --- |
| 同一台电脑上的本机 Docker | `http://localhost:5000` |
| NAS/Docker 或局域网服务器 | `http://dify-host.example.test:5000` |
| 通过 Tailscale 访问 NAS | `http://tailnet-device.example.test:5000` |
| 反向代理或 Dify Cloud | `https://dify.example.com` |

插件会自动追加 `/v1/datasets` 等 Dify API 路径。除非 Dify 和 Obsidian 运行在同一台电脑上，否则不要使用 `localhost`。

### 测试连接

点击 `测试连接`，确认 API Key、服务地址、权限和 Dify 知识库 API 响应可用。测试成功后，插件会读取并保存当前知识库列表。

如果测试失败，请查看 [docs/CONNECTION_TROUBLESHOOTING_ZH.md](docs/CONNECTION_TROUBLESHOOTING_ZH.md)。

### 新增映射

知识库加载后：

1. 选择 Obsidian 目录、单篇 Markdown 笔记或整个仓库。
2. 选择一个或多个目标 Dify 知识库。
3. 保存映射。

新安装不会自动上传笔记。请在映射准备好后运行手动同步或启用自动同步。

## 2. 路径映射

路径映射决定哪些 Markdown 文件可以同步，以及同步到哪些知识库。

| Obsidian 路径 | Dify 知识库 |
| --- | --- |
| `Work/ProjectA` | Project A, Team Shared |
| `Reading` | Personal Reading |
| `Inbox/idea.md` | Ideas |
| 整个仓库 | Personal Knowledge Base |

规则：

- 一个 Obsidian 路径可以同步到多个知识库。
- 多个 Obsidian 路径也可以指向同一个知识库。
- 已停用的映射会被忽略。
- 删除映射只会移除本地插件配置。
- 删除映射不会删除 Obsidian 文件，也不会删除 Dify 远端文档。

Vault2Dify 会使用 Obsidian 文件路径作为 Dify 文档名，例如 `Work/ProjectA/meeting-notes.md`，因此不同目录下的同名文件会保持区分。

## 元数据同步

在**设置 → Vault2Dify → 同步设置**中开启**元数据同步**。开关默认关闭，无需选字段或另设映射。设置在下一次手动或自动同步时生效，覆盖笔记顶部全部 YAML 属性，包括 `tags`、`aliases`；不提取正文内的属性和标签。

插件复用同名自定义字段，自动创建缺少的字段。新字段根据首次同步的非空值决定类型：文本 → `string`，有限数字 → `number`，ISO 日期/日期时间 → `time`。布尔值、列表、嵌套对象使用文本（`true`/`false` 或 JSON）。已有文本字段接收文本表示，已有数字字段接收有限数字或数字文本，已有时间字段要求 ISO 日期或日期时间；不会自动修改字段类型。纯日期使用 UTC 零点，没有时区的日期时间使用设备本地时区。

更新本地属性的对应值，并保留其他远端字段。删除属性、将其设为 `null` 或 `""`、关闭元数据同步，均不会删除远端原值；空列表和空对象会写入 `[]`、`{}`。内置字段（`document_name`、`uploader`、`upload_date`、`last_update_date`、`source`）不能覆盖。无效或不兼容的属性会在现有同步诊断中报告，不会被当作全部成功。

开启或重新开启后，下一次同步会为正文未变化的已有文档补齐元数据。元数据失败时保留已成功上传的正文和文档 ID，下次只重试元数据。Dify 版本和 API Key 需支持读取/创建字段及文档元数据赋值；相关接口不可用时，正文仍可同步，元数据失败会保留并允许重试。

## 3. 同步行为

可以从以下位置手动同步：

- 功能区同步图标。
- 命令面板：`Sync to Dify Knowledge Base`。
- 插件设置页：`Sync now`。

自动同步可以监听 Markdown 创建、修改和重命名事件。定时全量校验作为文件事件遗漏时的兜底机制。

当前可见同步选项：

| 设置 | 选项 |
| --- | --- |
| 变更防抖 | 8 秒、15 秒、30 秒 |
| 全量校验间隔 | 30 分钟、60 分钟、关闭 |
| 并发上传 | 2 个文件、4 个文件 |

NAS/Docker 或较小的自托管 Dify 建议从以下设置开始：

```text
自动同步：开启
启动后同步：开启
全量校验：每 30 分钟
变更防抖：8 秒或 15 秒
并发上传：2 个文件
```

同步规则：

- 只有命中已启用映射的 Markdown 文件会进入同步。
- 如果本地保存的内容哈希未变化，文件会被跳过。
- 优先更新已有 Dify 文档；找不到匹配文档时再创建新文档。
- 单个文件失败不会中断整批同步。
- 删除本地笔记只会记录在本地同步状态中，不会自动删除 Dify 远端文档。

## 4. 诊断

状态栏只显示短状态，例如 `Dify: Ready`、`Dify: Syncing` 或 `Dify: Failed`。

设置页会显示：

- 连接状态。
- 当前地址和最近成功地址。
- 最近同步来源。
- 总数、已同步、已跳过和失败任务数。
- 最近同步地址和错误。
- 最近失败文件。

只有在排查连接、代理、API 路径或同步失败时才临时开启 `Debug logs`。不要分享包含 API Key 或敏感笔记内容的日志。

## 5. 隐私与安全

- 插件会读取当前 Obsidian 仓库中的 Markdown 文件。
- 只有命中已启用路径映射的 Markdown 文件会被发送到你配置的 Dify 服务地址。
- Dify API Key 保存在 Obsidian 插件本地数据中。
- 插件不会把笔记内容发送给插件作者，也不会发送到你配置的 Dify endpoint 以外的服务。
- 删除本地笔记不会自动删除 Dify 远端文档。
- 清空配置或同步记录只会影响本地插件数据。

详见 [SECURITY.md](SECURITY.md)。

## 6. 常见问题

### 可以粘贴以 `/v1` 结尾的 Dify 地址吗？

可以。插件会规范化 `/v1` 和 `/v1/datasets` 等已知后缀，再自动追加需要的 Dify API 路径。最清楚的填写方式仍是服务根地址，例如 `http://dify-host.example.test:5000`。

### 为什么在浏览器打开 `/v1/datasets` 会显示 401？

这可能说明地址已经正确路由到 Dify，只是缺少认证。插件读取知识库时会发送 `Authorization: Bearer <Dify API Key>`。

### 一篇笔记可以同步到多个知识库吗？

可以。一条映射可以选择多个 Dify 知识库。

### 删除本地笔记会删除 Dify 文档吗？

不会。删除本地笔记不会自动删除 Dify 远端文档。如需删除远端文档，请在 Dify 中手动处理。

### 大量同步很慢或超时怎么办？

使用更小的路径映射，将并发上传降到 `2 个文件`，并检查 Dify 服务负载、网络延迟和反向代理限制。
