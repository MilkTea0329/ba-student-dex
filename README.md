# 蔚蓝档案 · 学生图鉴（iOS / ipa）

一个可以**离线查询**《蔚蓝档案》全部 281 名实装学生详细资料的 iPhone 应用：
基础档案、技能（逐级查看）、属性数值、专武 / 爱用品、养成材料、学生资料、语音台词、立绘。

数据全部爬取自 **GameKee 蔚蓝档案 WIKI** 的「游戏图鉴 · 实装学生」页面：
<https://www.gamekee.com/ba/second/23941>

> 收录 **281 名学生 / 16 所学院 / 511 张立绘 / 2190 个图标**，全部离线打包，安装后无需联网。

<p align="center">
  <img src="docs/screenshots/list.png" width="250" alt="学生列表">
  <img src="docs/screenshots/detail.png" width="250" alt="学生详情">
  <img src="docs/screenshots/skills.png" width="250" alt="技能">
</p>
<p align="center">
  <img src="docs/screenshots/stats.png" width="250" alt="属性">
  <img src="docs/screenshots/filter.png" width="250" alt="筛选">
  <img src="docs/screenshots/schools.png" width="250" alt="学院">
</p>

---

## 1. 功能一览

| 模块 | 内容 |
| --- | --- |
| **学生** | 281 名学生网格卡片，支持按名称 / 别名（日文名、英文名、外号）/ 学院 搜索 |
| **筛选** | 稀有度、学院、攻击类型、防御类型、站位、作用、战术作用、武器 —— 8 个维度多选组合 |
| **排序** | 实装日期（新→旧）/ 名称 / 稀有度 |
| **学院** | 按 16 所学院分组浏览，点进去即筛选出该学院学生 |
| **收藏** | 心形收藏，本地保存（localStorage / App 内持久化） |
| **详情 · 概览** | 一句话简介、基础信息 10 项、地形适应（市街/屋外/屋内）、角色评测（综合评分 + 6 种玩法评级）、就业场合、抽取建议、技能速览 |
| **详情 · 技能** | EX / 普通 / 被动 / 辅助 / 子技能，**逐级滑动查看 LV1–LV10 描述与 COST**，技能升级材料表 |
| **详情 · 属性** | 初始 → 满级对照表（含成长差值）、装备词条、专武数值表、能力解放、羁绊等级奖励 |
| **详情 · 养成** | 专武（名称/描述/★2 强化技能/★3★4 解锁）、爱用品（T1/T2）、材料表 |
| **详情 · 资料** | 全名、假名、繁/简译名、年龄、生日、身高、兴趣、画师、声优（日/中/韩）、简介、礼物偏好、情人节巧克力、同名角色、原始出处 |
| **详情 · 语音** | 按「通常 / 大厅及咖啡馆 / 好感度 / 战斗 / 成长 / 事件」分类的日文原文 + 中文翻译 |
| **详情 · 立绘** | 每名学生的多张立绘（默认 / 睡衣 / 受伤 等） |

深色模式跟随系统，已适配刘海与 Home Indicator 安全区。

<p align="center"><img src="docs/screenshots/dark.png" width="250" alt="深色模式"></p>

---

## 2. 目录结构

```
.
├── StudentDex/                 # iOS 工程
│   ├── project.yml             # XcodeGen 工程定义（唯一的工程配置来源）
│   ├── Sources/                # Swift 源码（SwiftUI + WKWebView 外壳）
│   └── Resources/
│       ├── Assets.xcassets     # App 图标 / 启动背景
│       └── Web/                # 打包进 App 的离线网页资源（index.html / data.js / 图片）
├── web/                        # 同一套前端（可直接用浏览器打开预览）
├── crawl/                      # 数据管线（爬取 → 解析 → 打包）
├── tools/                      # 截图工具（CDP 驱动 Chrome）
├── data/
│   ├── raw/                    # 每名学生的原始表格（570 行结构化单元格）
│   └── build/                  # 解析后的 students/*.json、头像、图标、立绘
├── .github/workflows/build-ipa.yml   # 云构建未签名 ipa
└── build-ipa.sh                # macOS 本地一键构建
```

---

## 3. 三种使用方式

### 方式 A：立刻在 iPhone 上试用（无需签名，1 分钟）

在你的 Windows 电脑上启动一个局域网静态服务器：

```powershell
cd <本项目目录>
python -m http.server 8123 --directory web
```

记下电脑的局域网 IP（`ipconfig` 里的 IPv4，例如 `192.168.1.20`），
iPhone 连同一个 Wi-Fi，用 **Safari** 打开 `http://192.168.1.20:8123/`，
然后点「分享 → 添加到主屏幕」—— 就会得到一个有图标、全屏运行、和 App 一模一样的入口。

> 数据、头像、技能图标、立绘全部是本地文件，断网也能正常使用。

### 方式 B：生成真正的 ipa（推荐，无需 Mac）

仓库内置 GitHub Actions 工作流，会把未签名 ipa 作为构建产物输出：

1. 把本目录推到你自己的 GitHub 仓库；
2. 打开仓库的 **Actions → Build unsigned IPA → Run workflow**；
3. 等 3–5 分钟，在该次运行的 **Artifacts** 里下载 `StudentDex-unsigned-ipa`，解压得到 `StudentDex.ipa`。

### 方式 C：在 Mac 上本地构建

```bash
brew install xcodegen       # 只需一次
./build-ipa.sh              # 生成 StudentDex/StudentDex.ipa
```

也可以直接用 Xcode 打开：`cd StudentDex && xcodegen generate && open StudentDex.xcodeproj`，
选择自己的 Apple ID 团队，连上 iPhone 运行（免费账号 7 天有效期）。

---

## 4. 在 Windows 上安装到 iPhone

ipa 是**未签名**的，需要用你自己的 Apple ID 重新签名后安装（免费，无需开发者账号）：

| 工具 | 说明 |
| --- | --- |
| **Sideloadly**（推荐） | Windows 原生支持，需先装 iTunes（微软商店版即可）。打开 Sideloadly → 拖入 `StudentDex.ipa` → 填 Apple ID → Start，按提示在 iPhone「设置 → 通用 → VPN与设备管理」里信任证书 |
| **AltStore / SideStore** | 装一次 AltServer，之后可以无线续签，7 天到期自动刷新 |
| **TrollStore** | 系统版本支持的情况下可永久安装，无需续签 |

> 免费 Apple ID 签名的 App 有效期为 7 天，到期后用同一工具重新安装即可；收藏数据保存在 App 内，重装会清空。

---

## 5. 数据是怎么来的

GameKee 的图鉴页面是 Vue 单页应用，数据通过接口下发：

1. `GET /v1/wiki/entry`（请求头 `game-alias: ba`）拿到词条树，
   `游戏图鉴(23941) → 实装学生(49443)` 下挂着 281 名学生，每人有独立的 `content_id`；
2. `GET /v1/content/detail/{content_id}` 拿到详情元信息与 `content_cdn`；
3. `GET content_cdn`（需 `Referer: https://www.gamekee.com/`）拿到**表格模板 JSON**，
   每名学生固定 570 行 × 8 列的单元格，含文本/图片两种单元格；
4. `crawl/parse.js` 按行号 + 行标签（`isGlobal` 标记）把表格解析成结构化字段；
5. 头像 / 技能图标 / 材料图标 / 立绘下载后按内容哈希去重、缩放、打包进 App，
   **10516 个图片 URL 去重后只剩 2190 个文件**。

重新抓取（学生实装更新后）：

```bash
node crawl/crawl.js        # 抓取全部学生原始表格（约 3 分钟）
node crawl/parse.js        # 解析
python crawl/avatars.py    # 头像
python crawl/images.py     # 技能/材料图标（增量，已有缓存会跳过）
python crawl/portraits.py  # 立绘
node crawl/build_web.js    # 生成 web/data.js
node tools/sync_web.js     # 同步进 iOS 工程资源
```

---

## 6. 技术说明

- **外壳**：SwiftUI `App` + `UIViewRepresentable` 承载 `WKWebView`，
  用 `loadFileURL(_:allowingReadAccessTo:)` 加载打包在 App 内的 `Web/index.html`，
  完全离线；外部链接用 `UIApplication.open` 交给 Safari。
- **安全区**：`ShellWebView` 在 `safeAreaInsetsDidChange` 时把原生 insets 写进 CSS 变量
  `--safe-t / --safe-b`，配合 `viewport-fit=cover`，刘海与 Home Indicator 都不会遮挡内容。
- **前端**：零依赖的原生 JS + CSS，`web/data.js` 一次性把 281 名学生的结构化数据注入
  `window.BA_STUDENTS`（约 5.6 MB），无需 `fetch`，因此 `file://` 下也能正常工作。
- **图片**：头像 320×360 JPEG、立绘 420px JPEG、图标 64–96px PNG（量化压缩），
  全部随包，不依赖任何网络请求。
- **自适应**：3 列网格 → 宽屏 4/5 列；深色模式通过 `prefers-color-scheme` 自动切换。

---

## 7. 免责声明

本项目为玩家自制的非官方资料查询工具，与 NEXON Games / Yostar 无任何关联。
学生资料、立绘、语音文本版权归原公司及 GameKee WIKI 贡献者所有，
数据仅用于学习与交流，请勿用于商业用途。
