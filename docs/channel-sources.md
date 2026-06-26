# 渠道数据源策略

## 接入原则

所有新渠道接入前，先检索是否已有可复用的 skill、CLI、MCP 或 GitHub 项目。优先复用其只读导出、JSON 输出或 MCP/CLI 查询能力，再映射到 DemandRadar 的统一渠道导入结构；不要在没有调研的情况下从 0 到 1 写采集器。

渠道导入统一输出 `Source` 和 `Hotspot`，平台原始字段保留在 `source.raw`。渠道实现只负责采集和标准化，不直接改变需求抽取、供给分析和评分主流程。

## 当前渠道定位

| 渠道 | 英文标识 | 主要信号 | 说明 |
| --- | --- | --- | --- |
| 小红书 / RedNote | `rednote` | 需求为主，少量供给 | 生活方式、消费决策、求推荐、服务撮合信号明显。 |
| 闲鱼 | `goofish` | 需求 + 供给 | 求购、转让、服务、价格、地区、想要数等字段可以同时支撑需求和供给判断。 |
| Reddit | `reddit` | 需求为主，少量供给 | 抱怨、求工具、工作流痛点是主信号；评论中的工具推荐、开源项目和服务商可作为供给补充。 |
| GitHub | `github` | 供给为主 | 开源项目、替代方案、维护活跃度、issue 里的未满足需求。 |
| Upwork | `upwork` | 需求 + 付费信号 + 供给响应 | 客户发布任务并给出预算，服务者投标承接；不能简单归为供给源。 |
| Fiverr | `fiverr` | 需求 + 供给 | 服务 listing 体现供给，买家请求或任务上下文体现需求和付费意愿。 |

## 闲鱼参考调研

本次接入前检索到的可参考项目：

- `fancyboi999/goofish-cli`：Goofish/Xianyu CLI，支持 MCP，覆盖商品详情、搜索、IM 等能力。
- `mercy719/goofish-mcp-server`：Node.js + Playwright 的 Goofish MCP server，包含 `search_items`、`get_item_detail`、`monitor_keyword`。
- `yunwanshu/xianyu-buyer-mcp`：买家侧询价 MCP，覆盖搜索、批量询价、会话读取。
- `xianyu-mcp`：PyPI 上的闲鱼 MCP 服务，覆盖登录、搜索商品、商品详情、收藏、发布等工具。
- `Usagi-org/ai-goofish-monitor`：Playwright + AI 的闲鱼监控项目，包含任务、筛选、通知和 Web 管理。

当前 DemandRadar 不直接绑定这些项目的运行时依赖，先支持导入它们或类似工具导出的 JSON。真实账号登录、浏览器自动化、询价或发送消息属于高风险写操作，必须在独立边界内二次确认后接入。

## 闲鱼接入决策

首选接入 `fancyboi999/goofish-cli` 的只读命令输出。DemandRadar 通过 `npm run goofish:import` 调用外部 CLI，生成 `{ "items": [...] }` JSON，再交给 `--goofish-json` 进入主流程。

在渠道内搜索时，关键词只描述主题、意图或品类，不重复包含渠道名称。例如 Goofish 渠道内使用 `求购 家教`，不要使用 `闲鱼 求购 家教`；RedNote 渠道内同理不需要把 `小红书` / `RedNote` 放进查询词。

Goofish 当前通过页面渲染和固定次数滚动采集，`goofish-cli` 单关键词 `--limit` 上限为 50。实际挖掘应采用多关键词分桶采集，而不是单关键词无限下滚：每个关键词限量抓取，再按 `item_id` / `url` 合并去重生成统一 `items.json`。

当前只允许以下只读能力进入自动化采集链路：

- `search items`：按关键词搜索闲鱼商品或服务线索。
- `item view` / `item get`：补充详情字段时使用。

暂不把发布、删除、发送消息、批量询价等写操作接入 DemandRadar 主流程。若未来需要验证供给响应，应单独设计人工确认边界和频率限制。

推荐运行方式（临时挖掘结果沿用 RedNote 流程，集中放在 `.tmp/<channel>-<date>[-topic]/` 下）：

```bash
npm run goofish:import -- --query "求购 家教" --limit 20 --output .tmp/goofish-2026-06-26/items.json
npm run demandradar:run -- --goofish-json .tmp/goofish-2026-06-26/items.json --goofish-query "求购 家教" --skip-smart-search --locale zh-CN --db .tmp/goofish-2026-06-26/demandradar.sqlite --reports-dir .tmp/goofish-2026-06-26/reports --briefs-dir .tmp/goofish-2026-06-26/briefs
```

如果本机不安装 `goofish` 命令，而是使用 `uvx goofish-cli`：

```bash
npm run goofish:import -- --command uvx --command-arg goofish-cli --query "求购 家教" --output data/goofish-items.json
```

## 闲鱼本机安装与登录记录

### 安装方式

不要在 DemandRadar 项目里执行 `uv add goofish-cli`。本项目是 Node.js / TypeScript 项目，`uv add` 会把当前目录当作 Python 项目处理，可能新增或修改 `pyproject.toml`、`uv.lock` 等文件，污染项目依赖边界。

推荐使用 `uv tool install` 做用户级持久安装：

```powershell
uv tool install goofish-cli
goofish --help
goofish list-commands
```

安装位置可通过以下命令确认：

```powershell
uv tool dir
uv tool list
```

如果 `goofish` 命令不在 PATH，执行：

```powershell
uv tool update-shell
```

然后重开 PowerShell / Codex 终端。

`uvx goofish-cli ...` 可以临时运行并会利用缓存，但首次会安装较多包，后续仍有环境解析和启动开销。稳定采集时优先使用 `uv tool install goofish-cli`。

### Playwright Chrome 前置条件

`goofish-cli` 当前版本在刷新 cookie / 打开自动化浏览器时使用 Playwright 的 `channel="chrome"`，会查找标准 Google Chrome 路径，例如：

```text
C:\Users\<user>\AppData\Local\Google\Chrome\Application\chrome.exe
```

如果本机只有 Scoop 安装的 Chromium，例如：

```text
C:\Users\foogl\scoop\apps\chromium\current\chrome.exe
```

仍可能报错：

```text
Chromium distribution 'chrome' is not found at C:\Users\<user>\AppData\Local\Google\Chrome\Application\chrome.exe
Run "playwright install chrome"
```

处理方式是在 `goofish-cli` 的 uv tool Python 环境里安装 Playwright 管理的标准 Chrome：

```powershell
& "C:\Users\foogl\scoop\persist\uv\tools\versions\goofish-cli\Scripts\python.exe" -m playwright install chrome
```

这不会覆盖 Scoop Chromium。Chrome 和 Chromium 是不同安装路径、不同用户数据目录。

### 推荐登录方式

优先使用 `goofish-cli` 自带二维码登录：

```powershell
goofish auth login --qr --qr-timeout 180 --format json
goofish auth status --format json
```

如果 `auth status` 返回 `valid: true`，即可继续只读搜索。

曾经失败过的路径：

- `goofish auth login --browser edge` 可能因为 Edge profile、cookie 域或加密读取问题，拿不到完整 `unb` / `_m_h5_tk`。
- 标准 Chrome 安装后，`auth status` 可能尝试“快速进入”刷新 cookie；如果浏览器免密记忆失效，会出现 `快速进入不可用`、`Session过期`、缺 `_m_h5_tk` / `cookie2` 等错误。

遇到这些问题时，直接重新执行二维码登录通常最稳：

```powershell
goofish auth login --qr --qr-timeout 180 --format json
goofish auth status --format json
```

必要时先清理旧登录态再扫码：

```powershell
Remove-Item "$env:USERPROFILE\.goofish-cli\cookies.json" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:USERPROFILE\.goofish-cli\im_token.json" -Force -ErrorAction SilentlyContinue
goofish auth login --qr --qr-timeout 180 --format json
goofish auth status --format json
```

### 登录状态与浏览器窗口

`goofish search items ...` 打开的浏览器窗口不一定显示为已登录，这是正常现象。`goofish-cli` 会为自动化调用创建独立临时 profile，并把 `~/.goofish-cli/cookies.json` 中的 cookie 注入进去；这个窗口不是日常 Chrome / Edge profile，也不是长期使用的浏览器。

判断是否可用于 DemandRadar，只看命令结果：

```powershell
goofish auth status --format json
goofish search items "求购 家教" --limit 5 --format json
```

只要 `auth status` 有效，或 `search items` 能返回结构化 JSON，就可以运行 DemandRadar 导入：

```powershell
npm run goofish:import -- --query "求购 家教" --limit 20 --output .tmp/goofish-2026-06-26/items.json
npm run demandradar:run -- --goofish-json .tmp/goofish-2026-06-26/items.json --goofish-query "求购 家教" --skip-smart-search --locale zh-CN --db .tmp/goofish-2026-06-26/demandradar.sqlite --reports-dir .tmp/goofish-2026-06-26/reports --briefs-dir .tmp/goofish-2026-06-26/briefs
```

### 常见错误速查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `Got unexpected extra argument(s)` | 当前版本 `auth login` 不接受位置参数 | 使用 `goofish auth login --source "<cookie>" --raw`，不要把 cookie 当位置参数。 |
| `Chromium distribution 'chrome' is not found` | 只安装了 Scoop Chromium，未安装 Playwright 标准 Chrome | 在 uv tool 环境执行 `python -m playwright install chrome`。 |
| `快速进入不可用` / `Session过期` | 浏览器免密刷新失败或旧 cookie 已过期 | 执行 `goofish auth login --qr --qr-timeout 180 --format json` 重新扫码。 |
| 自动化窗口里看起来未登录 | Playwright 使用临时 profile，不是日常浏览器 profile | 以 `auth status` 和 `search items` 输出为准。 |
