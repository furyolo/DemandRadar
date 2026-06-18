---
title: "Architecture Constraints"
readMode: required
priority: high
category: arch
keywords:
  - architecture
  - module
  - layer
  - boundary
  - dependency
  - structure
---

# Architecture Constraints

## Module Structure

## Layer Boundaries

## Dependency Rules

## Technology Constraints

## Entries



<spec-entry category="arch" keywords="orm,database,sqlite,drizzle,repository" date="2026-06-18" title="数据库访问必须通过 ORM" description="DemandRadar 数据库访问统一 ORM 规则" source=".workflow/scratch/20260618-brainstorm-orm-framework-selection/guidance-specification.md">

### 数据库访问必须通过 ORM

未来所有数据库操作 MUST 通过 ORM/ORM-backed repository 完成；业务代码、pipeline、commands、agents 不得新增手写 SQL 或 db.prepare 调用。允许的 raw SQL 只能作为 storage 层显式 escape hatch，并且必须有测试覆盖。推荐 ORM：Drizzle ORM。

</spec-entry>

<spec-entry category="arch" keywords="schema-migration,sqlite,storage-bootstrap,report-artifacts,backward-compatibility" date="2026-06-18" title="Schema 变更必须兼容已有 SQLite 数据库" description="新增持久化字段时需要 storage 层 bootstrap/migration 兼容旧库" source=".workflow/scratch/20260618-plan-P2-cadence-rollups-and-bilingual-report-variants/verification.json">

### Schema 变更必须兼容已有 SQLite 数据库

当 DemandRadar 为已有表新增持久化字段时，除了更新 Drizzle schema 和 `createSchemaSql`，还 MUST 在 storage 层提供兼容已有 SQLite 文件的 bootstrap/migration 路径，并用测试覆盖旧 artifact 的读取行为。业务层仍 MUST 通过 ORM-backed repository 访问数据；必要的 schema bootstrap 只能留在 storage 层显式 escape hatch 中。

</spec-entry>
