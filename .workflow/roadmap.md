# Roadmap: DemandRadar

## Overview

DemandRadar 当前路线图聚焦 v0.1 CLI MVP：先把新闻热点采集、清洗、需求提取、群体调研、评分、日报输出和 CLI 浏览串成一个可验证闭环。后续 Web Dashboard、需求预测和团队协作保持延期，避免在验证核心 pipeline 前扩散范围。

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

## Scope Decisions

- **In scope**: TypeScript / Node.js CLI MVP、Smart Search CLI 集成、英文互联网热点源优先、SQLite + Markdown 存储、热点清洗、Skill Agent 分析、群体调研、评分模型、日报输出、CLI 浏览。
- **Deferred**: Web Dashboard、历史趋势对比、个性化配置、邮件 / Slack / 飞书推送、需求预测、竞品深度分析、团队协作。
- **Out of scope**: 自研 ML 模型、自建爬虫、第一阶段 Web UI、企业级协作流程。

## Progress

| Milestone | Phase | Status | Completed |
|-----------|-------|--------|-----------|
| 1. CLI MVP Demand Pipeline | 1. End-to-End CLI Demand Intelligence Pipeline | Not started | - |
