# 安装说明

[English](INSTALLATION.md) | 中文

本文说明如何构建、安装并首次配置 `Vault2Dify`。

相关文档：

- [用户指南](USER_GUIDE_ZH.md)
- [连接排错](docs/CONNECTION_TROUBLESHOOTING_ZH.md)

## 前置条件

- Obsidian 桌面端。
- 一个可访问的 Dify 知识库 API。
- 具备列出知识库、创建或更新文档权限的 Dify 知识库 API Key。
- 至少一个 Dify 知识库。
- 如果从源码构建，需要 Node.js 和 npm。

## 构建

在插件源码目录运行：

```bash
npm install
npm run build
```

构建会在项目根目录生成 `main.js`。

## 手动安装

在你的 Obsidian 仓库中创建插件目录：

```text
.obsidian/plugins/vault-to-dify/
```

只复制以下文件：

```text
main.js
manifest.json
styles.css
```

如有需要，重启 Obsidian，然后在 `设置 -> 社区插件 -> 已安装插件` 中启用 `Vault2Dify`。

## 首次配置

打开 `设置 -> Vault2Dify`，按顺序完成：

1. 填写 Dify 知识库 API Key。
2. 填写运行 Obsidian 的设备可以访问的 Dify 服务地址。
3. 点击 `测试连接`，确认 Key、地址、权限和 Dify API 响应可用。
4. 将 Obsidian 目录、单篇 Markdown 笔记或整个仓库映射到一个或多个 Dify 知识库。

如果后续在 Dify 中新增、删除或重命名知识库，可在映射区域刷新列表。

## Dify 服务地址

填写运行 Obsidian 的设备可以访问的服务根地址。插件会自动追加 `/v1/datasets` 等 Dify API 路径。

| 场景 | 填写 |
| --- | --- |
| 同一台电脑上的本机 Docker | `http://localhost:5000` |
| NAS/Docker 或局域网服务器 | `http://dify-host.example.test:5000` |
| 通过 Tailscale 访问 NAS | `http://tailnet-device.example.test:5000` |
| 带公网端口的云服务器 | `http://public-ip:2280` |
| 反向代理或 Dify Cloud | `https://dify.example.com` |

规则：

- 除非 Dify 和 Obsidian 运行在同一台电脑上，否则不要填写 `localhost`。
- 不要填写容器内部地址，例如 `api:5001`。
- 如果省略 `http://` 或 `https://`，插件会尝试使用 `http://`。
- 如果粘贴了以 `/v1` 或 `/v1/datasets` 结尾的地址，插件会规范化为服务根地址。

示例：

```text
配置地址：http://dify-host.example.test:5000
知识库请求：http://dify-host.example.test:5000/v1/datasets
```

## 排错

完整连接排错矩阵见 [docs/CONNECTION_TROUBLESHOOTING_ZH.md](docs/CONNECTION_TROUBLESHOOTING_ZH.md)。

快速检查：

- 确认 Dify 正在运行，且运行 Obsidian 的设备可以访问。
- 确认 API Key 属于同一个 Dify 实例，并具备知识库权限。
- 确认配置地址指向 Dify，而不是 NAS 或服务器管理页面。
- 确认反向代理转发了 `/v1/datasets`。
- 如果文件没有同步，确认文件是 `.md`，且命中已启用、已选择知识库的路径映射。

## 发布包

GitHub Release 只应附带用户安装所需文件：

```text
main.js
manifest.json
styles.css
```

不要包含：

- `node_modules`
- API Key
- 本地 Obsidian 仓库数据
- 插件本地数据文件
- 同步记录
- 原型文件
- 本地归档或私有评审说明
