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