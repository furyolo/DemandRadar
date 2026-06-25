import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const EXPECTED_PACKAGE = 'rednote-mind-mcp';
const EXPECTED_VERSION = '0.3.0';

function main() {
  const packageDir = findPackageDir();
  const packageJsonPath = join(packageDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  if (packageJson.name !== EXPECTED_PACKAGE) {
    throw new Error(`目标包不匹配：${packageJson.name}`);
  }

  if (packageJson.version !== EXPECTED_VERSION) {
    console.warn(`警告：当前 ${EXPECTED_PACKAGE} 版本是 ${packageJson.version}，补丁按 ${EXPECTED_VERSION} 编写。`);
  }

  patchSearch(join(packageDir, 'dist', 'tools', 'search.js'));
  patchServer(join(packageDir, 'dist', 'server.js'));

  console.log(`已应用 ${EXPECTED_PACKAGE} 本地补丁：${packageDir}`);
}

function findPackageDir() {
  const explicit = process.env.REDNOTE_MIND_MCP_DIR;
  if (explicit) {
    const dir = resolve(explicit);
    assertPackageDir(dir);
    return dir;
  }

  const commandPath = findCommandPath();
  if (commandPath) {
    const dir = join(dirname(commandPath), 'node_modules', EXPECTED_PACKAGE);
    if (existsSync(dir)) {
      return dir;
    }
  }

  const prefix = runCommand('npm', ['prefix', '-g']);
  const candidates = [
    join(prefix, 'node_modules', EXPECTED_PACKAGE),
    join(prefix, 'bin', 'node_modules', EXPECTED_PACKAGE)
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`未找到全局 ${EXPECTED_PACKAGE}。可设置 REDNOTE_MIND_MCP_DIR 指向包目录后重试。`);
}

function assertPackageDir(dir) {
  const packageJson = join(dir, 'package.json');
  if (!existsSync(packageJson)) {
    throw new Error(`REDNOTE_MIND_MCP_DIR 不是有效包目录：${dir}`);
  }
}

function findCommandPath() {
  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(command, ['rednote-mind-mcp'], { encoding: 'utf8' });
  if (result.status !== 0) {
    return '';
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.endsWith('.cmd')) || '';
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 失败：${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function patchSearch(filePath) {
  patchFile(filePath, [
    {
      name: 'search-scroll-pagination',
      patchedNeedle: 'const countSearchItems = async () => page.evaluate',
      oldText: `        // 4. 滚动页面加载更多结果（如果需要）
        if (limit > 20) {
            logger_1.logger.debug(\`  📜 滚动加载更多结果...\`);
            await page.evaluate(() => {
                window.scrollBy(0, 1000);
            });
            await page.waitForTimeout(constants_1.TIMING.SEARCH_SCROLL_DELAY_MS);
        }`,
      newText: `        // 4. 滚动页面加载更多结果。小红书搜索页是瀑布流懒加载，首屏通常只有两行左右。
        const countSearchItems = async () => page.evaluate(() => document.querySelectorAll('section.note-item, [class*="note-item"], [class*="search-item"], [class*="feed-item"], a[href*="/explore/"]').length);
        let loadedCount = await countSearchItems();
        let unchangedScrolls = 0;
        const maxScrolls = Math.max(3, Math.min(12, Math.ceil(limit / 4) + 2));
        if (loadedCount < limit) {
            logger_1.logger.debug(\`  📜 当前 \${loadedCount}/\${limit}，滚动加载更多结果...\`);
        }
        for (let scrollIndex = 0; loadedCount < limit && scrollIndex < maxScrolls && unchangedScrolls < 3; scrollIndex++) {
            await page.evaluate(() => {
                window.scrollBy(0, Math.max(window.innerHeight * 0.9, 900));
            });
            await page.waitForTimeout(constants_1.TIMING.SEARCH_SCROLL_DELAY_MS);
            const nextCount = await countSearchItems();
            if (nextCount <= loadedCount) {
                unchangedScrolls += 1;
            }
            else {
                unchangedScrolls = 0;
            }
            loadedCount = nextCount;
            logger_1.logger.debug(\`  📜 滚动 \${scrollIndex + 1}/\${maxScrolls} 后已加载 \${loadedCount} 个候选元素\`);
        }`
    }
  ]);
}

function patchServer(filePath) {
  patchFile(filePath, [
    {
      name: 'browser-state-reset-helper',
      patchedNeedle: 'function resetBrowserState()',
      oldText: `let page = null;`,
      newText: `let page = null;
function resetBrowserState() {
    browser = null;
    context = null;
    page = null;
}`
    },
    {
      name: 'browser-validity-check',
      patchedNeedle: 'browser.isConnected() && !page.isClosed()',
      oldText: `async function initBrowser() {
    if (browser && page) {
        return page;
    }
    console.error('🚀 初始化浏览器...');
    browser = await playwright_1.chromium.launch({ headless: false }); // 使用有头模式以便调试`,
      newText: `async function initBrowser() {
    if (browser && page && browser.isConnected() && !page.isClosed()) {
        return page;
    }
    if (browser || context || page) {
        console.error('♻️ 检测到浏览器状态失效，重新初始化...');
        await closeBrowser().catch(() => resetBrowserState());
    }
    console.error('🚀 初始化浏览器...');
    browser = await playwright_1.chromium.launch({ headless: false }); // 使用有头模式以便调试
    browser.on('disconnected', () => {
        resetBrowserState();
    });`
    },
    {
      name: 'page-close-listener',
      patchedNeedle: "page.on('close'",
      oldText: `    page = await context.newPage();
    console.error('✅ 浏览器初始化完成\\n');`,
      newText: `    page = await context.newPage();
    page.on('close', () => {
        page = null;
    });
    console.error('✅ 浏览器初始化完成\\n');`
    },
    {
      name: 'safe-close-browser',
      patchedNeedle: 'await page.close().catch',
      oldText: `async function closeBrowser() {
    if (page) {
        await page.close();
        page = null;
    }
    if (context) {
        await context.close();
        context = null;
    }
    if (browser) {
        await browser.close();
        browser = null;
    }
}`,
      newText: `async function closeBrowser() {
    if (page) {
        await page.close().catch(() => { });
        page = null;
    }
    if (context) {
        await context.close().catch(() => { });
        context = null;
    }
    if (browser) {
        await browser.close().catch(() => { });
        browser = null;
    }
}`
    }
  ]);
}

function patchFile(filePath, replacements) {
  let content = readFileSync(filePath, 'utf8');
  const usesCrlf = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');
  let changed = false;

  for (const replacement of replacements) {
    if (content.includes(replacement.patchedNeedle)) {
      console.log(`跳过已应用补丁：${replacement.name}`);
      continue;
    }

    if (!content.includes(replacement.oldText)) {
      throw new Error(`无法应用补丁 ${replacement.name}，目标代码片段不存在：${filePath}`);
    }

    content = content.replace(replacement.oldText, replacement.newText);
    changed = true;
    console.log(`应用补丁：${replacement.name}`);
  }

  if (changed) {
    writeFileSync(filePath, usesCrlf ? content.replace(/\n/g, '\r\n') : content, 'utf8');
  }
}

main();
