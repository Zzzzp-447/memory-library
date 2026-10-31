# Memory Library · 错题记忆卡片库

简约手绘风格的错题整理与复习应用，支持电脑、手机和平板浏览器。

**在线体验：[memory-library-desktop.pages.dev](https://memory-library-desktop.pages.dev)**

## 功能

- 批量导入图片，一页框选多个区域，每张卡片独立选择学科、章节。
- 用户手动涂抹答案，正面做题、背面核对，通过勾叉记录复习结果。
- 按复习记录安排今日卡片，完成周期后继续保留题目。
- 学科文件夹与章节收纳；教材目录导入思维导图。
- 用户补充知识点、解题技巧、图片，导图节点可打开题目卡片。
- 导图支持分支编辑、长按菜单、浅蓝色关联曲线和重复章节合并。
- 账号登录与云端同步；PWA 离线资源和保留资料的访问恢复入口。

## 本地开发

使用 Node.js 22.18+ 和 pnpm 9.15.2：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

生产构建：

```sh
pnpm build
pnpm preview
```

普通构建输出 `dist/`。Cloudflare Pages 的独立构建与发布步骤见
[部署说明](cloudflare-pages/README.md)。

## 代码结构

| 目录 | 内容 |
| --- | --- |
| `src/` | React + TypeScript 应用、制卡、复习、导图与同步逻辑 |
| `public/` | 图标、字体、纸张素材、教材书目元数据及第三方许可证 |
| `cloudflare-pages/` | Pages 发布准备、同源 API 转发及浏览器验证脚本 |
| `sync-cloud/` | 云端 API、数据库结构及 Worker 源码 |
| `android-test/` | Android 测试包装源码，不含签名密钥、SDK 和安装包 |
| `src-tauri/` | 上游保留的桌面包装源码 |

云端数据库、用户图片、登录信息、部署凭据和本机资料不在本仓库中。
独立后端部署需要配置自己的 D1/R2 等服务；`VITE_SYNC_URL` 可指定 API 地址。
Pages 构建使用同源 API 转发，沿用现有的云端账号服务。

浏览器验证脚本需要另行安装 Playwright，并安装其使用的浏览器。

## 来源与许可

本项目基于 [SSShooter/ebook-to-mindmap](https://github.com/SSShooter/ebook-to-mindmap)
二次开发，保留原作者的 [MIT 许可证](LICENSE)；原英文说明见 [README.en.md](README.en.md)。

手绘图标来自 [oreo-design/doodle-icons](https://github.com/oreo-design/doodle-icons)。
字体及图标许可证保留在 `public/paper/`。教材书目引用
[TapXWorld/ChinaTextbook](https://github.com/TapXWorld/ChinaTextbook)，本仓库不包含教材 PDF。
