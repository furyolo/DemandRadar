# RedNote Mind MCP 本地补丁维护

本文记录 `rednote-mind-mcp@0.3.0` 的本地补丁、升级后的重放方式，以及提交上游 PR / fork 的建议路径。

## 当前补丁

补丁脚本：`scripts/patch-rednote-mind-mcp.mjs`

执行方式：

```bash
npm run patch:rednote-mcp
```

补丁目标：

- `dist/tools/search.js`
  - 原实现只有 `limit > 20` 时滚动一次。
  - 补丁改为按目标 `limit` 循环滚动加载，直到结果数量达标、连续无新增，或达到滚动上限。
- `dist/server.js`
  - 原实现只用 `browser && page` 判断浏览器可复用。
  - 补丁改为检查 `browser.isConnected()` 与 `page.isClosed()`。
  - 用户手动关闭浏览器后，下一次 MCP 工具调用会自动清理旧状态并重新启动浏览器。

## 升级后如何恢复

升级或重装 `rednote-mind-mcp` 后执行：

```bash
npm run patch:rednote-mcp
```

如果全局包位置无法自动识别，可手动指定：

```bash
REDNOTE_MIND_MCP_DIR="C:/path/to/node_modules/rednote-mind-mcp" npm run patch:rednote-mcp
```

Windows PowerShell：

```powershell
$env:REDNOTE_MIND_MCP_DIR = "C:/path/to/node_modules/rednote-mind-mcp"
npm run patch:rednote-mcp
Remove-Item Env:REDNOTE_MIND_MCP_DIR
```

脚本是幂等的：已应用过的补丁会跳过。

## 验证步骤

1. 重启 MCP，使 `rednote-mind-mcp` 重新加载 `dist/server.js`。
2. 调用 `check_login_status`，确认浏览器首次启动且返回已登录。
3. 手动关闭 MCP 打开的浏览器窗口。
4. 再调用 `search_notes_by_keyword`，确认浏览器会自动重新启动并返回搜索结果。
5. 调用 `search_notes_by_keyword` 时使用 `limit=20`，确认结果不再固定停留在首屏两行。

## 上游 PR 草稿

仓库：`https://github.com/CopeeeTang/rednote-mind-mcp`

推荐分支名：

```bash
fix/browser-recovery-search-scroll
```

标题：

```text
fix: recover closed browser and load more search results
```

PR 描述：

```markdown
## Summary

- Reinitialize Playwright browser/page when the user manually closes the browser window.
- Track `browser.on('disconnected')` and `page.on('close')` to clear stale cached state.
- Make search result loading scroll until enough note cards are available, instead of only scrolling once when `limit > 20`.

## Why

Two runtime issues show up in MCP clients:

1. After a tool call opens the browser, manually closing that browser leaves the MCP server process alive but with a stale cached `page`. The next tool call reuses the closed page and fails, which looks like the MCP server did not start.
2. Xiaohongshu search uses lazy-loaded waterfall results. With the default `limit=10`, the old implementation did not scroll at all, so it often returned only the first 7-8 visible notes.

## Verification

- `check_login_status` opens the browser and reports a valid login.
- After manually closing the browser window, `search_notes_by_keyword` starts a fresh browser and returns results.
- `search_notes_by_keyword({ keyword: "家教", limit: 20, sortType: "latest" })` returns more than the first two rows when the page provides additional lazy-loaded results.
```

源码修改点：

- `src/server.ts`
  - 增加 `resetBrowserState()`。
  - `initBrowser()` 判断 `browser.isConnected()` 和 `page.isClosed()`。
  - 监听 `browser.on('disconnected')` 与 `page.on('close')`。
  - `closeBrowser()` 对已关闭对象使用 `.catch(() => {})` 容错。
- `src/tools/search.ts`
  - 删除 `limit > 20` 的单次滚动。
  - 增加 `countSearchItems()` 与循环滚动加载。

## 如果上游不合并

推荐 fork 并 pin 到自己的版本：

```bash
npm install -g github:<your-user>/rednote-mind-mcp#fix/browser-recovery-search-scroll
```

然后继续保留 `npm run patch:rednote-mcp` 作为兜底，直到上游发布包含修复的新版本。
