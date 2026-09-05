# galgame-frontend-kit

「幻璃镜」式 galgame 楼层剧本前端方法论 —— 一个自包含、可分发的 Agent Skill。

把 AI 的楼层文本变成可播放的视觉小说：SillyTavern 酒馆助手（TavernHelper / JS-Slash-Runner）iframe 内嵌 React 单文件应用的完整方法论，覆盖剧本协议设计、楼层三态与生成事件锁、MVU 变量接入与静默降级、打字机/立绘/伪全屏演出层、Web Audio 程序化音效、天气与昼夜引擎、岁时历（真实农历/节气/黄历宜忌）、随机池图引擎、多角色地点池、游戏内小手机、世界书幂等写入、批量生图资产管线、webpack 单文件构建与界面正则/CDN 交付，以及性能与重渲染排查清单。

它解决的是**功能性**问题——宿主生命周期时序、数据一致性、交付运维这三类几乎无公开文档、只能从实战翻车里蒸馏的隐形坑。视觉/审美方向指导不在范围内；skill 只提供视觉工作的机制地基（语义色板、z 层令牌、reduced-motion 兜底）。

知识自包含，不依赖任何特定工作区，蒸馏自两个已交付实战项目（幻璃镜、租借男友，蓝本溯源见 SKILL.md）——装上就能在任意机器、任意项目里让 AI 照着从零搭一套。

## 安装（一条命令）

**Windows（cmd / PowerShell）：**

```
git clone https://github.com/zzh185061429-cmyk/gal "%USERPROFILE%\.agents\skills\galgame-frontend-kit"
```

**macOS / Linux：**

```
git clone https://github.com/zzh185061429-cmyk/gal ~/.agents/skills/galgame-frontend-kit
```

> ⚠️ **克隆目标文件夹名必须是 `galgame-frontend-kit`**（与 skill 名一致；仓库名叫 `gal` 不影响——clone 的目标目录名自己定）。多数 agent 按「目录名 = skill 名」发现 skill，名字不对就静默找不到。

- 也可只装到单个项目：克隆/复制到 `<项目根>/.agents/skills/galgame-frontend-kit`。
- 不用 git：Code → Download ZIP → 解压 → 文件夹改名为 `galgame-frontend-kit` → 放进 `~/.agents/skills/`。
- 更新：在安装目录 `git pull`（或重新下载覆盖）。

适用于 ZCode、Claude Code、Cursor 等支持 `.agents/skills/`（[agentskills.io](https://agentskills.io/specification) 规范）目录的 agent。

## 怎么触发

装好后直接说需求即可自动命中，例如：

- 「帮我从零做一个 galgame 前端 / 视觉小说前端 / 楼层剧本播放器」
- 「把这张 ST 角色卡做成可播放的前端」
- 「设计楼层剧本协议 / 天气昼夜系统 / 游戏内手机 / 黄历时历」

也可显式调用 `/galgame-frontend-kit`（视 agent 而定）。

## 推荐的使用节奏

1. **别跳过第 0 步**：开工先过 `references/new-project-checklist.md` 的九个决策点（每个都带保守默认值），冻结 v1 最小可玩范围，砍功能的判断在这一步做。
2. **动工第一天跑探针**：`references/api-probe.md` 在 iframe 语境里核对宿主 API 面——注意别在主页面 console 里跑（全红是注入机制，不是漂移）。
3. **守阶段门 A→E**：协议解析 → 事件层 → 演出层 → 可选子系统 → 交付，跨阶段不加功能。

## 内容一览

| 文件 | 内容 |
|---|---|
| `SKILL.md` | 总工作流：分步新建流程、三条架构铁律、蓝本溯源、常见坑速查表（30+ 实战翻车） |
| `references/new-project-checklist.md` | 开工前九个决策点、v1 最小可玩范围冻结、阶段验收门 |
| `references/script-protocol.md` | AI↔前端剧本协议：行格式正则、控制行、选项、思维链剥离、宽容解析 |
| `references/architecture.md` | 事件生命周期状态机、楼层三态、发送/重生成链路、TavernHelper API 清单 |
| `references/api-probe.md` | TavernHelper API 存在性探针：运行语境陷阱、判读规则、基准快照 |
| `references/mvu.md` | MVU 变量接入：bundle 挂载、Zod schema、收账夹逼、三层降级链 |
| `references/frontend-playbook.md` | React 演出层：入口守卫、iframe 守卫、伪全屏、打字机、立绘、CSS 设计系统、性能与重渲染清单、手机自绘选字 |
| `references/weather-daynight.md` | 时段天气引擎：季节概率、马尔可夫预报、确定性突变、AI 注入、视觉叠层；岁时历：真实农历/节气/黄历宜忌/节气日出日入 |
| `references/audio.md` | 音频子系统：Web Audio 合成 SFX、打字 blip、pub-sub 设置层、BGM 播放器、跨楼层出声权仲裁（六条铁律） |
| `references/random-pools.md` | 随机池图引擎：幂等绑定、洗牌袋去重、属性硬约束 |
| `references/character-locations.md` | 角色地点池：三层位置模型、加权随机、串门校验、位置表注入 |
| `references/phone-ui.md` | 游戏内小手机：悬浮球+壳+App、三层持久化、副API社交模拟 |
| `references/worldbook-write.md` | 前端写世界书：蓝/绿灯条目、幂等翻页、并发串行 |
| `references/asset-pipeline.md` | 美术资产管线：批量生图、图床上传、manifest 账本、生成器脚本 |
| `references/delivery.md` | 构建与交付：webpack 单文件、界面正则/脚本 JSON、CDN/CI、导入步骤、产物完整性与缓存自检 |

## 环境要求

- **知识层零依赖**：任何 agent、任何工作区可读可用。
- **完整落地推荐配套**：SillyTavern + 酒馆助手（JS-Slash-Runner / TavernHelper）+ [StageDog/tavern_helper_template](https://github.com/StageDog/tavern_helper_template)（webpack 构建链）。
- 可选：[MagVarUpdate](https://github.com/MagicalAstrogy/MagVarUpdate)（MVU 变量框架）、可直连的 BGM 音频、任意本地批量生图工具（管线等价即可）。
- 前置门槛：默认你已了解 SillyTavern / 角色卡 / 酒馆助手正则 / React 基础；纯 ST 新手建议先补齐 ST 侧知识再落地。

## 版本

- **2026-09-05 r6**：同步幻璃镜 09-05 修订——BGM 跨楼层出声权仲裁引擎与六条铁律、共享 localStorage 纪律（先读盘再合并 patch / 半失效切内存真相源）、手机端长按自绘选字、发布半截产物防护、手机浏览器 HTTP 缓存自检。
- **2026-09-04 r5**：功能方法论范围声明入册（视觉/审美方向不在范围）；backdrop-filter 禁令收窄为「大面积常驻叠层」并与两蓝本生产用法对齐；官方仓库地址修正为 `gal`。
- **2026-09-04 r3-r4**：双项目蓝本溯源入册；API 基准日与时效协议、路由自检、存在性探针（api-probe.md）；StageDog 模板直链、MIT 许可证、git 更新渠道。
- **2026-09-04 r2**：吸收岁时历/黄历子系统（真实农历 lunarInfo 查表、寿星节气公式、建除十二神宜忌、节气日出日入昼夜漂移）；新增性能与重渲染排查清单；4 条新坑入库。
- **2026-09-04**：首个发布版（自包含可分发炼化版）。

## 许可

[MIT](LICENSE) — 自由使用、修改、再分发，保留署名即可。
