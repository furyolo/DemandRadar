# 闲鱼供给到 Fiverr 手动上传流程

这份文档说明如何把闲鱼供给整理成 Fiverr Gig 发布包，并根据产出的 Markdown 草稿手动填写 Fiverr 页面。

## 适用范围

- 从闲鱼搜索供给，生成 Fiverr 可发布的 Gig 草稿。
- 保留闲鱼来源链接，作为后续履约回查使用。
- 使用本地数据库去重，避免同一个闲鱼供给重复进入发布候选。
- 根据草稿目录和 Markdown 内容，手动填写 Fiverr 表单、上传素材、保存或发布。

不包含自动填表、自动上传或自动点击 `Publish`。最终发布必须人工确认。

## 1. 生成草稿

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

默认推荐使用一键流程。它会先用 Fiverr 服务型查询池按日期轮换关键词做闲鱼采集和精选，再把精选结果交给草稿导出器：

```powershell
npm run goofish:fiverr
```

默认输出：

- 精选供给：`.tmp/goofish-fiverr/curated-items.json`
- 拒绝原因：`.tmp/goofish-fiverr/curated-rejected.json`
- Fiverr 草稿：`.tmp/goofish-fiverr/curated-drafts.md`

如果要手动拆开执行，也可以先运行精选脚本，再把精选结果交给草稿导出器：

```powershell
npm run goofish:fiverr-curate -- --output .tmp/goofish-fiverr/curated-items.json --rejected-output .tmp/goofish-fiverr/curated-rejected.json
npm run goofish:fiverr-drafts -- --query "精选可交付供给" --input .tmp/goofish-fiverr/curated-items.json --limit 12 --output .tmp/goofish-fiverr/curated-drafts.md
```

`goofish:fiverr` 和 `goofish:fiverr-curate` 在未传 `--query` 或 `--input` 时，都会从 Fiverr 服务型查询池里按日期轮换关键词，例如 `n8n 自动化 代做`、`AI 智能体 工作流 代做`、`Vapi 语音智能体 搭建`、`RAG 知识库 聊天机器人 定制`、`Shopify 网站 搭建`、`GEO AEO SEO 优化`、`UGC 视频 广告 拍摄` 等，并输出拒绝原因报告。传入 `--query` 时会改用手动指定的查询；传入 `--input` 时会筛选已有采集文件。

处理已有采集文件：

```powershell
npm run goofish:fiverr-curate -- --input .tmp/goofish-fiverr/raw-items.json --output .tmp/goofish-fiverr/curated-items.json
```

只生成草稿：

```powershell
npm run goofish:fiverr-drafts -- --query "网站搭建 接单" --limit 10
```

默认行为：

- 输出 Markdown 草稿到 `.tmp/goofish-fiverr/drafts.md`。
- 写入本地数据库 `data/demandradar.sqlite`，用于后续去重。
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

## 2. 手动上传清单

打开 `.tmp/goofish-fiverr/curated-drafts.md` 或你指定的草稿 Markdown，逐个 `## Draft` 处理。

每个 Draft 里需要手动复制 / 参考的字段：

- `Gig Title`：填在 Fiverr 的 `I will ...` 后面。
- `Category 建议`：手动选择 Fiverr 的 category、subcategory，以及选择后出现的 service type / metadata。
- `Search Tags`：最多 5 个，按 Fiverr 页面要求逐个填写。
- `Packages`：手动填写 Basic / Standard / Premium 的 scope、delivery、revisions、price。
- `Description`：复制到 Fiverr 描述区，发布前人工检查措辞。
- `Buyer Requirements`：手动添加买家问题。
- `Gallery / Media Assets`：准备并上传图片、视频或 PDF。
- `Required Gig Image Brief` 和 `Image Generation Prompt`：用于生成或制作 Fiverr 封面图。
- `私有供给来源索引`：只用于履约回查，不要放进 Fiverr 公开页面。

推荐操作顺序：

```text
生成草稿 Markdown
→ 打开 Fiverr Gig 创建页
→ 按 Draft 复制填写 Overview
→ 手动选择 Category / Service type / Gig metadata
→ 手动填写 Pricing
→ 手动填写 Description & FAQ
→ 手动填写 Requirements
→ 上传至少 1 张合规 Gig 图片
→ 人工检查所有公开字段
→ 保存草稿或人工确认后发布
```

## 3. 图片和发布边界

Fiverr 发布 Gig 至少需要 1 张图片。草稿 Markdown 会包含：

- `Required Gig Image Brief`
- `Image Generation Prompt`
- `Gallery / Media Assets`

不要直接使用闲鱼卖家的图片、截图、平台 logo 或第三方作品，除非有明确授权。

手动上传流程仍然不能绕过以下边界：

- 不自动点击 `Publish`
- 不绕过验证码、平台限制或账号验证
- 不使用非官方 Fiverr 写接口
- 不上传未确认的图片素材
- 不把闲鱼来源链接、卖家信息或未授权素材放进 Fiverr 公开页面

## 4. 常见问题

### 只生成 Fiverr Markdown 是否需要长期运行服务？

不需要。当前流程只依赖草稿 Markdown 和本地数据库去重，不需要浏览器脚本或本地 HTTP 服务。

### 已发布的供给还会再次生成草稿吗？

如果本地数据库里对应供给已标记为 `published` 或 `skipped`，之后同一个闲鱼供给再次被搜索到，也会被本地去重机制跳过。手动上传后如需维护状态，应通过后续专门的状态管理流程处理。
