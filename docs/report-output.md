# DemandRadar Report 产出契约

## 日报核心目标

日报必须围绕 Top 10 需求回答同一个交易问题：

个人能力能否直接满足该需求；如果不能，AI Agent 是否能短期补足；仍不能时，应该如何寻找第三方供给，从而促成一次可验证的交易。

## Top 10 必备字段

每条 Top 10 需求必须包含：

- `Demand`：一句话需求，必须来自有来源支撑的需求提取结果。
- `Score`：当前综合分，沿用评分模型输出。
- `Creator Capability Fit`：基于当前个人能力画像判断能否直接切入，包括 AI 应用、自动化、数据分析、平台机制、商业化和结构化研究能力。
- `Existing Supply Fit`：现有供给满足度，优先使用 `current_alternatives` 和 `competitor` 证据；没有来源支撑时明确写“本次未识别到现有供给证据”。
- `AI Agent Fill`：AI Agent 是否能补足缺口，依据可行性分和供给缺口描述，不得声称已验证交付能力。
- `Third-Party Supply Path`：当个人能力或 AI Agent 无法可靠履约时，明确应寻找的软件、服务商、自由职业者、线下履约方或有资质供给方。

## Mini Brief 必备字段

每个 Mini Brief 除原有用户、痛点、证据和分数外，必须包含 `Supply-Side Fit`：

- `Existing supply`：当前替代方案、竞品、服务商、人工 workaround 或“无来源支撑的现有供给”。
- `Supply gap`：现有供给未覆盖的关键缺口。
- `Creator capability fit`：个人是否可作为直接供给，或只能负责产品化、判断和流程编排。
- `AI Agent fill`：AI Agent 可补足的环节和可行性等级。
- `Transaction path`：如何从需求方意图走到供给匹配或 AI Agent 履约。
- `Third-party supply path`：个人和 AI Agent 不足时的外部供给路径。

## 证据边界

- 现有供给判断必须来自 `current_alternatives` 或 `market_evidence.evidence_type = competitor`。
- 无供给证据时，只能报告“本次未识别”，不能推断市场不存在供给。
- AI Agent 补足能力是机会评估，不是交付承诺；低证据或低可行性必须降低判断强度。
- 个人能力匹配是基于项目内能力画像的启发式评估，不代表已经验证交付能力；涉及牌照、医疗、法律、会计、线下履约、硬件、物流等信号时，必须倾向第三方供给。
- 供给侧信息不足时，报告应把缺口暴露出来，作为下一轮检索和验证方向。
