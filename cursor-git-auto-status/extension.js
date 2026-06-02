const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

/** @type {vscode.OutputChannel} */
let output;

/** 执行一条命令,永不 reject,把结果统一返回。 */
function run(command, cwd) {
  return new Promise((resolve) => {
    cp.exec(
      command,
      { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => resolve({ error, stdout: stdout || '', stderr: stderr || '' })
    );
  });
}

function looksLikeGitMissing(error) {
  return !!error && /not (recognized|found)|command not found|无法将.+识别/i.test(error.message || '');
}

/** 返回本地时区的 "YYYY-MM-DD HH:mm:ss" 时间戳。 */
function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
         `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 处理单个工作区文件夹。 */
async function checkFolder(folder) {
  const cwd = folder.uri.fsPath;
  const name = folder.name;
  output.appendLine(`\n=== [${timestamp()}] ${name}  (${cwd}) ===`);

  // 1) 不是 git 项目(没有 .git)
  if (!fs.existsSync(path.join(cwd, '.git'))) {
    const msg = `「${name}」本项目不是git项目`;
    output.appendLine(msg);
    vscode.window.showWarningMessage(msg, { modal: true });
    return;
  }

  // 2) git fetch —— 拉取远程版本信息
  const fetch = await run('git fetch', cwd);
  if (looksLikeGitMissing(fetch.error)) {
    const msg = '未检测到 git 命令,请先安装 Git 并加入 PATH。';
    output.appendLine(fetch.error.message);
    vscode.window.showErrorMessage(msg);
    return;
  }
  if (fetch.stderr.trim()) output.appendLine('[git fetch]\n' + fetch.stderr.trim());

  // 3) git status —— 本地/远程版本差异 + 文件改动信息
  const status = await run('git -c core.quotepath=false status', cwd);
  const statusText = (status.stdout || status.stderr || '(无输出)').trim();
  output.appendLine('[git status]\n' + statusText);

  // 4) 展示结果
  const ts = timestamp();
  const fetchNote = fetch.stderr.trim() ? `git fetch:\n${fetch.stderr.trim()}\n\n` : '';
  const detail = fetchNote + statusText;

  // 4a) 先打开常驻的 Webview 面板(无任何按钮,按 Esc 关闭,可随时回看)
  showResultPanel(`「${name}」Git 状态`, `检查时间: ${ts}\n\n${detail}`);

  // 4b) 再弹出原生模态弹窗做即时提醒(只剩默认的"确定",无误触发风险)
  await vscode.window.showInformationMessage(`「${name}」Git 状态`, {
    modal: true,
    detail: `检查时间: ${ts}\n\n${detail}`,
  });
}

/** HTML 转义,防止内容破坏页面结构。 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 用 Webview 面板展示结果:页面里没有任何按钮,只有按下 Esc 键才会关闭。
 * 面板常驻为一个编辑器标签页,即使关掉了模态弹窗也能回看内容。
 */
function showResultPanel(title, detail) {
  const panel = vscode.window.createWebviewPanel(
    'autoGitStatusResult',
    title,
    { viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
    { enableScripts: true }
  );

  panel.webview.html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 16px;
  }
  h2 { margin-top: 0; }
  pre {
    white-space: pre-wrap;
    word-break: break-all;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    background: var(--vscode-textCodeBlock-background);
    padding: 12px;
    border-radius: 4px;
  }
  .hint { opacity: 0.7; margin-bottom: 12px; }
</style>
</head>
<body tabindex="0">
  <h2>${escapeHtml(title)}</h2>
  <div class="hint">按 Esc 键关闭此窗口</div>
  <pre>${escapeHtml(detail)}</pre>
  <script>
    const vscodeApi = acquireVsCodeApi();
    // 让页面获得焦点,确保能捕获按键
    window.focus();
    document.body.focus();
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        vscodeApi.postMessage({ type: 'close' });
      }
    });
  </script>
</body>
</html>`;

  panel.webview.onDidReceiveMessage((message) => {
    if (message && message.type === 'close') {
      panel.dispose();
    }
  });
}

async function runAll() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showWarningMessage('当前没有打开任何项目文件夹。');
    return;
  }
  for (const f of folders) {
    try {
      await checkFolder(f);
    } catch (e) {
      output.appendLine('处理出错: ' + (e && e.message ? e.message : String(e)));
    }
  }
}

function activate(context) {
  output = vscode.window.createOutputChannel('Auto Git Status');
  context.subscriptions.push(output);

  context.subscriptions.push(
    vscode.commands.registerCommand('autoGitStatus.run', runAll)
  );

  // 启动时自动执行(可在设置中关闭)
  if (vscode.workspace.getConfiguration('autoGitStatus').get('runOnStartup', true)) {
    runAll();
  }
}

function deactivate() {}

module.exports = { activate, deactivate };
