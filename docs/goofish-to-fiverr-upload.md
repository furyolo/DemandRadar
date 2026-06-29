# 闲鱼供给到 Fiverr 上传辅助流程

这份文档说明如何把闲鱼供给整理成 Fiverr Gig 发布包，并通过本地 HTTP bridge + 油猴脚本辅助填写 Fiverr 页面。

## 适用范围

- 从闲鱼搜索供给，生成 Fiverr 可发布的 Gig 草稿。
- 保留闲鱼来源链接，作为后续履约回查使用。
- 使用本地数据库去重，避免同一个闲鱼供给重复上传。
- 用油猴脚本辅助填写 Fiverr 表单。

不包含自动点击 `Publish`。最终发布必须人工确认。

## 1. 生成草稿并写入本地队列

### Fiverr 适配性门禁

不要直接用闲鱼首页的宽泛入口生成发布包，例如 `技能`、`猜你喜欢`、`课程`、`资料`。这类入口容易返回教程、网盘资源、模板、配方、书籍、招人贴或作业代做，通常不能直接发布到 Fiverr。

优先使用可交付服务型检索词：

- `n8n 自动化 代做`
- `Power BI 可视化 看板 代做`
- `logo 设计 接单`
- `PPT 美化 代做`
- `视频剪辑 接单`
- `网站搭建 接单`

生成发布包前必须先做一次供给过滤：

- 保留：按需求交付成果的服务，如自动化工作流、数据看板、Logo/海报设计、PPT 制作、视频剪辑、网站或系统开发。
- 过滤：课程、教程、资料包、模板、网盘、自动发货、配方、书籍、源码合集、作业/考试/论文、招人接单群、版权或授权不清的资源。
- 对价格极低的服务，只能作为供给线索；接 Fiverr 订单前必须重新确认卖家可接单、报价、交付周期、版权/商用授权和修改范围。

导出前抽查：

- `## Draft` 的服务类型应和闲鱼标题一致。
- `Category 建议` 不能被泛化成错误类目。
- `私有供给来源索引` 必须存在，且闲鱼链接只留在私有区。
- Markdown 中必须包含 `Required Gig Image Brief` 和 `Image Generation Prompt`。

推荐先运行精选脚本，再把精选结果交给草稿导出器：

```powershell
npm run goofish:fiverr-curate -- --output .tmp/goofish-fiverr/curated-items.json --rejected-output .tmp/goofish-fiverr/curated-rejected.json
npm run goofish:fiverr-drafts -- --query "精选可交付供给" --input .tmp/goofish-fiverr/curated-items.json --limit 12 --output .tmp/goofish-fiverr/curated-drafts.md
```

`goofish:fiverr-curate` 默认会从 Fiverr 服务型查询池里按日期轮换关键词，例如 `n8n 自动化 代做`、`AI 智能体 工作流 代做`、`Vapi 语音智能体 搭建`、`RAG 知识库 聊天机器人 定制`、`Shopify 网站 搭建`、`GEO AEO SEO 优化`、`UGC 视频 广告 拍摄` 等，并输出拒绝原因报告。也可以处理已有采集文件：

```powershell
npm run goofish:fiverr-curate -- --input .tmp/goofish-fiverr/raw-items.json --output .tmp/goofish-fiverr/curated-items.json
```

在项目根目录运行：

```powershell
npm run goofish:fiverr-drafts -- --query "网站搭建 接单" --limit 10
```

默认行为：

- 输出 Markdown 草稿到 `.tmp/goofish-fiverr/drafts.md`。
- 写入本地数据库 `data/demandradar.sqlite`。
- 定价会按闲鱼供给价向上倒推：默认要求 Fiverr 净收入至少覆盖闲鱼标价 `10x`，再叠加平台手续费、提现 / 汇损假设并向上取整。闲鱼低价通常只是引流价，发布前仍需重新确认真实报价和范围。
- 按闲鱼 `item_id` 或来源 URL 去重。
- 同一个供给只保留一个活跃 Fiverr 草稿。
- 已标记为 `published` 或 `skipped` 的供给不会再次进入待上传队列。

可按服务风险调高或调低成本倍数下限：

```powershell
npm run goofish:fiverr-drafts -- --query "网站搭建 接单" --limit 10 --min-source-multiple 12
```

如果只想生成 Markdown，不写入数据库：

```powershell
npm run goofish:fiverr-drafts -- --query "网站搭建 接单" --limit 10 --no-persist
```

如果要指定数据库：

```powershell
npm run goofish:fiverr-drafts -- --query "网站搭建 接单" --limit 10 --db data/demandradar.sqlite
```

## 2. 单独启动本地 HTTP bridge

油猴脚本不能直接读取本地 SQLite 数据库，也不能自己启动本地进程。所以在使用 Fiverr 页面辅助填表前，需要单独启动 bridge。

在项目根目录运行：

```powershell
npm run goofish:fiverr-bridge -- --port 3233 --token demandradar-local
```

看到以下输出说明启动成功：

```text
[DemandRadar] Fiverr bridge listening at http://127.0.0.1:3233
[DemandRadar] Database: data/demandradar.sqlite
[DemandRadar] Publish remains manual. The bridge only reads drafts and records statuses.
```

注意：

- 这个命令需要保持终端窗口打开。
- 关闭终端或按 `Ctrl+C` 会停止 bridge。
- 默认只监听本机 `127.0.0.1:3233`。
- `--token demandradar-local` 需要和油猴脚本里的 token 一致。
- 只生成 Markdown / 入库去重时不需要启动 bridge。
- 只有要让油猴脚本读取待上传草稿、辅助填写 Fiverr 页面时才需要启动。

## 3. 安装油猴脚本

油猴脚本文件：

```text
scripts/fiverr-gig-fill.user.js
```

安装到 Tampermonkey 后，打开 Fiverr 页面时右下角会出现 `DemandRadar Fiverr` 面板。

脚本默认访问：

```text
http://127.0.0.1:3233
```

请求头 token：

```text
x-demandradar-token: demandradar-local
```

## 4. 面板按钮说明

| 按钮 | 中文含义 | 作用 |
| --- | --- | --- |
| `Load next` | 加载下一个草稿 | 从本地 bridge 读取数据库里的下一个待上传 Fiverr Gig 草稿，并标记为 `filling`。 |
| `Fill fields` | 填写字段 | 尝试把草稿内容填入当前 Fiverr 页面可识别的输入框。Fiverr 页面结构可能变化，所以不是 100% 保证。 |
| `Copy title` | 复制标题 | 复制 Gig 标题，方便手动粘贴。 |
| `Copy desc` | 复制描述 | 复制 Gig 描述，方便手动粘贴。 |
| `Mark saved` | 标记已保存草稿 | 当你在 Fiverr 手动保存为草稿后，点击此按钮，把本地状态改成 `draft_saved`。 |
| `Published` | 标记已发布 | 只有你已经在 Fiverr 人工发布成功后再点。本地会标记为 `published`，以后去重跳过。 |
| `Skip` | 跳过 | 当前供给不适合上传时使用。本地会标记为 `skipped`，以后去重跳过。 |
| `Failed` | 标记失败 | 当前上传流程失败时使用，方便后续排查。 |

## 5. 推荐操作顺序

```text
生成草稿并入库
→ 启动 bridge
→ 打开 Fiverr Gig 创建页
→ 油猴面板点 Load next
→ 点 Fill fields
→ 人工检查字段
→ 上传至少 1 张合规 Gig 图片
→ 在 Fiverr 保存草稿
→ 油猴面板点 Mark saved
→ 人工确认发布后再点 Published
```

## 6. 图片和发布边界

Fiverr 发布 Gig 至少需要 1 张图片。草稿 Markdown 会包含：

- `Required Gig Image Brief`
- `Image Generation Prompt`
- `Gallery / Media Assets`

不要直接使用闲鱼卖家的图片、截图、平台 logo 或第三方作品，除非有明确授权。

油猴脚本和 bridge 不会：

- 自动点击 `Publish`
- 绕过验证码、平台限制或账号验证
- 使用非官方 Fiverr 写接口
- 自动上传未确认的图片素材

## 7. 常见问题

### bridge 命令需要每次都手动运行吗？

需要在使用浏览器辅助填表前运行。它是本地长运行服务，不会在生成草稿时自动常驻启动。

### 只生成 Fiverr Markdown 是否需要 bridge？

不需要。只有油猴脚本读取数据库队列时才需要 bridge。

### 为什么不让油猴脚本直接读数据库？

浏览器脚本不能直接访问本机 SQLite 文件。需要本地 HTTP bridge 把数据库队列暴露成受 token 保护的本机接口。

### 端口一定是 3233 吗？

当前推荐使用 `3233`。如果改端口，需要同时修改启动命令和油猴脚本里的 `BRIDGE_URL`。

### 已发布的供给还会再次上传吗？

不会。只要在油猴面板里标记为 `Published`，之后同一个闲鱼供给再次被搜索到，也会被本地去重机制跳过。
