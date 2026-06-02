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

  // 弹出原生模态弹窗做即时提醒(只剩默认的"确定",无误触发风险)
  await vscode.window.showInformationMessage(`「${name}」Git 状态`, {
    modal: true,
    detail: `检查时间: ${ts}\n\n${detail}`,
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
