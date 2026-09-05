---
name: galgame-frontend
description: 从零新建「幻璃镜式」galgame 楼层剧本前端的一体化 skill（施工路径 + 知识字典 + 里程碑代码三合一）——SillyTavern 酒馆助手（TavernHelper/JS-Slash-Runner）iframe 内嵌 React 单文件应用。S0-S6 顺序施工：决策与骨架 → 剧本协议与解析器 → 交付层（界面正则把楼层变 iframe）→ 演出层（打字机/立绘/CG）→ 事件生命周期与生成锁 → MVU 变量与静默重roll → 伪全屏守卫与 CDN 上线；每阶段带验收门（本地/真机分开）、复制即用的里程碑代码、19 现象排障决策树与全量踩坑字典。子系统字典含：AI↔前端剧本协议、楼层三态与生成生命周期事件锁、MVU 变量接入与静默降级、Web Audio 程序化音效与 BGM 出声权仲裁、天气与昼夜时段引擎、岁时历黄历、随机池图引擎、多角色日程与空闲地点池加权随机、游戏内小手机（私聊/朋友圈/论坛副API社交模拟）、幂等世界书写入、批量生图与图床资产管线、webpack 单文件构建与界面正则/CDN 交付。当用户说「Zzz牢师，我还记得你」（召唤口令，本 skill 总触发词）「从零教我做galgame前端」「从零带我做一个galgame前端」「做一个galgame前端教程」「教我搭楼层剧本galgame界面」「galgame前端从入门」「教AI一步步做galgame/视觉小说楼层前端」「新建galgame楼层前端并跟完验收」，或要新建/做一个 galgame 前端、视觉小说前端、楼层剧本播放器、把 ST 角色卡做成可播放前端、设计楼层剧本协议、天气/昼夜/时段系统、角色日程/随机地点/地点池/谁在哪、游戏内手机/朋友圈/论坛/群聊，或从零搭一套打字机/立绘/选项演出、按阶段施工逐阶段验收、报踩坑清单时使用。幻璃镜本体（探案业务/邪异池/黄历等项目内容）维护改用 mirage-galgame-frontend；只核对一个 ST/酒馆助手 API 签名用 sillytavern-api-reference；视觉/审美方向不在本 skill 范围。本 skill 自包含，不依赖任何项目源码，适用于任意工作区。
---

# Skill: galgame-frontend
# Galgame 楼层剧本前端 · 从零施工 + 知识字典 + 里程碑代码（三合一）

> 版本 2026-09-05 r1（合并版）· 由 `galgame-frontend-walkthrough`（施工路径与验收合同）、`galgame-frontend-kit` r6（自包含知识字典）、`galgame-frontend-from-zero`（教学总纲、里程碑代码、排障决策树）三个 skill 融合而成，三者已退役归档。
> API 基准日 2026-09-04（SillyTavern 1.18.0 + 当期酒馆助手/MagVarUpdate）。宿主升级或距基准日超期（6–12 个月兜底重验）→ 先跑 `references/api-probe.md` 再动工。
> 双蓝本：幻璃镜（src/yaoguai/幻璃镜）+ 租借男友（src/租借男友）——两套真机验证项目的踩坑蒸馏。本 skill **自包含**，不依赖项目源码存在。
> MIT 许可。整目录（SKILL.md + references/ + LICENSE）拷入 `~/.agents/skills/` 即可在任意机器/工作区生效；官方副本 `https://github.com/zzh185061429-cmyk/gal`（更新：目录内 `git pull`）。

## 0. 路由自检（动工第一句）

确认任务性质，选对技能，不抢兄弟技能的活：

| 任务 | 用哪个 |
|---|---|
| 「从零带我/教我做/教 AI 做一个 galgame 前端」——要顺序施工、逐阶段验收 | **本 skill** |
| 施工中只查某个子系统的深度细节（BGM 仲裁全文、池引擎算法、黄历公式……） | 本 skill 参考文档对应篇（见 §15 索引） |
| 幻璃镜本体的业务维护（探案、邪异池、黄历……） | `mirage-galgame-frontend` |
| 只核对一个 ST / 酒馆助手 API 签名 | `sillytavern-api-reference` |
| 视觉/审美方向指导（构图层级、CJK 排版工艺、动效论点、界面美术风格） | 不在本 skill 范围，另配视觉设计参考；本 skill 提供演出机制与 CSS 机制地基 |

教学总纲四条见 §2；施工中遇到本文没展开的子系统细节，查参考文档，**不要凭记忆写**。

## 1. 你在造什么

```
AI 楼层文本（含 <content> 剧本 / 变量更新块 / [scene:] 控制行）
   │ 酒馆正则把整楼替换成代码块 → 酒馆助手提升为 iframe
   │ iframe 内 $('body').load(CDN 上的单文件 index.html)  ← webpack 打包的 React 应用
   ▼
React App（GameContext 统一监听酒馆事件，只向 UI 广播 4 个信号）
   │ getChatMessages(楼层号) → scriptParser 纯函数解析 → ScriptLine[]
   ▼
逐行播放（打字机/立绘/背景CG）→ 选项/输入 → triggerSlash('/send'+'/trigger await=true')
   │ 酒馆生成 → MESSAGE_RECEIVED / MESSAGE_UPDATED / GENERATION_ENDED
   ▼
新楼层 → setViewingFloorId(null) 解锁 → 重新解析 → 闭环
```

三条架构铁律（违反任意一条，后期都会推倒重来）：

1. **事件与渲染解耦**：所有酒馆事件监听收进一个 Provider（GameContext），只向 UI 输出 `lastAssistantFloorId` / `generatingFloorId` / `isGenerating` / `storyVersion` 四个信号；播放屏对事件零感知，拿到楼层号后用 `getChatMessages` 拉正文做纯函数解析。
2. **楼层即存档**：剧本文本、绑定关系、业务进度全部落在楼层文本或聊天变量里；前端 state 只是派生缓存，切聊天/刷新靠 `CHAT_CHANGED` 重建。
3. **前端不解析变量更新**：MVU 框架负责解析 AI 的更新块并落盘；前端只读结果、做夹逼收账。

**真值边界**（验收纪律的根）：本地浏览器只能验收 UI / 解析 / 交互 / 合成音效；iframe 提升、界面正则、MVU 落盘、CDN 分发只有真酒馆能验收。**本地通过不许冒充真机通过**——每阶段验收门都标了在哪验。

## 2. 教学总纲（四条）

1. **美学不教**：审美风格（配色、字体、氛围特效）由学习者自定。本 skill 只教"让画面成立的机制"。第一版可以很丑，丑不影响验收。
2. **galgame 前端的本质 = 角色名字 + 文本 + 分页**。立绘、CG、BGM、小手机全是这副骨架上的挂件。S1 必须先干干净净做出骨架。
3. **协议先行**：前端能不能认出"谁在说话"，取决于给 AI 立的输出格式规矩。格式是前端和 AI 之间的合同，AI 侧的提示词条款与前端解析器必须同一条心。
4. **性能红线**：任何"每字/每帧变化"的东西（打字机、天气粒子）绝不放进主渲染组件——见 §12 全程红线。

## 3. 施工总览（七个阶段，每阶段过门才进下一个；里程碑代码复制即用）

| 阶段 | 产出 | 验收门 | 验在哪 | 里程碑底稿 |
|---|---|---|---|---|
| S0 决策与骨架 | 开工三问 + 九决策点 + 模板骨架跑起来 | 空壳 React 应用在浏览器打开不白屏 | 本地 | —（模板即骨架） |
| S1 协议与解析器 | 剧本协议 + `scriptParser` 纯函数 | mock 楼层文本喂入输出正确 ScriptLine[]；无 `<content>` 降级正确 | 本地（可单测） | `09-里程碑代码-阶段一.md` |
| S2 交付层最小课 | 界面正则 JSON + 本地开发正则 | 真酒馆里楼层变成你的 iframe（哪怕只有一行字） | **真酒馆** | —（正文 JSON 抄用） |
| S3 演出层 | 打字机 + 立绘 + 背景 CG + 选项面板 | 浏览器裸跑完整播一幕，交互不卡帧 | 本地 | `10-里程碑代码-阶段二.md` |
| S4 事件生命周期 | GameContext 四信号 + 三态 + 生成锁 + 发送 | 真酒馆：发送→锁定→生成→自动落新楼，流式不跳行 | **真酒馆** | `14-里程碑代码-阶段三.md` |
| S5 变量与重roll | MVU 接入 + 删楼 + 静默重roll | 变量落盘；重 roll 原位替换、无闪烁 | **真酒馆** | `15-里程碑代码-阶段四.md` |
| S6 守卫与上线 | 伪全屏 + iframe 守卫 + CDN 发布 | 导入五步走通；全屏期间切楼层 iframe 不死 | **真酒馆** | `16-里程碑代码-阶段五.md` |

里程碑底稿（来自 from-zero，双蓝本真机运行版本，复制即用、各带自测清单）：AI 施工时作为阶段底稿改造；人类学习者复制后按文末自测清单验收。

规则：**跨阶段不加功能**。阶段内发现上一阶段设计错了，回到那一阶段改，不堆兼容补丁。每阶段结束向用户汇报：做了什么 / 怎么验证的 / 哪些还没验——验收通过与否只能用户确认。

先跑探针再接线：宿主 API 基准日 2026-09-04，新项目动工第一天与宿主升级后必跑存在性探针（`references/api-probe.md`）。**探针必须在 iframe 语境跑**——TavernHelper 函数注入在 iframe，主页面 `window` 上没有，主页面 console 全红不是漂移。存在 ≠ 行为契约，签名要以真机实测为准。

## 4. 阶段 S0 · 决策与骨架

### 4.1 开工三问（向用户复述，对上才开工）

- **目标**：一句话说清新前端做成什么、给哪张卡用。
- **红线**：不碰什么（不改动现有项目？不上传隐私？预算内？）。
- **验收**：至少明确「本地浏览器可播放」与「真酒馆导入可播放」两道门各验什么。

### 4.2 九个决策点（默认值加粗，拿不准就用默认值）

| # | 决策 | 选项（默认加粗） |
|---|---|---|
| D1 | 叙事形态 | **galgame 对话流** / 强分支多线 / 数值驱动模拟 |
| D2 | 图资产 | **无图（纯文字+氛围色）** / 静态查表直链 / 人物池+地点池引擎 / 完整批量生图管线 |
| D3 | 音频 | **Web Audio 合成 SFX（零文件）** / +直链 BGM / 无声 |
| D4 | 变量 | **全 MVU（带降级）** / 轻量聊天变量 / 无变量 |
| D5 | 天气昼夜 | **时段天气引擎（建议默认带）** / 仅昼夜二态 / 无时间流逝 |
| D6 | 多角色位置 | **不做** / 角色地点池（常驻 NPC ≥4 且找人/偶遇是玩法才值得） |
| D7 | 小手机 | **不做** / 最小壳 / 完整社交模拟（依赖副API） |
| D8 | 世界书写入 | 无 / **状态快照条目（幂等翻页）** / 业务条目 |
| D9 | 交付 | **正式交付（CI/手动发布到 CDN）** / 仅本地 demo |

**v1 冻结**：必做 = 协议+解析器、事件层+三态+生成锁、播放层（打字机+立绘可单图+背景可纯色+选项面板）、发送/重roll 链路。建议带上 = MVU（后补要迁移数据，早搭便宜）与时段天气（CG 变体/AI 注入都吃它的口径）。其余（随机池、音频 BGM、地点池、小手机、世界书写入、锁定前端、批量生图）v1 一律不做，接口留空。→ 深讲见 `references/new-project-checklist.md`。

### 4.3 骨架

StageDog `tavern_helper_template` 模板（GitHub 公共模板，Use this template 建仓）：

- `src/yaoguai/<项目名>/index.html`：空壳——`<head>` 内联全屏样式 + 字体 `<link display=swap>`，`<body>` 只有 `<div id="root">`，**无任何内联 JS**。
- `src/yaoguai/<项目名>/index.tsx`：React 入口，`$(() => { root.render(<App/>); $(window).on('pagehide', () => root.unmount()); })`——酒馆助手环境的 jQuery ready 保证 iframe 就绪；pagehide 卸载防泄漏。
- webpack 自动发现入口，产物是**单文件内联 index.html**（JS+CSS 全内联）。

**命名前缀第一天定死**：所有 localStorage 键、window 标志位、自定义事件名、正则 JSON 的 `scriptName`、世界书条目名，一律带 `<项目名>` 前缀（如 `<项目名>_story_updated`、`window.__<项目名>Fullscreen`）——多个前端共存同一酒馆时不互相污染。中途改名成本极高。规范全表与多前端并存检查单见 `references/13-命名空间与迭代发布.md`。

**坑（S0）**：react/react-dom 被配成 external 外链会导致双 React 实例——白屏 / CSP 报错 / hook 报错。模板里它们已强制打包，**别手痒改成 external**。

**验收**：`pnpm build` 后浏览器直接开产物，空壳渲染不白屏。

## 5. 阶段 S1 · 协议与解析器（先定协议，再写 UI）

协议是 AI 世界书「格式」条目与前端解析器之间的合同，**必须先于 UI 设计定稿**。解析器是纯函数（楼层文本 → ScriptLine[]，零酒馆依赖，可单测）。

### 5.1 行格式（实战验证的参考协议）

```ts
type LineType = 'narrator' | 'dialog' | 'thought';
interface ScriptLine {
  type: LineType;
  speaker?: string;   // '<user>' 表示玩家
  emotion?: string;   // 中文情绪名，经 EMOTION_MAP 查立绘
  text: string;
  location?: { path: string; displayName: string };  // 场景，后续行继承
  custom?: Record<string, unknown>;                  // 自定义控制行状态放这里
}
```

| 格式 | 类型 | 正则 |
|---|---|---|
| `角色名[情绪]:"对话"` | dialog | `/^(.+?)\[(.+?)\]:"(.+)"$/s` |
| `<user>:"对话"` | dialog | `/^<user>:"(.+)"$/s` |
| `角色名[情绪]:*独白*` | thought | `/^(.+?)\[(.+?)\]:\*(.+)\*$/s` |
| 纯文本 | narrator | 兜底 |

- 所有正则带 `s` 标志；情绪映射 `EMOTION_MAP`：中文→拼音 key，取不到时 **fallback 默认情绪**。
- 说话人匹配：`name` 或 `alias` 数组；`'<user>'`、`'我'`、玩家名都算玩家——**玩家不占立绘位**。
- 差分（换立绘）= `角色名[情绪]:"台词"` 里的情绪标签，不需要额外机制。
- **全行锚定**：对话行整行只允许这一个表达式，行首行尾不得有其他文字；引号、冒号一律英文半角；旁白独立成段（坑 2/3）。想让角色边动边说，拆成旁白行 + 对话行。

### 5.2 `<content>` 与思维链

- 可播内容只来自 `<content>…</content>` 块（可多个）。
- **宽容降级**：没包标签时降级为「剥思维链后全文视为剧本」——但要有意识地知道思维链/变量块可能混入；参考实现选择强制 `<content>`（世界书格式条目教 AI 输出），重生成链路另用 `<maintext>` 提取主体。
- **stripThinking 必须是单一工具函数**，成对剥离 `<think>` `<thinking>` `<Chain_of_Thought>` `<draft>` `<simple_thinking>` 等全部标签对（gi 标志），播放解析 / 历史视图 / 重生成三个入口共用同一份——多处实现不一致会导致正文残留。**顺序铁律：先剥思维链、再提取正文**（坑 4/5）。
- **变量更新块不归前端管**：AI 按 `[mvu_update]` 条目输出 UpdateVariable 语法，MVU 框架解析落盘，显示层正则把它藏掉。`<content>` 限定可播范围后残留块自然被隔离。

### 5.3 控制行与状态机

- `[scene:父地点/子地点/…/末级地点]`——**行首、独占一行**，正则 `/^\[scene:([^\]]+?)\]$/`，更新 `currentLocation`。
- 解析算法本质：**带状态变量（currentLocation…）的单遍逐行状态机**；控制行是「从此生效直到下一个控制行」（逐楼快照继承语义），不是仅当前行。
- AI 常把标签和对话写同行（`[人物:茶客甲][害怕]:"…"`）：检测行首标签前缀，把标签替换为其中角色名后再走对话正则。
- 选项解析三路并取（AI 记不住一种格式）：`<options>` 块内 `>` 前缀行 / `<choice>` 块 / 多个独立 `<choice>`，去重合并。

### 5.4 协议设计红线

标签简短（每楼都输出，长了贵且易错）；控制行独占一行+行首匹配（避免自由文本里的危险全局替换）；**每条 AI 侧格式约定都要在世界书「格式」条目里写一遍**，前端同时做宽容兜底——**两端都假设对方会出错**。AI 侧的 COT 五条格式自检模板、想改成自己协议的完整自由度清单：`references/12-自定协议与题材适配.md`（§1 四条动不得、§2 自由度、§2.8 COT 模板）。

**坑（S1）**：① 楼层正文解析为空 → AI 没包 `<content>`，必须有降级全文路径；② 旁白里的引号台词被误认对话 → 只做行首整行匹配，不做自由文本扫描（`user笑了笑:"…"` 天然不匹配）；③ 协议定了 UI 才动工——顺序反了会返工。

**里程碑底稿**：`references/09-里程碑代码-阶段一.md`——解析器 + 分页文本框 + 名牌 + 点击翻页，复制即用含自测清单。

**验收**：mock 楼层文本（含思维链 + `<content>` + 变量块 + 引号旁白 + 场景切换 + 情绪差分）喂入，ScriptLine[] 输出正确；去掉 `<content>` 标签降级正确。纯本地可单测。

## 6. 阶段 S2 · 交付层最小课（楼层怎么变成 iframe）

不先懂这层，S4 的真酒馆联调无法理解。链路 = **楼层文本 → 界面正则替换成代码块 → 酒馆助手提升为 iframe → `$('body').load(CDN 单文件)`**。

### 6.1 界面正则 JSON（字段逐解）

```json
{
  "scriptName": "<项目名>-界面",
  "findRegex": "/[\\s\\S]*/s",
  "replaceString": "```\n<body>\n<script>\n$('body').load('https://cdn.jsdelivr.net/gh/<user>/<repo>@master/dist/yaoguai/<项目名>/index.html')\n</script>\n</body>\n```",
  "placement": [2],
  "disabled": false,
  "markdownOnly": true,
  "runOnEdit": false
}
```

- `findRegex:/[\s\S]*/s`：匹配楼层全部文本（s 含换行）。
- `placement:[2]`：**仅显示层**，不改提示词——楼层真实文本仍是 AI 输出（变量解析、回看历史都靠它），显示层才变 iframe。写错 placement 污染提示词是灾难级事故。
- `markdownOnly:true`：只影响渲染。
- 替换串机制：酒馆渲染带 ``` 围栏的 `<body>` 代码块时，酒馆助手把该代码块提升为 iframe。

### 6.2 本地开发正则

`node serve.mjs`（CORS 全开静态服务器）+ 导入一份 **disabled 的本地开发正则**（与正式正则同构，URL 换 `http://localhost:<port>/dist/yaoguai/<项目名>/index.html`），调试时启用、交付时禁用。这样 S3 起就能在**真酒馆里看到你的前端**。

### 6.3 脚本类 JSON

`id` 用**固定 UUID**（重复导入覆盖同位脚本，不产生副本）；`content` 只放一行 CDN import 引导器，代码本体走 CDN——发新版即全员自动更新。

**坑（S2）**：① **正式 JSON 里出现 localhost = 事故**（只允许出现在默认禁用的开发正则里）；② placement 写成 [1] 之类改了提示词，变量解析全乱。

**验收（真酒馆）**：导入开发正则并启用，聊天里任一楼层的显示层变成你的 iframe（内容可以是占位一行字），且提示词里看不到 iframe 代码。

## 7. 阶段 S3 · 演出层

### 7.1 打字机（本 skill 最重的一条铁律）

**打字机绝不放主画面组件。** 打字进度若是播放屏的 state，每次吐字都会重渲染立绘、CG、文本框整棵树，卡到没法玩。正解：

- 打字进度是 `TypingText` **子组件内部 state**，`React.memo` + 自定义比较器只比较少数 props——父组件对每帧吐字零感知。
- 驱动用 `requestAnimationFrame` + 时间累积（非 setInterval）；速度档 0=瞬发。
- 跳过：外部传 `skipRef`，下一帧检测到即瞬间补全；`onTypingStateChange(typing)` 上抛打字状态，父组件据此拦截翻页——**打字中第一次点击=跳过，第二次=下一行**。
- 音效：非旁白行每批字符 `sfx.playBlip(speaker)`（按说话人名哈希定调）。

### 7.2 多立绘同屏

- 数据单元 `SceneCharacter { speaker, emotion, sprite, position: 'center'|'right'|'left', isActive }`。
- **同屏最多 3 人**（`slice(-3)`，位置轮转）；场景变化清场重建；旁白行全员 `isActive:false`。
- **发言亮、在场非发言人暗**：非活跃 CSS `brightness(0.55) grayscale(0.35) scale(0.96)` + 底部渐隐 mask。
- **换情绪不换 key**：key=speaker 只换 img src（无交叉淡出闪烁）；进场动画按情绪给不同 spring 配置。
- `<user>` 说话不占立绘位——只有有立绘的角色才进场。
- 立绘预加载：解析后对所有 sprite URL `new Image().src` 预热。
- 只有配了多情绪差分的核心角色启用情绪立绘/音效/屏幕特效；其余强制默认情绪。

### 7.3 背景 CG

优先级链：NSFW CG（若有）→ `getLocationImageSmart(场景路径, 天气, 昼夜)`（完整路径精确匹配 → 末段模板匹配）→ 地点随机池兜底 → 纯色氛围兜底。`[scene:]` 标签在解析层已更新 location，渲染层查表即可。

### 7.4 CSS 地基与性能

- **语义色板**（Tailwind v4 `@theme` 的 `--color-xxx`），按语义命名不按色值命名；**层级令牌**固定：场景 z-0/10 → 天气 z-[19] → 文本框 z-20 → HUD z-30 → 弹窗 z-40。
- **大面积常驻叠层禁 backdrop-filter**（全屏天气层/粒子容器——部分浏览器 iframe 上下文直接白屏）；小面积 backdrop-blur（文本框、弹窗遮罩）真机长期安全。判据 = 层面积 × 常驻时长。
- `@media (prefers-reduced-motion: reduce)` 统一关停装饰动画。
- **memo 生效前提是 props 引用稳定**：内联对象/函数字面量每次渲染都是新引用，等于白 memo；回调抽 `useCallback`，静态区块提取 memo 子组件，Provider 的 setter 全部稳定化。动手前用 React DevTools Profiler 确认重渲染源。

### 7.5 移动端

- `useIsMobile`：**手动覆盖开关优先**（localStorage + `useSyncExternalStore`），否则 matchMedia——**iframe 里 matchMedia 测的是 iframe 视口**，电脑全屏时会误判，必须给手动开关兜底。
- 手机端「长按正文选词」要**自绘选字**：原生文本选择的系统复制条在 iframe 里压不掉（iOS 无解）。正文逐**码点** span（`Array.from` 切分，emoji 代理对不切坏），容器保持 select-none，长按起选/滑动扩选/落指提交。索引对齐必须按码点，不能按 UTF-16 下标。

**坑（S3）**：① 打字机进主组件 → 每吐一字全树重渲染（本阶段头号坑，验收时用 Profiler 查）；② 把 Tailwind 裸类名当 CSS 色值写进 style/linear-gradient（`bg-ink-900` 出现在样式值里）→ **无报错无日志地静默失效**，要用 `var(--color-ink-900)`；③ 立绘换情绪时 key 变了 → 整图重挂载闪烁。

**里程碑底稿**：`references/10-里程碑代码-阶段二.md`——背景 / 立绘舞台 / 预加载，复制即用含自测清单。

**验收**：浏览器裸跑（无酒馆环境）完整播一幕：分页点击、打字机、立绘亮暗切换、场景 CG 切换、选项面板出现；Profiler 下打字期间无父级重渲染。

## 8. 阶段 S4 · 事件生命周期与发送

### 8.1 GameContext：唯一事件接入点

所有 `eventOn` 监听只写在 GameContext，UI 只吃四个信号。监听表：

| 监听 | 行为 |
|---|---|
| `tavern_events.CHAT_CHANGED` | 重载聊天变量 → `initMvuPipeline()` → 重算 `lastAssistantFloorId` → `setViewingFloorId(null)` |
| `tavern_events.MESSAGE_RECEIVED` | `syncLatestFloor()`：生成中更新 `generatingFloorId`，否则更新 `lastAssistantFloorId` |
| `tavern_events.MESSAGE_UPDATED` | `syncLatestFloor()` + **条件性** `storyVersion++`（见防抖①） |
| `iframe_events.GENERATION_ENDED` | `setTimeout(300)` 再 sync；非生成状态才 bump storyVersion |
| `<项目名>_story_updated`（自定义） | `syncLatestFloor()` + 无条件 `storyVersion++`——重生成路径的兜底刷新 |
| MVU `onVariableUpdateEnded` | 数值夹逼、业务收账（S5） |

**ref 镜像**：所有会被事件回调读到的 state 都维护 `xxxRef.current = xxx`——事件回调闭包拿不到最新 state。

### 8.2 API 归属澄清（教 AI 时最易写错的地方）

- **楼层列表不是 `getAssistantFloors()`**——酒馆助手没有这个全局函数。用 `getChatMessages('0-{{lastMessageId}}', { role: 'assistant' })` 扫出全部 assistant 层号；生成期间裁剪为 `f < generatingFloorId` 防止翻到正在生成的楼层。
- **`viewingFloorId` / `setViewingFloorId` 是你前端自己的 state 与 setter**，不是酒馆 API。三态模型：`targetFloorId = viewingFloorId ?? lastAssistantFloorId`——null 跟随最新，非 null 回看历史；翻到最后一层时 `setViewingFloorId(null)` 回跟随。
- 权威 API 清单（`getChatMessages` / `getLastMessageId` / `setChatMessages` / `getVariables` / `updateVariablesWith` / `eventOn` / `eventEmit` / `triggerSlash` / `generate` / `generateRaw` / `Mvu.*` / 世界书系列 / 父页 jQuery）——每个全局函数调用都包 try/catch，**浏览器裸跑时不崩只降级**。清单外的名字一律先探针再信。

### 8.3 发送与生成锁

```ts
// 发送（两条等价通道统一走 STScript，不用 createChatMessages/triggerGeneration——
// 走 /send 才过酒馆设置：预设、世界书、正则全生效）
await triggerSlash('/send ' + trimmed);
await triggerSlash('/trigger await=true');

// 生成锁：画面锁定 → 生成 → 解锁自动落新楼
const startGenerating = (floorId?) => {
  const lockFloor = floorId ?? viewingFloorId ?? lastAssistantFloorId;
  if (lockFloor != null) setViewingFloorId(lockFloor);   // 锁定画面
  setIsGenerating(true);
};
const finishGenerating = () => {
  setIsGenerating(false);
  setLastAssistantFloorId(newFloorId);
  setViewingFloorId(null);   // 解锁 → targetFloorId 切新楼 → 解析重跑
};
```

**选项是「起草」不是「直发」**：点击选项只 `setPendingMessage(option)`，填入输入框等玩家确认——避免误触直接烧 token。

### 8.4 三处防抖（本阶段头号 bug 农场，逐条照做）

1. **流式生成期间不 bump storyVersion**：MESSAGE_UPDATED 携带新楼层号，此时 bump 会让播放屏把锁定中的楼层误判为「本楼重生成」而**重置回第 0 行**（背景/立绘提前切换）。守卫：`if (isGeneratingRef.current && messageId !== viewingFloorIdRef.current) return;`
2. **同楼层正文未变时保阅读进度**：`lastParseKeyRef` 记 `{floor, story, content}`，只有「同楼层且正文变了」才算本楼重生成（清进度从头读）；事件抖动的同层重解析保持 `currentIndex`。
3. **双路径生成结束**：应用内发送流程（isGenerating 中）不在 GENERATION_ENDED 时 bump（finishGenerating 更新 lastAssistantFloorId 自会触发重算）；本楼重生成刷新由自定义事件兜底。

**坑（S4）**：播放位置莫名跳回第 0 行 → 防抖①没做；切聊天后数据错乱 → 没监听 `CHAT_CHANGED` 重建；轮询替代事件 → 有事件就别 `setInterval`。

**里程碑底稿**：`references/14-里程碑代码-阶段三.md`——真机门：酒馆安全层 / 发送链 / 虚拟楼层导航 / 生成锁，完整代码。

**验收（真酒馆）**：本地开发正则开着，发送一条消息 → 画面锁定不跳 → 生成结束自动落新楼 → 流式期间播放位置不动 → 翻回旧楼再翻回末层回跟随模式。

## 9. 阶段 S5 · MVU 变量与重roll

设计总纲：**MVU 缺席时全部静默降级，前端绝不崩。**

### 9.1 挂载（酒馆助手脚本库两份脚本）

1. **Mvu 框架本体**：`content` 一行 `import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';`，固定 UUID。
2. **变量结构（Zod）**：`registerMvuSchema(Schema)`；`z.coerce.number()` 容忍字符串数字；`describe()` 文本会生成给 AI 的变量说明；`prefault()` 是初始默认值；`$(() => …)` 里注册保证 MVU 已加载。

世界书侧契约三条目（`[initvar]变量初始化勿开` 禁用蓝灯 / `[mvu_update]` 规则与格式 蓝灯 / 变量列表 蓝灯）随角色卡发布，**前端不写这三个条目**。

### 9.2 前端适配层（utils/mvu.ts）

- 就绪探测 `ensureMvuReady(timeoutMs=8000)`：`waitGlobalInitialized('Mvu')` 带超时竞速，超时回退 `window.Mvu` 探测，再不行静默降级。
- 降级链三层（读）：楼层 MVU 数据 → 聊天变量 `getVariables({type:'chat'}).stat_data` → 本地占位常量（浏览器裸跑）。写同理，末层静默失败 + console.warn。
- **收账铁律**：`VARIABLE_UPDATE_ENDED` 回调内**直接改写传入的 variables**（框架随后落盘）——**勿在回调内 `getMvuData` 重读**，时序上会拿到旧值。回调内做：夹逼数值 → 业务收账 → 同步派生 UI → 阈值提醒（对比上次值判断增减）。
- 业务读取逐字段夹逼 + 缺失回退默认值，**不信任 AI 输出的任何数值**。

### 9.3 删楼与静默重roll（原位替换，不删楼重建）

删楼：`triggerSlash('/cut <楼层号>')` 后 `eventEmit('<项目名>_story_updated')` 通知刷新（删除类 API 以真机探针为准）。

重 roll 七步（幻璃镜真机验证链路）：

1. 取最后一层（必须 assistant），向上找最近 user 层作输入；
2. `getChatMessages('0-' + userFloorId)` 截断历史窗口（蓝本项目有「只带最近 5 层 AI 楼」的预算收紧——那是预算选择不是硬规则）；
3. `generate({ user_input, should_stream:false, should_silence:true, overrides:{ chat_history:{ prompts } } })` —— 静默生成，**不建新楼层**；
4. `stripThinking` + 提取 `<maintext>` 主体；
5. `Mvu.parseMessage(新回复, 该楼旧变量)` —— **变量跟着重算**；
6. `setChatMessages([{ message_id: lastFloorId, message: maintext }], { refresh: 'none' })` 原位替换；
7. `eventEmit('<项目名>_story_updated')` 通知前端刷新。

**坑（S5）**：重 roll 后楼层闪烁/消失 → 用了删楼重建；正解是上面的原位替换 + 自定义事件刷新。夹逼不生效/拿到旧值 → 回调里 getMvuData 重读了。

**里程碑底稿**：`references/15-里程碑代码-阶段四.md`——真机门：读变量 / `/cut` 删楼 / 静默重roll，完整代码。

**验收（真酒馆）**：改一个好感度相关的输入 → 重 roll → 楼层原位更新、无闪烁、变量与正文一致；临时禁用 MVU 脚本 → 前端不白屏、读数为占位值。

## 10. 阶段 S6 · 守卫与上线

### 10.1 伪全屏（父页 DOM 操作，不用 requestFullscreen 为主）

1. 父页 jQuery 向父页 `<head>` 注入 `<style id="tavern-<项目名>-fs-hide">`：`.mes:not([mesid="N"]) { display:none !important }` 隐藏其他楼层；
2. 把自己的 `.mes`（`window.frameElement.closest('[mesid]')`）定位 `position:fixed` 全屏；
3. 设 `window.__<项目名>Fullscreen = true`（高度守卫据此暂停钉制）；
4. 无父页（浏览器预览）回退 `requestFullscreen`。

### 10.2 iframe 高度守卫（事件驱动，非暴力轮询）

目标高度 `min(移动700/桌面800, 父页视口-20)` 且 ≥400。观察者只触发 `scheduleApply`（rAF 合帧）：MutationObserver×2（iframe 自身 style 被父页篡改 / 父元素 style·class）+ ResizeObserver（内容撑高主动通知父页）+ window.resize 兜底。写入差值 >1px 才写；全屏时跳过。**`burst()`：退出全屏后 3 次×100ms 快速修复竞态**——全屏改了父页内联样式，退出后未恢复是必现坑。

### 10.3 锁定前端脚本（可选交付件，双项目真机验证）

纯脚本项目（无 html 入口）。四层机制：① CSS 隐藏非锁定楼层（含 MutationObserver 对新增楼层立即 display:none）；② **父页原型拦截**：在父页 JS 上下文猴子补丁三个 API——`HTMLIFrameElement.prototype.remove`、`Node.prototype.removeChild`（含嵌套检查）、`jQuery.fn.remove`——目标 `closest('[mesid]')` 等于锁定楼层时**静默拒删**，从源头阻止酒馆销毁 iframe；提供 `window.__tavernLockCleanup()` 恢复；③ 监听父页 `fullscreenchange` 进出锁/解锁；④ `pagehide` 全面清理。

### 10.4 构建与发布

- `pnpm build` 产出单文件内联 index.html；externals：jquery→`$`、lodash→`_`、zod→`z` 等映射宿主全局；**react/react-dom/motion 强制打包勿 external**（双实例白屏）。
- CDN：jsDelivr 映射 GitHub 路径；CI 自动构建提交 dist + 打 tag。
- **发布三铁律**：① 正式 JSON 不许出现 localhost；② **先 build 完全结束再单独 publish——绝不串同一条命令**（webpack 没写完 10MB 产物 git add 就读走半截，玩家拿到截断 blob 且极难察觉；发布后核对 CDN 字节数 == 本地 `fs.statSync().size`，单文件产物以 `</body>` 收尾）；③ 新建 CDN 仓库时一个初始化勾都不打（README 首推必冲突）。
- 缓存：purge 只清 jsDelivr 边缘，**清不掉手机浏览器自身 HTTP 缓存**（@master 可缓存约 12h）——UI 放**可见版本号**让玩家自检。

**坑（S6）**：退出全屏后 iframe 高度错乱 → burst 没做；玩家说没更新 → 先看可见版本号再清缓存；发版后行为诡异 → 查是不是半截产物。

**里程碑底稿**：`references/16-里程碑代码-阶段五.md`——真机门：伪全屏 / 高度守卫 / 锁定前端脚本，完整代码 + 部署。

**验收（真酒馆）**：导入五步走通（世界书 → 两个正则 → MVU/变量脚本 → [initvar] 保持禁用 → 开新聊天验证蓝灯条目与 iframe 加载）；全屏期间让另一楼层到达/删除，你的 iframe 不死不白屏。

## 11. 扩展篇（v1 之后，按启用信号逐个加，各带头号坑）

| 子系统 | 启用信号 | 头号坑 | 深参考 |
|---|---|---|---|
| 时段天气引擎 | 游戏内时间流逝（几乎总成立） | 天气视觉与 AI 看到的对不上 → 突变必须落预报缓存，消费方统一 `getWeather()`；大面积常驻叠层禁 backdrop-filter；黄历宜忌要确定性（建除十二神），节气用天文公式，昼夜按节气日出日入漂移 | `weather-daynight.md` |
| 角色地点池 | 常驻有名 NPC ≥4 且找人/偶遇是玩法 | 种子必须同时含角色+日期+小时（缺一 → 全员齐跳或全天不变）；串门先过滤（主人不在家时访客不得出现）；只注入 WHERE 不注入 WHAT | `character-locations.md` |
| 音频/BGM | 有直链音频 | AudioContext 必须等首次用户交互；多楼层每 iframe 一份引擎 → **出声权仲裁六铁律**（先读盘再合并 patch、读写失败切内存真相源、曲内进度进共享区、`__<项目名>_BGM_INSTANCE__` 标记防双引擎） | `audio.md` |
| 随机池图引擎 | 同类实体 >10 个或逐个配图不可维护 | 幂等绑定（实例名主键，已有绑定不重抽）；身份类约束永不放宽；洗牌袋全用尽才重洗 | `random-pools.md` |
| 小手机 | 需要主线外社交或信息聚合 | 三层持久化各归其位（配置→角色卡变量/内容→聊天变量/UI→localStorage）；社交生成走 `generateRaw` 副API不入主历史 | `phone-ui.md` |
| 世界书写入 | AI 每轮要看最新游戏状态 | 并发 `updateWorldbookWith` 读改写互覆 → **串行 `.then()` 链**；单条目幂等翻页；重写用模板归一托管字段自愈 | `worldbook-write.md` |
| 批量生图管线 | 图片 ≥50 张手写 URL 出错 | manifest 记 URL → 生成器转 `src/data/*.ts`（生成产物勿手改）；「删图重跑还是同一张图」→ Images API 被中转站缓存，切 Chat API 端点 | `asset-pipeline.md` |

## 12. 全程红线（施工全程有效，违反即停）

1. **先协议后 UI**；协议两端都假设对方会出错；对话行全行锚定 + 半角标点，AI 侧 COT 同步自检。
2. **打字机绝不进主画面组件**（S3 头号铁律）。
3. **事件与渲染解耦**：唯一 Provider、四信号、播放屏零感知。
4. **前端不解析变量更新**——MVU 管落盘，前端只读+夹逼。
5. **每个酒馆全局函数包 try/catch**，浏览器裸跑降级不白屏。
6. **不凭记忆写 API**：清单内照抄、清单外先探针；分清「酒馆 API」和「前端自己的 state」。
7. **跨阶段不加功能**；每阶段过验收门，向用户汇报证据（做了什么/怎么验/没验什么）。
8. **本地通过 ≠ 真机通过**，两道门分开记录，不许互相冒充。
9. **命名前缀第一天定死**（localStorage 键 / window 标志 / 事件名 / scriptName / 世界书条目）。
10. 正式交付 JSON 无 localhost；先 build 后 publish，绝不串一条命令。
11. **刷新绝不 `location.reload()`**——删楼/重roll 后用 `<项目名>_story_updated` 自定义事件通知各楼 iframe 自刷新（重载会退出全屏、丢阅读进度与前端状态）。

（原 from-zero 五条铁律已全部并入：打字机独立=红线2、全行锚定=红线1、先剥后提=§S1、`<user>` 不占立绘位=§S3、刷新不重载=红线11。）

## 13. 排障入口（出症状先查哪份）

| 顺序 | 文档 | 用法 |
|---|---|---|
| 1 | `references/11-排障决策树.md` | 拿着**现象**查：19 种现象 → 排查步骤 → 坑号。第一入口 |
| 2 | `references/pitfall-catalog.md` | §1-12 按子系统查症状表；§13 = 坑 1–36 编号条目（决策树与其他文档引用的「坑 N」都指这里，带双蓝本源码出处） |
| 3 | 各子系统参考文档 | 决策树/字典定位到子系统后的深度细节（§15 索引） |

排障纪律：**改一处验一处**，别一次改五个地方。任何诡异现象先做三件事——console 报错读第一行、Network 看红请求、把现象缩小到"解析错了 / 状态错了 / 渲染错了"三段之一（贴夹具进解析器单测 = 验解析；console 打 `viewingFloorId/targetFloorId` = 验状态；React DevTools = 验渲染）。

## 14. 双蓝本对照（知识可信度来源）

| 子系统 | 蓝本 | 备注 |
|---|---|---|
| 剧本协议/解析、事件层、MVU | 幻璃镜 + 租借男友 双源 | 协议与状态机取交集的稳定形态 |
| 小手机 | 租借男友（单源） | 11 App 成熟实现 |
| 角色地点池、时段天气引擎 | 租借男友（幻璃镜后吸收） | 「租借男友验证过」 |
| BGM 出声权仲裁、共享状态纪律 | 幻璃镜（单源） | 每 iframe 一份引擎必须裁决谁出声 |
| iframe 守卫/伪全屏、锁定前端、交付管线 | 幻璃镜（单源） | 锁定前端与界面正则双项目均真机验证 |
| 里程碑代码 | 双蓝本真机运行版本 | from-zero 教程蒸馏，复制即用 |
| 已评估弃置 | —— | 统一视图（单 iframe 覆盖全部楼层）：无价值，**勿再提议** |

出处说明：原 from-zero 的 `08-源码证据索引`（`文件:行号` 逐条引用）在合并时退役——它的出处职能由本表与 `pitfall-catalog.md` §13 条目内的源码记忆承担，自包含分发不再依赖项目源码。

若工作区含蓝本源码（如 `src/yaoguai/幻璃镜`、`src/租借男友`），可对照阅读，但本 skill 的知识自包含，不依赖源码存在。

## 15. 参考文档索引（24 份）

> 引用约定：各文档中的「坑 N」一律指 `pitfall-catalog.md` §13 同号条目；「§S0-S6」指本文施工阶段。

| 文件 | 内容 |
|---|---|
| `00-环境与开工准备.md` | 动工前必读：环境清单、脚手架来路、本地调试闭环、构建发布两法、酒馆侧安装清单、开工三问 |
| `09-里程碑代码-阶段一.md` | S1 底稿：解析器 + 分页文本框 + 名牌 + 翻页（复制即用，含自测清单） |
| `10-里程碑代码-阶段二.md` | S3 底稿：背景 / 立绘舞台 / 预加载（复制即用，含自测清单） |
| `11-排障决策树.md` | 19 种现象 → 排查步骤 → 坑号；排障第一入口 |
| `12-自定协议与题材适配.md` | 协议自由度、题材换皮表、群像别名、COT 五条改写模板、什么值得抄 |
| `13-命名空间与迭代发布.md` | 前缀规范全表、多前端并存检查单、迭代发布流 |
| `14-里程碑代码-阶段三.md` | S4 底稿：真机门——酒馆安全层/发送链/虚拟楼层导航/生成锁（完整代码） |
| `15-里程碑代码-阶段四.md` | S5 底稿：真机门——读变量/`/cut` 删楼/静默重roll（完整代码） |
| `16-里程碑代码-阶段五.md` | S6 底稿：真机门——伪全屏/高度守卫/锁定前端脚本（完整代码+部署） |
| `api-probe.md` | TavernHelper API 存在性探针：运行语境陷阱、判读规则、基准快照 |
| `architecture.md` | 总架构：事件生命周期状态机、楼层三态、发送/重生成完整链路、TavernHelper API 用法清单 |
| `asset-pipeline.md` | 美术资产管线：批量生图、防重复出图、图床上传、生成器脚本、manifest 账本 |
| `audio.md` | 音频子系统：SFX 合成引擎（UI 音效/打字 blip/情绪音效）、pub-sub 设置层、BGM 播放器、跨楼层出声权仲裁（六条铁律） |
| `character-locations.md` | 角色地点池：三层位置模型、空闲池加权随机五步修正链、串门校验、位置表 AI 注入 |
| `delivery.md` | 构建与交付：webpack 模板机制、界面正则/脚本 JSON 字段逐解、CDN/CI、锁定前端、导入步骤、产物完整性与缓存自检 |
| `frontend-playbook.md` | React 演出层实现：入口守卫、iframe 守卫、伪全屏、打字机、立绘、移动端、CSS 设计系统、手机自绘选字 |
| `mvu.md` | MVU 接入全案：bundle 挂载、Zod schema、世界书契约、前端适配层、降级链 |
| `new-project-checklist.md` | 开工前决策清单：九个决策点、v1 冻结范围、子系统启用时机、阶段验收门 |
| `phone-ui.md` | 小手机：悬浮球+壳+App 懒加载、三层持久化、副API社交模拟、历史压缩、世界书联动 |
| `pitfall-catalog.md` | 全量踩坑字典：§1-12 按子系统症状表；§13 = 坑 1–36（决策树引用的编号条目） |
| `random-pools.md` | 随机池图引擎：幂等绑定、洗牌袋、属性放宽候选链、tier 型地点池、确定性随机 |
| `script-protocol.md` | 剧本协议设计指南：行格式正则、控制行、选项、思维链剥离、宽容解析、自定义扩展规范 |
| `weather-daynight.md` | 时段天气引擎：昼夜/时段、季节概率、马尔可夫 7 日预报、确定性突变、正文回写与 AI 注入、视觉叠层；岁时历（真实农历/节气/黄历宜忌/节气日出日入，§12） |
| `worldbook-write.md` | 前端写世界书：蓝/绿灯条目、单条目幂等翻页、并发串行、模板归一自愈 |

## 16. 分发与版本

- **自包含分发**：整目录（SKILL.md + references/ + LICENSE）拷入 `~/.agents/skills/` 即可，无外部依赖，适用于任意工作区。
- **更新渠道**：官方副本 `https://github.com/zzh185061429-cmyk/gal`，目录内 `git pull` 更新；MIT 许可证随目录分发。
- **时效协议**：API 基准日 2026-09-04；宿主升级或超期 6–12 个月 → 先跑 `api-probe.md`；里程碑代码（14/15/16）是真机门所在，宿主升级后优先重验。
- **本项目迭代发布流**（改的是 galgame 前端项目时）：见 `references/13-命名空间与迭代发布.md` §3；构建/发布三铁律见 §S6 与 `references/delivery.md`。
