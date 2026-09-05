# 全量踩坑字典（症状 → 原因与正解）

> 来源：幻璃镜 + 租借男友双蓝本真机踩坑蒸馏（原 walkthrough 篇与 kit 篇同源合并），另收施工指南新增条目。
> 用法：施工中遇到症状先查本表；没查到再怀疑新问题——**每条正解都是真机验证过的，不要发明替代方案**。

## 1. 协议与解析

| 症状 | 原因与正解 |
|---|---|
| 楼层正文解析为空 | AI 输出没包 `<content>` 标签；解析器必须有降级路径：剥思维链后全文视为剧本 |
| 旁白里的引号台词被误认成对话 | 做了自由文本扫描；只做**行首整行匹配**——`user笑了笑:"…"` 天然不匹配对话正则 |
| 同一楼层重 roll 后正文残留思维链 | stripThinking 有多处实现且不一致；**合并为单一工具函数**，播放解析/历史视图/重生成三个入口统一用一份 |
| 混合型思维链剥不干净（如 ⋘…`</think>`） | THINKING_PAIRS 只处理成对标签；需追加混合标签与前缀截断型规则（gi 标志） |
| 选项经常解析不到 | AI 记不住单一格式；**三路并取**：`<options>` 块 `>` 前缀行 / `<choice>` 块 / 多个独立 `<choice>`，去重合并 |
| `[人物:名,键=值]` 标签后对话匹配失败 | 标签和对话写同行；检测行首标签前缀后**把标签替换为其中角色名**再走对话正则 |
| 变量更新块显示在画面上 | 前端试图解析/剥离变量块；**前端不解析变量更新**——MVU 框架落盘，`<content>` 限定可播范围后残留块被显示层正则藏掉 |
| 情绪标签对应不到立绘 | EMOTION_MAP 查不到时没有 fallback；取不到**必须 fallback 默认情绪**，再 fallback 运行期动态立绘 |
| 控制行只影响当前行 | 状态机写成行内处理；控制行是**从此生效直到下一个控制行**的继承语义（逐楼快照） |
| 数值字段收到字符串 "85" 崩溃 | Zod schema 用 `z.number()`；用 `z.coerce.number()` 容忍 AI 输出字符串数字 |

## 2. API 归属与宿主探针

| 症状 | 原因与正解 |
|---|---|
| 教程/代码里写了 `getAssistantFloors()`，运行时 undefined | **酒馆助手没有这个全局函数**；楼层列表用 `getChatMessages('0-{{lastMessageId}}', { role: 'assistant' })` 自己扫 |
| 把 `setViewingFloorId` 当酒馆 API 找 | 它是**前端 GameContext 自己的 state setter**（三态模型：null=跟随最新）；不存在的宿主 API 一律先探针再信 |
| 探针在主页面 console 全红 | TavernHelper 函数注入在 iframe，主页面 `window` 上没有——**不是漂移；切到 iframe 语境重跑** |
| 探针全绿但功能行为不对 | 存在 ≠ 行为契约：签名、参数、返回值要以真机实测为准（api-probe §3 证据边界） |
| 浏览器裸跑白屏（ReferenceError） | 酒馆全局函数没包 try/catch；**每个全局调用包 try/catch**，读不到回退占位值——前端必须能在纯浏览器预览 |
| 宿主升级后功能集体异常 | 宿主升级或距基准日（2026-09-04）超期未重验；升级后先跑探针再动工 |

## 3. 事件与楼层生命周期

| 症状 | 原因与正解 |
|---|---|
| 播放位置莫名跳回第 0 行 | 流式生成期 `MESSAGE_UPDATED` 携带新楼层号时 bump 了 storyVersion；**仅当被更新的正是锁定中的楼层时才刷新**（防抖①守卫） |
| 生成期间画面被新楼层顶掉 | 没做生成锁；`startGenerating` 先 `setViewingFloorId(锁楼层)`，`finishGenerating` 再 `setViewingFloorId(null)` 解锁自动落新楼 |
| 同层事件抖动导致阅读进度丢失 | 重解析无条件清进度；`lastParseKeyRef` 记 `{floor, story, content}`，**只有同楼层且正文变了**才清进度（防抖②） |
| 重 roll 后刷新不生效 | 只靠 GENERATION_ENDED 一条路径；应用内生成结束走 finishGenerating，**重 roll 的刷新由 `<项目名>_story_updated` 自定义事件兜底**（防抖③双路径） |
| 切聊天后数据错乱 | 没监听 `CHAT_CHANGED` 重建 state；聊天变量读取失败要 try/catch 返回 null |
| 事件回调里读到旧 state | 事件回调闭包拿不到最新 React state；**ref 镜像**：`xxxRef.current = xxx` 全量维护 |
| 翻楼翻到正在生成的楼层 | 楼层列表没裁剪；生成期间列表裁剪为 `f < generatingFloorId` |
| 楼层列表拿不全 | 只用了 `getLastMessageId` 取末层；用 `getChatMessages('0-{{lastMessageId}}', {role:'assistant'})` 扫全部 assistant 层 |

## 4. 演出与性能

| 症状 | 原因与正解 |
|---|---|
| 打字机吐字时立绘/CG/文本全在重渲染，非常卡 | **打字机放进了主画面组件**（头号禁令）；打字进度收进 `TypingText` 子组件内部 state + `React.memo` 自定义比较器，父组件对每帧吐字零感知 |
| 列表每操作一次整体重渲染卡顿 | 列表项未提取 memo 子组件，或给 memo 子组件传了**内联函数/对象**（每次新引用击穿 memo）；回调抽 `useCallback`，静态区块提取 memo 组件 |
| Provider 每轮让全部消费方重渲染 | value 里的 setter 没稳定化；全部 `useCallback` |
| 有轮询定时器在跑导致卡顿 | 用 `setInterval` 轮询本可事件驱动的事；**有事件就别轮询** |
| 首屏被大树/大图鉴拖卡 | 没懒加载；重数据在弹窗打开时才构建 |
| 立绘换情绪时闪烁/重挂载 | key 里带了 emotion；**换情绪不换 key**（key=speaker 只换 img src） |
| 封面/渐变/标签色静默失效（无报错无日志） | 把 Tailwind 裸类名当 CSS 色值写（style 或 linear-gradient 里出现 `bg-ink-900`）；类名不是色值，用 `var(--color-ink-900)` 语义变量 |
| 天气特效全屏白屏 | **大面积常驻叠层用了 backdrop-filter**（部分浏览器 iframe 上下文白屏）；换半透明色块 + Canvas 粒子；小面积 backdrop-blur（文本框/弹窗）真机安全。判据 = 层面积 × 常驻时长 |
| 白屏 / CSP 报错 / react hook 报错 | react/react-dom 被 external 外链导致双实例；webpack 中**强制打包勿 external** |
| 动效打扰用户 | 没做减弱动效；`@media (prefers-reduced-motion: reduce)` 统一关停装饰动画 |

## 5. MVU 与变量

| 症状 | 原因与正解 |
|---|---|
| 收账夹逼不生效 / 拿到旧值 | 在 `VARIABLE_UPDATE_ENDED` 回调里用 `getMvuData` 重读；**直接改写传入的 variables**，框架随后落盘 |
| MVU 缺席（未装脚本/纯浏览器）前端崩溃 | 适配层没做降级链：楼层 MVU 数据 → 聊天变量 → 本地占位常量，**全部静默不抛错** |
| MVU 一直未就绪卡死 | `waitGlobalInitialized('Mvu')` 没带超时；**带超时竞速**（默认 8s），超时回退 `window.Mvu` 探测再降级 |
| AI 输出的数值越界 | 信任了 AI 数字；业务读取**逐字段夹逼** + 缺失回退默认值 |
| 旧聊天没有初始变量 | 只依赖 `[initvar]` 一次性初始化；种子写入 `seedStatDataIfMissing` 对旧聊天同样生效（优先 `Mvu.replaceMvuData`，回退 `updateVariablesWith`） |
| 变量更新指令出现在画面上 | 见 §1「变量更新块显示在画面上」——前端不解析变量更新 |

## 6. 多 iframe 共享状态 / BGM（每层一个 iframe 的世界）

| 症状 | 原因与正解 |
|---|---|
| 暂停 BGM 后马上又自动播放 | 多坑叠加：① writeShared 用本地过期状态**整包回写**回滚了别层的值——必须**先读盘最新值再合并 patch**；② 手机端 localStorage「读得出写不进」，巡检把盘上旧 playing:true 读回——读写失败立刻切**内存真相源**，绝不能用默认值兜底；③ togglePlay 按共享区最新值翻转，不按本地旧值 |
| 多楼层 BGM 齐鸣 / 声音忽大忽小 | 每层 iframe 一份引擎，出声权仲裁被过期回写打架；楼层探测瞬时失败被**永久缓存 null** 的楼层永远自认出声层——探测期每 tick 重试再固化 |
| 出声权移交/切楼层后 BGM 从头重播 | 曲内进度没进共享区；**每秒写进度键**且与 UI 字段分离对账（避免进度写触发全楼层重渲染），接管楼层加载到同曲才 seek 接续 |
| 同一 iframe 出现两个引擎 / 双 BGM | 脚本被正则重渲染重复执行；window 挂 `__<项目名>_BGM_INSTANCE__` 标记，重执行**先 dispose 旧引擎**（停巡检、移除 audio） |
| 点了页面没声音 | AudioContext 被自动播放策略拦了；**必须等首次 pointerdown/keydown 再创建**，每次播放前守卫 ctx 为空静默跳过 |
| BGM 悬浮球不出现 | TRACKS 曲库数组为空时挂件整个不渲染（设计行为）；填直链自动出现 |

## 7. 天气 · 日历 · 地点池

| 症状 | 原因与正解 |
|---|---|
| 天气特效和 AI 看到的天气对不上 | 只改了渲染状态没写回预报缓存；突变/扰动必须 `setCurrentPeriodWeather` **落预报**，所有消费方统一走 `getWeather()` |
| 黄历宜忌同一天两次打开内容不一样 | 用了随机抽宜忌；应用**建除十二神**（日支与月支关系确定性定神）或确定性种子 |
| 节气/农历日期差一天 | 用了固定近似日期表；节气需**天文公式按年算**（寿星公式），农历用 lunarInfo 查表（1900-2100） |
| 冬天傍晚场景还是白昼 CG | 昼夜判定固定 6/18 点；按**节气日出日入表漂移**（冬至约 17 点已入夜，夏至 19 点仍是昼） |
| 地点随机每次刷新都变 | 随机种子不含日期/小时；种子必须含**角色+日期+小时** |
| 全员同一时刻集体换位置 | 种子缺角色维度；种子同时含角色+日期+小时 |
| 访客出现在主人不在家的住所 | 串门条目没在加权前过滤；**主人被正文 override 时视为不在家**，先预计算主人在家表（skipVisitSpots 防递归）再逐角色选位 |
| 加权随机修改了原始配置数组 | 权重修正直接改原数据；**生成新数组不改原数据** |

## 8. 交付 · CDN · 缓存

| 症状 | 原因与正解 |
|---|---|
| 玩家拿到半截产物（行为诡异/白屏） | 构建与发布串在同一条命令里，`git add` 读到没写完的大文件进截断 blob；**先 build 完全结束再单独 publish**；发布后核对 CDN 字节数 == 本地 `fs.statSync().size`（别比字符串长度，别拿 `</html>` 当结尾——单文件产物以 `</body>` 收尾） |
| 发新版用户不更新 | `@master` 有 CDN 缓存；发布打 tag、必要时换仓库名/路径强刷 |
| purge 了 CDN 还是旧版 | purge 只清 jsDelivr **边缘缓存**，清不掉**手机浏览器自身 HTTP 缓存**（@master 可缓存约 12h）；UI 放**可见版本号**让玩家自检 + 引导清缓存/无痕窗 |
| 正式 JSON 在别人机器上加载失败 | 正式 JSON 里出现了 `localhost`；**只允许**出现在默认禁用的「实时修改」开发 JSON 里 |
| 变量解析全乱 / AI 行为异常 | 界面正则 `placement` 写错（如 [1] 改了提示词）；必须 `placement:[2]` **仅显示层** |
| 重复导入脚本产生多个副本 | 脚本 JSON 的 `id` 每次随机；**固定 UUID** 重复导入覆盖同位脚本 |
| push 被拒 `! [rejected] (non-fast-forward)` | CDN 仓库被网页端手动改过；勿强推，核对后处理 |
| CDN 404 | 等 5 分钟 + 确认仓库 Public |
| 发布产物混入调试文件 | 发了整个文件夹（.map、LICENSE.txt 一起上去）；**只发指定产物文件** |

## 9. 手机端

| 症状 | 原因与正解 |
|---|---|
| 手机检测误判 | iframe 里 `matchMedia` 测的是 **iframe 视口**（电脑全屏时误判）；localStorage 手动覆盖开关兜底（`useSyncExternalStore` 全局 store） |
| 长按正文选词弹出系统复制/粘贴条 | 原生文本选择的系统菜单在 iframe 里压不掉（**iOS 无解**）；手机端改**自绘选字**：逐码点 span + 长按起选/滑动扩选/落指提交，容器 select-none；桌面保留原生划词 |
| 自绘选字索引错位/切坏 emoji | 按 UTF-16 下标切中文正文；**按码点 `Array.from`** 切分与切片 |
| 退出全屏后 iframe 高度错乱 | 全屏改了父页内联样式，退出后未恢复；**burst（3 次×100ms）**修复竞态，事件驱动守卫常驻 |

## 10. 图资产与生图

| 症状 | 原因与正解 |
|---|---|
| 生图删图重跑还是同一张图 | Images API 被中转站缓存；**切 Chat API 端点模式** |
| src/data/*.ts 里的图 URL 手改后被覆盖 | 这些文件是生成器产物；要改图走生图工具上传 + 重跑生成器 |
| 背景图找不到（路径明明存在） | 只做了完整路径精确匹配；**完整路径 → 末段模板匹配**两级查表 |

## 11. 已评估弃置（勿再提议）

| 变体 | 弃置原因 |
|---|---|
| 统一视图（脚本 JSON 引导单 iframe 覆盖全部聊天、隐藏原生楼层） | 无价值；双蓝本均未采用，不纳入交付清单，勿再从蓝本里吸收 |

## 12. 施工纪律坑（流程性）

| 症状 | 原因与正解 |
|---|---|
| 阶段做完了但「不知道算不算做完」 | 没定验收门；每阶段开工前先写清验收证据（本地/真机分开），做完拿证据汇报 |
| v1 越做越大 | 决策清单没冻结范围；九决策点定完立即冻结 v1 必做清单，新想法进扩展篇排队 |
| 多项目共存互相污染 | 没做命名前缀；localStorage 键/window 标志/事件名/scriptName/世界书条目**第一天定死** `<项目名>` 前缀 |
| 后补 MVU 要迁移数据 | 变量系统延后了；MVU 早搭便宜（后补要迁移），建议 v1 就带降级版 |

## 13. 里程碑踩坑清单（坑 1–36，按施工阶段分组，带双蓝本源码出处）

> 本节原载 from-zero 教程「07-踩坑清单」，**编号保持不变**——`11-排障决策树.md` 与其他文档里的「坑 N」一律指本节同号条目。每条 = 症状 → 根因 → 解法，出自两个参照项目的真实代码与注释（`文件:行号` 是出处记忆，不是查阅路径——本 skill 自包含，无需随附源码）。有现象不知对应哪条坑 → 先查 `11-排障决策树.md`。

### 协议与解析（对应施工阶段 S1）

1. **打字机写进主画面组件** → 每吐一字 setState，立绘/CG/文本全量重渲，卡死。→ 打字机独立组件内部自持状态 + `React.memo` 自定义比较器 + rAF（`TypingText.tsx` 头注释原文："将打字机状态隔离在独立组件内，避免每帧 setDisplayedText 触发父组件重渲染"）。
2. **对话行带前后缀**（`user笑了笑:"…"`）→ 正则全行锚定匹配不上，整行掉旁白。→ COT 强制"动作描写绝对不许混进对话行"；想让角色边动边说，拆成旁白行 + 对话行。
3. **全角标点**（`“”：`）→ 匹配失败。→ COT 显式自检"引号和冒号全是英文半角"。
4. **思维链里出现 `<content>`** → 先提取正文被污染。→ 顺序铁律：先 `stripThinking` 删所有思维标签对，再 `/<content>…<\/content>/` 提取（`租借男友 scriptParser.ts:72` 注释原文）。
5. **思维标签变体漏剥**（`<thinking>`、`<Chain_of_Thought>`、`<draft>`、`<simple_thinking>`、`⋘…</think>`、`</konatan_planning~>` 前缀）→ 正文/历史残留不一致。→ 剥离清单取并集（`幻璃镜 stripThinking.ts:13-11` 头注释："合并自三处不一致的实现"）。
6. **AI 用玩家名/`我` 代替 `<user>`** → 被当成 NPC 配立绘。→ `isUser(speaker, playerName)` 三重兼容（`scriptParser.ts:114-118`）。
7. **AI 忘写情绪标签** → 差分查图落空。→ 解析层折算 `'默认'`，查图再回退默认图（`EMOTION_MAP['默认']` + `|| char.sprites['mo-ren']`）。
8. **中文情绪名 ≠ 素材 key**（AI 写"开心"，图片文件叫 `kai-xin`）→ `EMOTION_MAP` 中文→拼音 key 一张表解决（`scriptParser.ts:24-35`）。

### 立绘与场景（对应施工阶段 S3）

9. **`<user>` 挤占立绘槽** → 玩家占 center、真立绘被压小。→ 解析层玩家行 `sprite/avatar` 置空 + 装配层 `isPlayerSpeaker` 跳过（`GameScreen.tsx:550-554`）。
10. **同屏角色越堆越多** → 画面挤爆。→ 槽位只有 `center/right/left` 三个 + `slice(-3)` 顶掉最老（`GameScreen.tsx:569-572`）。
11. **旁白/玩家发言时立绘闪没** → 直接清台丢位置记忆。→ `hidden:true` 暂退淡出、原位淡入，仅换景才清台（`GameScreen.tsx:550-554` 注释原文）。
12. **换差分闪一下** → 图未预载。→ 解析完对全部 sprite `new Image().src` 预热（`GameScreen.tsx:493`）。
13. **`[scene:]` 缺图黑屏** → 逐级截短路径回退 + 保留旧背景 + 控制台 warn 缺图清单。

### 发送与楼层（对应施工阶段 S4）

14. **`/trigger` 不带 `await=true`** → `finishGenerating` 在生成结束前就执行，画面提前解锁。→ `await triggerSlash('/trigger await=true')`，且解锁放 `finally`。
15. **生成期间画面漂移** → 新楼到达就跳。→ `startGenerating` 把 `viewingFloorId` 钉死，`finishGenerating` 里 `setViewingFloorId(null)` 归位自动跳新（`GameContext.tsx:570-587`）。
16. **流式期间被 `MESSAGE_UPDATED` 重置回第 0 行** → 该事件携带的是新楼号。→ `messageId !== viewingFloorIdRef.current` 时跳过刷新（`GameContext.tsx:618-626` 注释）。
17. **回看历史再回来，阅读进度丢了** → 重解析无条件 `setCurrentIndex(0)`。→ 按楼存进度 + "上次解析 key"比对，仅本楼内容真变才清零（`GameContext.tsx:479-521`）。
18. **本地预览直接崩** → `triggerSlash`/`getVariables` 不存在。→ 全局函数先 `typeof === 'function'` 判空，降级路径静默（`ChatInputWidget.tsx:47-60`）。

### 删楼重roll 与 MVU（对应施工阶段 S5）

19. **用 `deleteChatMessages` 删楼** → 只清空内容，楼壳还在照常渲染空 iframe。→ 用 `/cut`（`DeleteFloorModal.tsx:41` 注释）。
20. **重roll 后历史裸奔** → `overrides.chat_history` 绕过 `/hide` 与"仅格式提示词"正则，全部历史原文发出。→ 手动裁窗口只留最近 5 层 AI 楼（`interaction.ts:92-110`）。
21. **重roll 不重算变量** → 时间/地点停在上一次。→ `Mvu.parseMessage(剥链全文, 该楼旧变量)` 以旧值为基线重算（`interaction.ts:137-144`）。
22. **MVU 没装/没就绪直接白屏** → 就绪探测带超时 + 读不到走占位值 + 写种子补缺字段，全程 try/catch 静默降级（`mvu.ts:15`）。
23. **`VARIABLE_UPDATE_ENDED` 里用 `getMvuData` 重读** → 时序拿到旧值。→ 直接改写入参 variables，框架随后落盘（`mvu.ts:112-115` 注释）。
24. **刷新用 `location.reload()`** → 退出全屏、丢全部前端状态。→ 自定义事件（`mirage_story_updated`）让各楼 iframe 自刷新。

### 全屏与守卫（对应施工阶段 S6）

25. **原生全屏失败就黑屏** → `requestFullscreen` 可能被拒。→ 伪全屏（`.mes` fixed 100vw/100vh + z-index 99999）兜底，两者并存（`GameScreen.tsx:274-279`）。
26. **退出全屏后 iframe 高度错乱** → 父页样式竞态。→ 事件驱动守卫 + 退出后 burst 3×100ms 修复（`iframeGuard.ts:9`）。
27. **锁定期新楼冒出来** → CSS 只对既有楼层生效。→ MutationObserver 盯 `#chat`，新插入 `.mes` 当场 `display:none`（锁定前端 `index.ts:194-208`）。
28. **只藏不拦，iframe 还是被拆** → CSS 管"看不见"，不管"被销毁"。→ 注入父页脚本包三条删除路径：`HTMLIFrameElement.prototype.remove`、`Node.prototype.removeChild`（含嵌套包含检查）、`jQuery.fn.remove`（剔除出集合），`__tavernLockCleanup` 可还原（锁定前端 `index.ts:36-136`）。

### 工程与交付（全程）

29. **CDN 缓存吃掉新版本** → 改版后酒馆里还是旧前端。→ bump 仓库/分支名（参照项目历史提交："CDN 地址更新为 yaoguai8/9 仓库"）。
30. **iframe 泄漏** → 楼层切走不卸载。→ 入口 `$(() => { render… })` + `$(window).on('pagehide', () => root.unmount())`（`幻璃镜/index.tsx`）。

### 扩展组件（扩展篇）

31. **台词里的"晴/雨"改了系统天气** → 天气回写扫了全文。→ `extractWeatherFromText` 只扫 `<content>` 内旁白行：过滤含 `]:"` 的对话行、`<user>` 行、心理行，再按优先级关键词表匹配（`weather.ts:287-309`）。
32. **天气忽晴忽雷跳变** → 纯随机。→ 季节概率表 + 持续性因子 + 相似性分组 + **种子取楼层号**（同楼稳定不抖），约 10% 才突变（`weather.ts:99-187`）。
33. **世界书条目每楼重写一遍 / 被手动删掉就永远消失** → 无幂等键、无补回。→ 版本键（内容版本+状态）存聊天变量，没变零开销跳过；`updateWorldbookWith` 里条目缺失就补回；模板变更时内容版本 +1 让旧聊天自动重写归一，"宁可重写，不可缺条"（`almanacWorldbook.ts` 头注释与实现）。
34. **池子配错图**（正文写女性出男性图）→ 属性放宽无纪律。→ 性别是硬约束永不放宽，逐级只放宽形态→类别→年龄，候选取尽仍无就**不配图**（`evilPoolEngine.ts:96-115` 注释："宁可不配图也不配错图"）。
35. **AI 后续楼层"掉标签"，NPC 立绘消失** → 只认当楼标签。→ 绑定登记表持久化到聊天变量，解析本楼前先从登记表补回历史 NPC 的立绘（`GameScreen.tsx:461-470`）。
36. **手机内容混进主楼正文** → 用主 API 生成社交内容。→ 小手机全部走副 API `generateRaw({ should_silence:true, max_chat_history:0, custom_api })`，与主楼隔离；副 API 未配置置灰降级（`PhoneContext.tsx` / `GameContext.tsx:1186-1224`）。
| 世界书条目内容互相丢失 | 并发调 `updateWorldbookWith` 读改写互覆；**串行 `.then()` 链**执行 |
