# Roadmap: DemandRadar

## Overview

DemandRadar 当前路线图先交付 v0.1 CLI MVP：把新闻热点采集、清洗、需求提取、群体调研、评分、日报输出和 CLI 浏览串成一个可验证闭环。v0.2 在不替换日报的前提下扩展报告层：保留日报作为原始采样和审计链路，增加周报 / 月报 rollup，并为所有用户可见报告生成英文 canonical 版本和简体中文 localized 版本。后续 Web Dashboard、需求预测和团队协作保持延期，避免在验证核心 pipeline 与报告消费体验前扩散范围。

## Roadmap Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Mode | Create | 当前没有 `.workflow/roadmap.md`，按创建模式生成。 |
| Requirement source | `.workflow/project.md` + `projectBrief.md` | `.workflow/project.md` 提供 Active requirements，`projectBrief.md` 提供 MVP 边界、里程碑背景和复用约束。 |
| Scope | MVP CLI pipeline | 当前核心价值是每日产出至少 3 条高价值需求及 Mini Product Brief。 |
| Strategy | Progressive milestone with minimum-phase execution | 使用 milestone 表达产品推进，但当前 active scope 内不存在硬同步边界。 |
| Phase count | 1 | 7 条 Active requirements 都属于同一条端到端 CLI pipeline，可通过接口契约和 phase 内 wave DAG 并行推进。 |
| Source priority | English internet first | MVP 优先覆盖 Reddit、Hacker News、Product Hunt、Indie Hackers、GitHub 等英文高信号源；中文源作为补充和后续差异化扩展。 |
| Deferred scope | Web Dashboard, demand prediction, team collaboration, self-trained ML | 这些内容已在 project scope 中标记为 Out of Scope 或后续阶段。 |
| Approval | Approved by user on 2026-06-18 | 用户批准写入 1 个 milestone / 1 个 phase 的 roadmap，并更新 state.json。 |
| Revision mode | Revise from brainstorm `BRN-TIME-BILINGUAL-001` | 用户触发 `$maestro-roadmap` 紧接 cadence / bilingual brainstorm，按最新 brainstorm context 修订现有 roadmap。 |
| v0.2 scope | Report cadence and localization | 周报从日报提炼，月报从周报提炼；英文报告作为 canonical，简体中文报告通过 LLM 翻译生成。 |
| v0.2 strategy | Progressive milestone with 1 phase | 双语报告、artifact storage、CLI readback、周报 / 月报 rollup 属于同一报告层演进，可通过 phase 内 wave DAG 排序，不需要额外 phase barrier。 |
| v0.2 constraints | ORM-backed repository and daily preservation | 所有历史数据读取必须走 ORM-backed repository；日报必须继续可用，不被周报 / 月报替代。 |

## Milestones

### Milestone 1: CLI MVP Demand Pipeline (v0.1)

**Target**: 交付可在终端内运行的自动化需求挖掘 MVP，从近期热点生成 Top 10 需求排行榜，并输出每日 Top 3 Mini Product Brief。

**Status**: active

**Minimum-phase principle**: 默认 1 个 phase。只有在存在 runtime dependency、不可并行开发、且前一 phase 必须全部完成后后一 phase 才能开始时，才拆分 phase。本 milestone 当前不满足拆分条件。

#### Phases

- [ ] **Phase 1: End-to-End CLI Demand Intelligence Pipeline** - 完成从 Smart Search 热点采集到 CLI 浏览和日报输出的 MVP 闭环。

#### Phase Details

##### Phase 1: End-to-End CLI Demand Intelligence Pipeline

**Goal**: 构建 DemandRadar v0.1 的端到端 CLI pipeline，让用户可以触发一次完整需求挖掘流程，并得到可审计、可浏览、可复跑的结构化机会报告。

**Depends on**: Nothing (first phase)

**Requirements**:

- REQ-001: 新闻采集引擎：通过 Smart Search CLI 每日拉取 Top 100 热点
- REQ-002: 清洗管道：去重 -> 分类 -> 热度排序
- REQ-003: 需求提取 Agent：基于 Skill 模版，从热点中推导用户需求
- REQ-004: 群体调研 Agent：自动检索目标人群规模数据
- REQ-005: 评分模型：多维度打分，产出 Top 10 需求排行榜
- REQ-006: 日报输出：每日自动生成日报，包含 Top 3 高价值需求 + Mini Brief
- REQ-007: CLI 交互：终端内浏览、筛选、深入查看需求完整分析

**Success Criteria** (what must be TRUE):

1. 用户可以通过 CLI 手动触发一次完整运行，并可通过调度配置每日运行。
2. 系统通过 Smart Search CLI 获取近期英文互联网热点，保留来源、时间窗口和检索参数，并允许后续补充中文源。
3. 清洗管道能合并重复事件、过滤低质量内容，并输出按分类和热度排序的候选热点集。
4. 需求提取和群体调研 Agent 对候选热点产出用户画像、痛点、当前解决方案缺陷、市场规模估算、引用来源和置信度。
5. 评分模型输出 Top 10 需求排行榜，并能解释每条需求的需求强度、市场规模、付费意愿和可行性评分。
6. 日报生成器输出 Markdown 日报，包含 Top 3 高价值需求及对应 Mini Product Brief。
7. CLI 支持浏览、筛选和查看单条需求完整分析，并能定位到原始来源与生成报告。

#### Requirement Mapping

| Requirement | Phase |
|-------------|-------|
| REQ-001 新闻采集引擎 | Phase 1 |
| REQ-002 清洗管道 | Phase 1 |
| REQ-003 需求提取 Agent | Phase 1 |
| REQ-004 群体调研 Agent | Phase 1 |
| REQ-005 评分模型 | Phase 1 |
| REQ-006 日报输出 | Phase 1 |
| REQ-007 CLI 交互 | Phase 1 |

---

### Milestone 2: Report Cadence & Localization (v0.2)

**Target**: 在 v0.1 日报闭环之上，交付可审计、可回读的多周期和双语报告层：日报保持原始发现层，周报从日报提炼高信号机会，月报从周报提炼战略主题；所有用户可见报告同时提供英文和简体中文版本。

**Status**: planned

**Minimum-phase principle**: 本 milestone 仍保持 1 个 phase。报告 artifact schema / repository readback 是周报、月报、双语版本的共同基础，但可以通过接口契约与后续 plan 的 wave DAG 并行推进，不构成完整 phase barrier。

#### Phases

- [ ] **Phase 2: Cadence Rollups and Bilingual Report Variants** - 扩展报告 artifact、CLI readback 和 report rendering，让日报、周报、月报都具备英文 canonical 与简体中文 localized 版本。

#### Phase Details

##### Phase 2: Cadence Rollups and Bilingual Report Variants

**Goal**: 构建 DemandRadar 的报告消费层，让用户既能每天追踪新机会，也能通过周报和月报获得更稳定的创业机会判断，并能读取英文和简体中文两种报告版本。

**Depends on**: Phase 1 completed or its storage/report contracts available.

**Requirements**:

- F-001: cadence-rollups — 添加周报和月报生成，同时保留日报作为 atomic artifact。
- F-002: bilingual-report-variants — 生成英文 canonical 报告，并通过 LLM 翻译生成简体中文 localized 报告。
- F-003: artifact-storage-cli-readback — 扩展 report artifact 持久化与 CLI readback，支持 cadence 和 locale variants。

**Success Criteria** (what must be TRUE):

1. 日报仍按原行为生成和读取，且不被周报 / 月报替代。
2. 周报能基于指定 7 天窗口的日报和结构化 scores / demands / evidence 生成去重后的高信号机会总结。
3. 月报能基于周报提炼反复出现的机会主题、值得继续投入的方向和来源回链。
4. 英文报告作为 canonical artifact 先生成；简体中文报告由 LLM 翻译生成，并保留产品名、技术术语、API、模型名、代码标识符、URL 和 Markdown 结构。
5. 英文报告生成成功时，即使中文翻译失败，也不会回滚英文 artifact；CLI 能清楚报告缺失的 localized variant。
6. report artifact 持久化和读取通过 ORM-backed repository 完成，不新增业务层手写 SQL。
7. CLI 支持按 cadence 和 locale 查找或打印报告，同时保持现有 `report <date>` 日报读取习惯。

#### Requirement Mapping

| Requirement | Phase |
|-------------|-------|
| F-001 cadence-rollups | Phase 2 |
| F-002 bilingual-report-variants | Phase 2 |
| F-003 artifact-storage-cli-readback | Phase 2 |

---

## Scope Decisions

- **In scope**: TypeScript / Node.js CLI MVP、Smart Search CLI 集成、英文互联网热点源优先、SQLite + Markdown 存储、热点清洗、Skill Agent 分析、群体调研、评分模型、日报输出、CLI 浏览、周报 / 月报 rollup、英文 / 简体中文报告 variants、按 cadence / locale 的 CLI readback。
- **Deferred**: Web Dashboard、个性化配置、邮件 / Slack / 飞书推送、需求预测、竞品深度分析、团队协作。
- **Out of scope**: 自研 ML 模型、自建爬虫、第一阶段 Web UI、企业级协作流程。

## Progress

| Milestone | Phase | Status | Completed |
|-----------|-------|--------|-----------|
| 1. CLI MVP Demand Pipeline | 1. End-to-End CLI Demand Intelligence Pipeline | Not started | - |
| 2. Report Cadence & Localization | 2. Cadence Rollups and Bilingual Report Variants | Planned | - |
