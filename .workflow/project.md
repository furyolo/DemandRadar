# Project: DemandRadar

## What This Is

DemandRadar（需求雷达）是一个自动化需求挖掘与商业评估系统。它以近期新闻热点、社区讨论、市场交易平台和付费任务平台为输入，借助 Smart Search 的 CLI + Skill 能力完成信息采集与深度分析，最终产出结构化的产品机会报告：包含用户画像、需求定义、市场规模估算、供给匹配、个人/AI Agent 可交付性和投入产出比评估。

**目标用户**：独立开发者 / Indie Hacker、产品经理、创业者 / 投资人、增长团队。

## Core Value

从多平台信号中持续发现值得做、值得接、可交付的产品和交易机会。

如果其他一切功能都失败，这个必须工作：**每日自动产出至少 3 条高价值需求及 Mini Product Brief**。

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 新闻采集引擎：通过 Smart Search CLI 每日拉取 Top 100 热点
- [ ] 清洗管道：去重 → 分类 → 热度排序
- [ ] 需求提取 Agent：基于 Skill 模版，从热点中推导用户需求
- [ ] 群体调研 Agent：自动检索目标人群规模数据
- [ ] 评分模型：多维度打分，产出 Top 10 需求排行榜
- [ ] 日报输出：每日自动生成日报，包含 Top 3 高价值需求 + Mini Brief
- [ ] CLI 交互：终端内浏览、筛选、深入查看需求完整分析

### Out of Scope

- Web Dashboard — 第二阶段，MVP 聚焦 CLI 体验
- 需求预测 — 第三阶段，先验证采集→分析→输出 pipeline
- 团队协作功能 — 第三阶段，单人使用先跑通
- 自研 ML 模型 — 全部依赖 LLM API，不做自训练

## Context

项目源于对现有需求挖掘工具的两点观察：
1. 英文互联网社区（Reddit/HN/PH/GitHub/Indie Hackers）拥有更成熟的公开讨论、竞品信号和可复用案例，适合作为 MVP 的首要数据源
2. 每个模块都有成熟开源项目可参考或复用，不需要从零开始——详见 `projectBrief.md` 附录 A

## Constraints

- **产品定位**：上层方向是 Opportunity-to-Deal Radar；需求信号只有经过付费意图、交付能力、供给匹配和利润空间判断后，才算 actionable opportunity
- **渠道角色**：Upwork/Fiverr 是付费买家需求源；Goofish/Reddit/GitHub 等渠道用于供给匹配、痛点验证和技术复用
- **人工确认边界**：默认只读采集；投递、私信、下单、询价、账号状态修改等平台写操作必须人工确认
- **工程纪律**：每个模块开发前必须完成一轮市场调研，确认无可复用项目后才从零开发
- **技术栈**：TypeScript / Node.js，匹配 Smart Search 和 Maestro 的 npm 生态
- **数据源**：通过 Smart Search CLI 全网检索，不自行开发爬虫
- **语言覆盖**：优先英文互联网源（Reddit/HN/PH/GitHub/Indie Hackers 等），中文源作为补充和后续差异化扩展

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js 24+
- **Storage**: SQLite (better-sqlite3) + Markdown 文件
- **Scheduling**: node-cron / systemd timer
- **Key Dependencies**: @konbakuyomu/smart-search (采集), maestro-flow (编排), openai / OpenAI-compatible LLM client (分析生成)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript over Python | Smart Search 和 Maestro 均为 npm 包，同运行时可直接复用内部能力；MCP SDK TypeScript 版最成熟 | 已确定 |
| 优先复用，拒绝重造 | 市场调研发现每个子模块都有成熟开源参考，见 projectBrief.md 附录 A | 已确定 |
| MVP 仅 CLI，不做 Web UI | 第一阶段验证 pipeline 可行性，Web Dashboard 分散精力 | 已确定 |
| 英文互联网优先 | MVP 需要先覆盖公开讨论密度高、工具和竞品信号更成熟的英文源；中文源后续作为差异化扩展 | 已确定 |

## Stakeholders

- 独立开发者 / Indie Hacker — 寻找 Micro SaaS 方向
- 产品经理 — 季度规划的外部洞察来源
- 创业者 / 投资人 — 早期赛道机会发现

---
*Last updated: 2026-06-18 after source-priority correction*
