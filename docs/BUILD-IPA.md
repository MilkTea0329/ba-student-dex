# 出 ipa 全流程（Windows，无需 Mac）

> 原理：GitHub 免费提供 **macOS 构建机**。把仓库推上去，Actions 会自动用 Xcode 编译并打包出未签名 `StudentDex.ipa`；
> 你在 Windows 上用 **Sideloadly** 填自己的 Apple ID 重签名，装进 iPhone。
> 全流程 20 分钟左右，其中你只需要做「建仓库 → 推代码 → 点运行 → 下载 → 签名安装」。

---

## 0. 准备

| 需要 | 说明 |
| --- | --- |
| GitHub 账号 | 免费注册 <https://github.com/signup> |
| Git | 本机已装（`C:\Program Files\Git`，版本 2.53） |
| iTunes | 微软商店搜索「iTunes」安装（Sideloadly 需要它的驱动） |
| Sideloadly | <https://sideloadly.io/> 下载 Windows 版 |
| Apple ID | 任意免费账号即可（不需要 99 美元的开发者账号） |

本仓库**已经执行过 `git init` 并完成了首次提交**，你不需要再做任何初始化。

---

## 1. 在 GitHub 上建一个空仓库

1. 打开 <https://github.com/new>
2. **Repository name** 填 `ba-student-dex`（名字随意）
3. 选 **Private** 或 Public 都行（Private 的 Actions 每月有 2000 分钟免费额度，本项目一次构建约 2–3 分钟）
4. ⚠️ **不要**勾选 “Add a README file / .gitignore / license”，保持空仓库
5. 点 **Create repository**，复制页面上显示的仓库地址，形如
   `https://github.com/你的用户名/ba-student-dex.git`

---

## 2. 把本目录推上去

**方式一（推荐，双击即可）**：双击项目根目录里的 **`push-to-github.bat`**，
把第 1 步复制到的仓库地址粘进去，回车。脚本会自动配好远程仓库并推送。

**方式二（手动）**：在 **PowerShell** 里依次执行（把地址换成你自己的）：

```powershell
cd C:\Users\weijunjie\Documents\gamekeedsh

git remote add origin https://github.com/你的用户名/ba-student-dex.git
git branch -M main
git push -u origin main
```

- 第一次 push 会弹出一个 **浏览器登录窗口**（Git Credential Manager），登录 GitHub 并点 Authorize 即可；
  没有弹窗的话，去 <https://github.com/settings/tokens> 生成一个带 `repo` 权限的 Personal Access Token，把它当密码填进去。
- 仓库约 **150 MB、9000 多个文件**，上行 10 Mbps 的话大概 2–3 分钟，请耐心等待，中途不要关窗口。
- 最后一行出现 `branch 'main' set up to track 'origin/main'` 就成功了。

> 如果提示 `remote origin already exists`，说明之前加过，改用：
> `git remote set-url origin https://github.com/你的用户名/ba-student-dex.git`

---

## 3. 等 GitHub 编译出 ipa

推送完成后 **会自动开始**；也可以手动触发：

1. 打开仓库页面 → 顶部 **Actions** 标签
2. 左侧选 **Build unsigned IPA** → 右侧 **Run workflow** → 绿色按钮
3. 点进这次运行，看步骤依次变绿：
   `Checkout → Sanity check → Install XcodeGen → Generate project → Build app → Package IPA → Upload IPA`
4. 全程约 **3–5 分钟**（首次要装 XcodeGen，会久一点）

---

## 4. 下载 ipa

运行页面底部 **Artifacts** 区域 → 点 **StudentDex-unsigned-ipa** → 得到一个 zip：

```
StudentDex-unsigned-ipa.zip
└── StudentDex.ipa        ← 这就是你要的文件
```

解压出来即可（Windows 自带的解压就行）。

---

## 5. 用 Sideloadly 装进 iPhone

1. iPhone 用数据线连电脑，手机上点「信任此电脑」
2. 打开 **Sideloadly**，顶部 **iOS Device** 选中你的 iPhone
3. 把 `StudentDex.ipa` **拖进** Sideloadly 窗口（或点 IPA 图标选择文件）
4. **Apple ID** 填你的 Apple 账号
   - 开了双重认证也没关系，Sideloadly 会提示你到 <https://appleid.apple.com> 生成一个 **App 专用密码**，填那个密码
5. 点 **Start**，等进度条走完（1–3 分钟，期间手机会有安装提示）
6. 手机上打开 **设置 → 通用 → VPN与设备管理 → 开发者 App → 你的 Apple ID → 信任**
7. 回桌面打开「学生图鉴」✅

**iOS 16 及以上还需要**：设置 → 隐私与安全性 → **开发者模式** → 打开 → 重启手机。

---

## 6. 常见问题

| 现象 | 处理 |
| --- | --- |
| Actions 红叉，`Generate project` 失败 | 下载 Artifacts 里的 **build-log**，把日志发我，我改工程配置 |
| Actions 红叉，`Build app` 失败 | 同上；大概率是 Swift 代码或工程配置问题，我按报错修 |
| Sideloadly 报 `Provision.cpp:150` / 无法创建证书 | 换一个 Apple ID 再试，或先在 <https://appleid.apple.com> 生成 App 专用密码 |
| 打开 App 提示「未受信任的开发者」 | 步骤 6 的「信任」没做 |
| 打开 App 提示「无法验证 App」 | 手机没联网时首次打开会这样，连网后重开 |
| 7 天后打不开 | 免费签名只有 7 天。重新用 Sideloadly 装一次即可（**收藏数据会清空**，因为重装等于删 App） |
| 想自动续签 | 用 **AltStore / SideStore**（电脑装 AltServer，同一 Wi-Fi 下自动刷新签名） |
| 永久安装 | 系统在 **iOS 14.0–16.6.1 / 17.0** 且可装 **TrollStore** 的话，可以直接装这个 ipa，无需签名、无 7 天限制 |

---

## 7. 备选：有 Mac 的话更快

```bash
brew install xcodegen
cd ba-student-dex && ./build-ipa.sh
# 产物：StudentDex/StudentDex.ipa
```

或者直接双击打开工程，用自己的 Apple ID 连真机运行：

```bash
cd StudentDex
xcodegen generate
open StudentDex.xcodeproj
```

---

## 8. 仓库里都提交了什么

- `StudentDex/`：XcodeGen 工程定义 + Swift 源码 + **已打包好的 44 MB 离线资源**（网页、281 张头像、511 张立绘、2190 个图标）
- `web/`：同一套前端，可用 `python -m http.server 8123 --directory web` 在浏览器里预览
- `data/build/`：解析好的 281 份学生 JSON + 图片素材
- `crawl/`：爬取与解析脚本（学生实装更新后重新生成数据用）
- `.github/workflows/build-ipa.yml`：就是它帮你编译出 ipa
