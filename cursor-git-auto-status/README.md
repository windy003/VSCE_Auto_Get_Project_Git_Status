# Auto Git Status

打开 Cursor / VS Code 项目时,自动在项目根目录执行 `git fetch && git status`,
并以弹窗形式展示**本地与远程的版本差异**及**文件改动信息**。
如果项目不是 git 仓库(没有 `.git`),弹窗提示「本项目不是git项目」。

## 功能

- 启动后自动执行(打开多个工作区文件夹时逐个检查)。
- 弹窗展示 `git status` 结果(分支领先/落后、未提交文件等)。
- 非 git 项目给出明确提示。
- 命令面板可手动重跑:`Auto Git Status: 立即执行 git fetch && status`。

## 设置

| 设置项 | 默认 | 说明 |
| --- | --- | --- |
| `autoGitStatus.runOnStartup` | `true` | 打开项目时是否自动执行 |
| `autoGitStatus.useModal` | `true` | `true`=模态弹窗;`false`=右下角通知 |

## 安装方式

### 方式 A:调试运行(最快验证)

1. 用 Cursor 打开本插件文件夹 `cursor-git-auto-status`。
2. 按 `F5`,会弹出一个「扩展开发宿主」窗口。
3. 在该新窗口里打开任意项目,即可看到弹窗效果。

### 方式 B:打包成 .vsix 长期安装

需要 Node.js 环境,在插件文件夹下执行:

```powershell
npx @vscode/vsce package
```

会生成 `auto-git-status-0.0.1.vsix`。然后在 Cursor 中安装:

- 命令面板(`Ctrl+Shift+P`)→ `Extensions: Install from VSIX...` → 选择该文件;
- 或命令行:`cursor --install-extension auto-git-status-0.0.1.vsix`

安装后重启 Cursor,打开任意项目即可自动触发。

## 说明

- 仅依赖系统已安装的 `git`(需在 PATH 中);未安装会提示。
- 不读取/上传任何远程数据,`git fetch` 仅访问你项目自身配置的远程仓库。
