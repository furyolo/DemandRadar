---
title: "Learnings"
readMode: optional
priority: medium
category: learning
keywords:
  - bug
  - lesson
  - gotcha
  - learning
---

# Learnings

Add entries with: `/spec-add learning <description>`

## Entries

<spec-entry id="learning-goofish-fiverr-fit-gate-20260629" category="learning" date="2026-06-29" source="goofish-to-fiverr-retrospective" keywords="goofish,fiverr,supply-filter,keyword,classification">
  <title>Goofish-to-Fiverr exports need a service-fit gate before draft generation</title>
  <description>Using broad Goofish homepage/search entries such as `技能` produces many courses, resource packs, templates, Baidu Netdisk deliveries, recipes, books, recruiting posts, or homework/exam services. These are poor Fiverr candidates and can create unusable Gig packages. Use concrete service-delivery queries such as `n8n 自动化 代做`, `Power BI 可视化 看板 代做`, `logo 设计 接单`, `PPT 美化 代做`, `视频剪辑 接单`, and `网站搭建 接单`; filter out courses/resources/templates/homework/recruiting/copyright-risk records before running `goofish:fiverr-drafts`. After export, spot-check Draft service labels, category suggestions, private source index, image brief, and image prompt before treating the package as publish-ready.</description>
</spec-entry>

