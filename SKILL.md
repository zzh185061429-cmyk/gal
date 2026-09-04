---
name: galgame-frontend-kit
description: 从零新建「幻璃镜式」galgame 楼层剧本前端新项目 —— SillyTavern 酒馆助手（TavernHelper/JS-Slash-Runner）iframe 内嵌 React 单文件应用的通用方法论：AI↔前端剧本协议设计、楼层三态与生成生命周期事件锁、MVU 变量接入与静默降级、打字机/立绘/伪全屏/iframe 守卫演出层、Web Audio 程序化音效与 BGM、天气与昼夜时段引擎、可选随机池图引擎、多角色日程与空闲地点池加权随机、游戏内小手机（私聊/朋友圈/论坛副API社交模拟）、幂等世界书写入、批量生图与图床资产管线、webpack 单文件构建与界面正则/CDN 交付、新项目最小可玩决策清单。凡用户提到 新建/做一个 galgame 前端、视觉小说前端、楼层剧本播放器、把 ST 角色卡做成可播放前端、设计楼层剧本协议、新建界面项目、天气/昼夜/时段系统、角色日程/随机地点/地点池/谁在哪、游戏内手机/微信/朋友圈/论坛/群聊，或从零搭一套打字机/立绘/选项演出时使用。维护或修改幻璃镜本体请改用 mirage-galgame-frontend。本 skill 自带全部知识（蒸馏自幻璃镜与租借男友两个实战项目），不依赖任何项目源码，适用于任意工作区。
---

# Galgame 楼层剧本前端 · 新建项目套件

> 版本 2026-09-04 r5 炼化（r3：双项目蓝本溯源入册、API 基准日与时效协议、路由自检、存在性探针、统一视图变体弃置；r4：公开发布——StageDog 模板直链、MIT 许可证、git 更新渠道；r5：功能方法论范围声明入册、backdrop-filter 禁令收窄为大面积常驻叠层、官方仓库地址修正为 `gal`）· 自包含可分发：整目录（SKILL.md + references/ + LICENSE）拷入 `~/.agents/skills/` 即可在任意机器/工作区生效，无外部依赖；官方副本 `https://github.com/zzh185061429-cmyk/gal`（更新：目录内 `git pull`）。

从零新建一套 galgame 楼层剧本前端：SillyTavern 酒馆助手（TavernHelper/JS-Slash-Runner）iframe 内嵌的 React 单文件应用，把 AI 的楼层文本变成可播放的视觉小说——剧本解析、逐行演出、选项交互、变量收账、构建交付。本 skill 的知识**自带、自包含**，蒸馏自两个实战项目（蓝本溯源见下节），不依赖任何项目源码；文中 `<项目名>` 是你的新项目名占位符。

分工边界：

- **新建** galgame / 视觉小说式前端项目 → 用本 skill。
- **维护/修改幻璃镜本体**（探案业务、邪异池、黄历等具体项目内容）→ 改用 `mirage-galgame-frontend`，那里的知识绑定该项目源码。
- **视觉/审美方向指导**（构图层级、CJK 排版工艺、动效论点、界面美术风格）→ 不在本套件范围。本 skill 的价值集中在**功能性**问题：宿主生命周期时序、数据一致性、交付运维——这些坑无法从文档推理，只能从实战项目蒸馏。它提供视觉工作的**机制地基**（语义色板、z 层令牌、reduced-motion 兜底），不提供审美判断；美术方向请另配设计参考或前端审美 rubric 类资源。

## 蓝本溯源（知识从哪来）

| 子系统 | 蓝本 | 备注 |
|---|---|---|
| 剧本协议/解析、事件层、MVU | 幻璃镜 + 租借男友 双源 | 两项目各自实现并真机运行，协议与状态机取交集的稳定形态 |
| 小手机（phone-ui） | 租借男友（单源） | 11 App / 69KB PhoneContext 的成熟实现 |
| 角色地点池、时段天气引擎 | 租借男友蓝本 | 各文档标注「租借男友验证过」；幻璃镜后吸收 |
| 音频 SFX | 双源同血缘 | 知识自租借男友流入幻璃镜 |
| iframe 守卫/伪全屏、交付管线 | 幻璃镜（单源） | |
| 锁定前端、界面正则交付 | 双项目验证 | 交付层最有价值的两件（delivery.md §3/§8） |

跨栈证据：租借男友出身 Vite/AI Studio 栈，最终经同一 webpack 单文件管道交付（dist 产物同构）——方法论换栈存活，是「可携带」的实证。已评估弃置的变体：统一视图（单 iframe 覆盖全部楼层、隐藏原生楼层）——无价值，不纳入，勿再提议吸收。

## 自检协议

- **路由自检（每次动工第一句）**：确认本任务是「新建前端项目」。实为幻璃镜本体维护 → 转 `mirage-galgame-frontend`；只查一个 ST API 签名 → `sillytavern-api-reference` 更对口。
- **API 基准日**：2026-09-04（SillyTavern 1.18.0 + 当期酒馆助手/MagVarUpdate）。宿主任一方升级 → 重验相关章节；无升级信息时 6–12 个月兜底重验。
- **核验链**：装有 `sillytavern-api-reference` skill → 交叉核验签名；未装 → 人工对照酒馆助手/MVU 仓库更新日志。二者皆为可选增强——硬依赖会破坏自包含声明。
- **存在性探针**：`references/api-probe.md`——新项目动工第一天与宿主升级后必跑；其 §3 证据边界（存在 ≠ 行为契约）必须随探针一起读。

## 一图流：这套系统是什么

```
AI 楼层文本（含 <content> 剧本 / 变量更新块 / 控制标签）
   │ 酒馆正则把整楼替换成代码块 → 酒馆助手提升为 iframe
   │ iframe 内 $('body').load(CDN 上的单文件 index.html)  ← webpack 打包的 React 应用
   ▼
React App（GameContext 统一监听酒馆事件，只向 UI 广播 4 个信号）
   │ getChatMessages(楼层号) → scriptParser 纯函数解析 → ScriptLine[]
   ▼
逐行播放（打字机/立绘/背景CG）→ 选项/输入 → triggerSlash('/send'+'/trigger await=true')
   │ 酒馆生成 → MESSAGE_RECEIVED / MESSAGE_UPDATED / iframe_events.GENERATION_ENDED
   ▼
新楼层 → viewingFloorId(null) 解锁 → 重新解析 → 闭环
   └ 侧路注入：天气/时段、角色位置表、场景扰动 —— GENERATION_AFTER_COMMANDS + injectPrompts(once) 喂给 AI
```

三条架构铁律（照做能避开 80% 的坑）：

1. **事件与渲染解耦**：所有酒馆事件监听收进一个 Provider（GameContext），只向 UI 输出 `lastAssistantFloorId` / `generatingFloorId` / `isGenerating` / `storyVersion` 四个信号；播放屏对事件零感知，拿到楼层号后用 `getChatMessages` 拉正文做纯函数解析。
2. **楼层即存档**：剧本文本、绑定关系、业务进度全部落在楼层文本或聊天变量（`getVariables`/`updateVariablesWith`）里；前端 state 只是派生缓存，切聊天/刷新靠 `CHAT_CHANGED` 重建。
3. **前端不解析变量更新**：MVU 框架负责解析 AI 的更新块并落盘；前端只读结果和做夹逼收账（在 `VARIABLE_UPDATE_ENDED` 事件内直接改写传入的 variables）。

## 新建项目流程

### 第 0 步：过决策清单（最重要，砍功能的判断在这里做）
九个决策点：叙事形态 / 图资产 / 音频 / 变量 / 天气与昼夜 / 多角色位置 / 小手机 / 世界书写入 / 交付方式 + v1 最小可玩范围冻结。→ `references/new-project-checklist.md`

### 第 1 步：选模板建骨架
用 StageDog `tavern_helper_template`（GitHub 公共模板：https://github.com/StageDog/tavern_helper_template ，点右上角 Use this template 建仓）。在 `src/yaoguai/<项目名>/` 下建 `index.html`（空壳 `#root` + 字体）+ `index.tsx`（React 入口，`$(() => …)` 包裹，`pagehide` 卸载）。webpack 自动发现入口并构建到 `dist/yaoguai/<项目名>/index.html`（单文件内联 JS+CSS）。→ `references/delivery.md` §1-2

### 第 2 步：先定 AI↔前端协议（整个系统的合同）
楼层可播内容包 `<content>` 标签；剧本行格式（`角色[情绪]:"台词"` / 独白 / 旁白）；隐形控制行；选项 `<options>`；思维链剥离标签清单。协议要宽容解析（中英文键、大小写不敏感、缺标签降级全文）。→ `references/script-protocol.md`

### 第 3 步：事件生命周期与楼层状态机
`viewingFloorId` 三态模型（null=跟随最新）；生成锁（startGenerating 锁画面 → GENERATION_ENDED → finishGenerating 解锁）；三处防抖（流式不 bump、同层正文未变保进度、双路径生成结束）。→ `references/architecture.md`。接线前先跑 `references/api-probe.md` 确认宿主 API 面未漂移。

### 第 4 步：变量系统（MVU）
挂 MVU bundle 一行 import + Zod schema 脚本，世界书放 `[initvar]`/`[mvu_update]` 条目。前端封装适配层：就绪探测（带超时）、读 stat_data、种子写入、数值夹逼、事件订阅。**MVU 缺席时全部静默降级，前端绝不崩**。→ `references/mvu.md`

### 第 5 步：演出层
打字机（rAF+时间累积，React.memo 隔离重渲染）、多立绘同屏（最多 3 人、情绪换图不换 key）、背景 CG 查表、伪全屏（父页 jQuery 隐藏兄弟楼层 + fixed 定位）、iframe 高度守卫（ResizeObserver+MutationObserver，事件驱动非暴力轮询）。→ `references/frontend-playbook.md`

### 第 6 步：天气与昼夜（建议默认子系统）
昼夜/时段流逝感几乎所有卡都需要。时段天气引擎：季节概率表 + 马尔可夫链 7 日预报（存聊天变量）+ 确定性突变（日期哈希种子）+ 哈希 fallback；`outdoorMultiplier` 让天气影响 NPC 行为；AI 注入当前天气/时段详情/预报；正文旁白行天气回写；视觉层半透明色块 + Canvas 粒子（**大面积常驻叠层禁 backdrop-filter**——部分浏览器 iframe 上下文白屏；小面积 backdrop-blur 可用，见坑表判据）。→ `references/weather-daynight.md`

### 第 6.5 步：游戏内日历与黄历（可选，中式世界观加分项）
真实农历/节气/建除十二神宜忌，纯本地算法零 AI API；历注三层结构（宜忌硬规则 + 值神之性 + 玩法化翻译）让黄历成为 AI 可执行的行动指令系统；昼夜判定可升级为按节气日出日入漂移。→ `references/weather-daynight.md` §12

### 第 7 步：音频系统（可选）
零音频文件：SFX 引擎用 Web Audio API 程序化合成（UI 音效集 + 打字 blip——按说话人名字哈希确定性定调）；AudioContext 必须等首次用户交互再创建；BGM 悬浮播放器吃直链曲库；设置走 pub-sub store + useSyncExternalStore + localStorage。→ `references/audio.md`

### 第 8 步：随机池图引擎（可选）
幂等绑定（实例名为主键，已有绑定不重抽）+ 洗牌袋去重（全用尽才重洗）+ 属性硬约束（身份类约束永不放宽，宁可不配图）。人物池=先演后配按标签属性抽；地点池=先抽后演回注气质。确定性随机用 LCG 种子。→ `references/random-pools.md`

### 第 9 步：角色地点池（多角色卡建议）
「谁在哪」自洽：三层位置模型（正文覆盖 > 日历/天气覆盖 > 核心日程 > 空闲地点池 > 兜底）；空闲池按权重随机（时段过滤、串门校验、假期/天气降权、种子=角色+日期+小时 同刻稳定）；只注入 WHERE 不注入 WHAT。→ `references/character-locations.md`

### 第 10 步：小手机（可选）
游戏内设备 UI：悬浮球（拖拽吸附/未读红点）→ 壳（状态栏+App 网格懒加载）→ App；三层持久化（配置→角色卡变量 / 内容→聊天变量 / UI→localStorage）；副API 社交模拟（角色主动私聊/朋友圈/论坛/群聊，不占主线楼层）；聊天历史压缩 + 世界书条目同步。→ `references/phone-ui.md`

### 第 11 步：前端驱动的世界书写入（可选）
状态快照条目（单条目幂等翻页，没变零开销）；业务条目蓝灯常驻→完结转绿灯加关键词；`updateWorldbookWith` 串行执行防互覆；重写时用模板归一托管字段实现自愈。→ `references/worldbook-write.md`

### 第 12 步：美术资产管线（可选）
几百张图不手写：批量生图工具出图 → 图床上传（manifest 记 URL）→ 生成器脚本把 manifest 转成 `src/data/*.ts` → 打包。数据文件是生成产物勿手改；「删图重跑还是同一张图」切 Chat API 端点。→ `references/asset-pipeline.md`

### 第 13 步：构建与交付
界面正则 JSON（`findRegex:/[\s\S]*/s` + `placement:[2]` + `markdownOnly:true` + 代码块包 `<body><script>$('body').load(CDN)</script></body>`）；脚本类 JSON（id 用固定 UUID 覆盖更新）；本地开发正则（disabled，指向 localhost）；发布两条路——CI 自动构建提交 dist，或手动发布器快推 + purge 刷缓存；可选锁定前端脚本（父页原型拦截防 iframe 销毁）。→ `references/delivery.md`

## 常见坑速查（反复碰壁的地方）

| 症状 | 原因与正解 |
|---|---|
| 播放位置莫名跳回第 0 行 | 流式生成期 `MESSAGE_UPDATED` 携带新楼层号时 bump 了 storyVersion；仅当被更新的正是锁定中的楼层时才刷新 |
| 世界书条目内容互相丢失 | 并发调 `updateWorldbookWith` 读改写互覆；串行 `.then()` 链执行 |
| 收账夹逼不生效/拿到旧值 | 在 `VARIABLE_UPDATE_ENDED` 回调里用 `getMvuData` 重读；应直接改写传入的 variables，框架随后落盘 |
| 退出全屏后 iframe 高度错乱 | 全屏改了父页内联样式，退出后未恢复；用 burst（3 次×100ms）修复竞态，事件驱动守卫常驻 |
| 手机检测误判 | iframe 里 `matchMedia` 测的是 iframe 视口；需 localStorage 手动覆盖开关兜底 |
| 白屏/CSP 报错/react hook 报错 | react/react-dom 被外链导致双实例；webpack 中强制打包（勿 external） |
| 封面/渐变/标签色静默失效（无报错、无日志） | 把 Tailwind 裸类名当 CSS 色值写（style 或 linear-gradient 里出现 `bg-ink-900`）；类名不是色值，用 @theme 语义变量 `var(--color-ink-900)` |
| 楼层正文解析为空 | AI 输出没包 `<content>` 标签；解析器应降级为"剥思维链后全文" |
| 重生成后楼层闪烁/消失 | 删楼重建；应 `generate + setChatMessages` 原位替换 + 自定义事件刷新 |
| 发新版用户不更新 | URL 用 `@master` 有 CDN 缓存；发布时打 tag、或引导用户重导入；换仓库名可强刷 |
| 切聊天后数据错乱 | 未监听 `CHAT_CHANGED` 重建 state；聊天变量读取失败要 try/catch 返回 null |
| 点了页面没声音 | AudioContext 被自动播放策略拦了；必须等首次 pointerdown/keydown 再创建，且每次播放前守卫 ctx 为空静默跳过 |
| BGM 不出现 | 曲库 TRACKS 数组为空时挂件整个不渲染（设计行为）；填直链自动出现 |
| 生图删图重跑还是同一张图 | Images API 被中转站缓存；切 Chat API 端点模式 |
| 发了新版玩家没拿到 | CDN 缓存；purge.jsdelivr.net 逐文件刷新或等 12h；确认 JSON 里 URL 指向的仓库/分支对 |
| src/data/*.ts 里的图 URL 手改后被覆盖 | 这些文件是生成器产物；要改图走生图工具上传 + 重跑生成器 |
| 天气特效和 AI 看到的天气对不上 | 只改了渲染状态没写回预报缓存；突变/扰动必须 setCurrentPeriodWeather 落预报，所有消费方统一走 getWeather() |
| 天气视觉用 backdrop-filter 白屏 | 禁的是**大面积常驻叠层**（全屏天气层/粒子容器），部分浏览器 iframe 上下文白屏——换半透明色块 + Canvas 粒子；小面积 backdrop-blur（文本框、弹窗遮罩）两蓝本项目真机长期使用无恙。判据 = 层面积 × 常驻时长，不是属性本身 |
| 黄历宜忌同一天两次打开内容不一样 | 用随机抽宜忌；应用建除十二神（日支与月支关系确定性定神）或确定性种子 |
| 节气/农历日期差一天 | 用了固定近似日期表；节气每年漂移需天文公式按年算（寿星公式），农历用 lunarInfo 查表（1900-2100） |
| 冬天傍晚场景还是白昼 CG | 昼夜判定固定 6/18 点；按节气日出日入表漂移（冬至约 17 点已入夜，夏至 19 点仍是昼） |
| 列表每操作一次整体重渲染卡顿 | 列表项未提取 memo 子组件，或给 memo 子组件传了内联函数/对象（每次新引用击穿 memo） |
| 地点随机每次刷新都变 / 全员齐跳 | 种子必须同时含角色+日期+小时（缺小时全天不变，缺角色全员同刻跳）；权重修正生成新数组不改原数据 |
| 访客出现在主人不在家的住所 | 串门条目在加权前过滤；主人被正文 override 时视为不在家；先预计算主人在家表（skipVisitSpots 防递归）再逐角色选位 |
| 探针在主页面 console 全红 | TavernHelper 函数注入在 iframe，主页面 `window` 上没有——不是漂移；切到 iframe 语境重跑（api-probe.md §1） |

## 参考文档索引

| 文件 | 内容 |
|---|---|
| `references/new-project-checklist.md` | 开工前决策清单：九个决策点、v1 冻结范围、子系统启用时机、阶段验收门 |
| `references/script-protocol.md` | 剧本协议设计指南：行格式正则、控制行、选项、思维链剥离、宽容解析、自定义扩展规范 |
| `references/architecture.md` | 总架构：事件生命周期状态机、楼层三态、发送/重生成完整链路、TavernHelper API 用法清单 |
| `references/api-probe.md` | TavernHelper API 存在性探针：运行语境陷阱、判读规则、基准快照 |
| `references/mvu.md` | MVU 接入全案：bundle 挂载、Zod schema、世界书契约、前端适配层、降级链 |
| `references/frontend-playbook.md` | React 演出层实现：入口守卫、iframe 守卫、伪全屏、打字机、立绘、移动端、CSS 设计系统 |
| `references/weather-daynight.md` | 时段天气引擎：昼夜/时段、季节概率、马尔可夫 7 日预报、确定性突变、正文回写与 AI 注入、视觉叠层；岁时历（真实农历/节气/黄历宜忌/节气日出日入，§12） |
| `references/audio.md` | 音频子系统：SFX 合成引擎（UI 音效/打字 blip/情绪音效）、pub-sub 设置层、BGM 播放器 |
| `references/random-pools.md` | 随机池图引擎：幂等绑定、洗牌袋、属性放宽候选链、tier 型地点池、确定性随机 |
| `references/character-locations.md` | 角色地点池：三层位置模型、空闲池加权随机五步修正链、串门校验、位置表 AI 注入 |
| `references/phone-ui.md` | 小手机：悬浮球+壳+App 懒加载、三层持久化、副API社交模拟、历史压缩、世界书联动 |
| `references/worldbook-write.md` | 前端写世界书：蓝/绿灯条目、单条目幂等翻页、并发串行、模板归一自愈 |
| `references/asset-pipeline.md` | 美术资产管线：批量生图、防重复出图、图床上传、生成器脚本、manifest 账本 |
| `references/delivery.md` | 构建与交付：webpack 模板机制、界面正则/脚本 JSON 字段逐解、CDN/CI、锁定前端、导入步骤 |

## 宿主环境与降级原则

- **推荐宿主模板**：StageDog `tavern_helper_template`。若当前工作区不是该模板，先按 `references/delivery.md` §10 的最小清单搭骨架再往下走。
- **浏览器裸跑降级**：所有酒馆全局函数（`getChatMessages`、`getVariables`、`eventOn`、`Mvu`…）的调用都包 try/catch，读不到时回退占位值——前端 UI 必须能在纯浏览器里预览调试，不因酒馆 API 缺席而白屏。
- **真值边界**：本地浏览器只能验收 UI/解析/交互/合成音效；iframe 提升、界面正则、MVU 落盘、世界书写入、CDN 分发只有真酒馆环境能验收——这是独立的一道门，不许用本地通过冒充真机通过。
- **宿主时效**：宿主升级或距基准日超期时，先跑 `references/api-probe.md` 再动工（见「自检协议」）。
