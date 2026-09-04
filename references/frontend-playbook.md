# React 演出层实现手册

打字机、立绘、背景、伪全屏、守卫——galgame 观感的核心都在这里。所有模式来自幻璃镜验证过的实现，可直接照抄。

## 1. 入口（index.html + index.tsx）

`index.html` 是空壳：`<head>` 内联一段样式（html/body/#root 全屏、底色、去滚动条）+ 字体 `<link>`（`display=swap`）；`<body>` 只有 `<div id="root">`。**无任何内联 JS**。

```tsx
// index.tsx —— React 19 入口
const root = createRoot(document.getElementById('root')!);
$(() => {                       // 酒馆助手环境的 jQuery ready，保证 iframe 就绪
  root.render(<App />);
  $(window).on('pagehide', () => root.unmount());   // 楼层 iframe 被销毁时卸载防泄漏
});
```

## 2. 启动守卫（App.tsx）

三件套，全部在渲染前/挂载时执行：

1. **环境白名单** `checkEnvironment()`：`getContext`/`SILLY_TAVERN_VERSION`/（`getChatMessages`+`eventOn` 组合）任一存在才放行；否则 throw，由 ErrorBoundary 显示报错页。
2. **iframe 高度守卫** `startIframeGuard(isMobile)`（见 §3）。
3. 防盗用守卫（可选，模式化需求才做）。

App 结构要点：**播放屏常驻**——`{(screen==='game'||screen==='gallery') && <GameScreen key="game"/>}`，切其他大屏不卸载 GameScreen（阅读进度与弹窗内待采选项全保留）；主菜单用 `AnimatePresence` 覆盖层。

## 3. iframe 高度守卫（utils/iframeGuard.ts）——事件驱动，非暴力轮询

iframe 高度常被酒馆父页重设（切楼层/渲染），守卫负责钉住目标高度：

- 目标高度：`min(默认(移动700/桌面800), 父页视口高度-20)`，且 ≥400。
- 观察者都只触发 `scheduleApply`（rAF 合帧，一帧一次）：
  1. `MutationObserver` 监听 iframe 自身 `style` 属性被外部篡改；
  2. `MutationObserver` 监听父元素 `style/class` 变化；
  3. `ResizeObserver` 监听自身 body 尺寸变化（内容撑高时主动通知父页）；
  4. `window.resize` 兜底。
- 写入时差值比对（>1px 才写），全屏时跳过（`window.__<项目名>Fullscreen` 标志位）。
- `burst()`：退出全屏后 3 次×100ms 快速修复竞态；由 `fullscreenchange` 事件 + 200ms 轮询标志位兜底触发。
- `destroy()`：断开全部观察者并恢复默认高度。

父页访问全部经安全包装：`getParentJQuery()`（`window.parent.$`）、`getSelfIframe()`（`window.frameElement`），跨域时 try/catch 返回 null。

## 4. 伪全屏（GameScreen）

不用 `requestFullscreen` 为主，而是父页 DOM 操作：

1. 用父页 jQuery 向父页 `<head>` 注入 `<style id="tavern-<项目名>-fs-hide">`：`.mes:not([mesid="N"]) { display:none !important }` 隐藏其他楼层；
2. 把自己的 `.mes`（`window.frameElement.closest('[mesid]')`）定位成 `position:fixed` 全屏；
3. 设置 `window.__<项目名>Fullscreen = true`（iframeGuard 据此暂停高度钉制）；
4. 无父页（浏览器预览）时回退 `requestFullscreen`。

## 5. 打字机（components/ui/TypingText.tsx）

- **状态隔离**：打字进度是子组件内部 state，`React.memo` + 自定义比较器只比较少数 props——父组件不因每帧 `setDisplayedText` 重渲染。
- 驱动：`requestAnimationFrame` + 时间累积（非 setInterval）。速度档位：0=瞬发直接显示；≥3=每帧 3 字符；否则按 delay 逐字。
- 跳过：外部传 `skipRef`（播放屏的 `skipTypingRef`），下一帧检测到即瞬间补全全文；`onTypingStateChange(typing)` 上抛打字状态，父组件据此拦截翻页（打字中第一次点击=跳过，第二次=下一行）。
- 音效：非旁白行每批字符 `sfx.playBlip(speaker)`（见 audio.md）。

## 6. 多立绘同屏（CharacterSprites + GameScreen）

- 数据单元 `SceneCharacter { speaker, emotion, sprite, position: 'center'|'right'|'left', isActive }`。
- 播放屏在 `currentLine` 变化时维护 `sceneCharacters`（最多 3 个，`slice(-3)`，位置轮转）；场景 location 变化时清场重建；旁白行全员 `isActive:false`（变暗）。
- **换情绪不换 key**（key=speaker，只换 img src，无交叉淡出）；进场动画按情绪给不同 motion 配置（生气/惊讶=快速 spring 缩放，害羞=淡入上浮）。`AnimatePresence mode="popLayout"`。
- 非活跃角色 CSS：`brightness(0.55) grayscale(0.35) scale(0.96)`；底部渐隐 mask 融入文本框。
- 立绘预加载：解析后对所有 sprite URL `new Image().src` 预热。
- 核心角色（有多情绪差分的）才启用情绪立绘/情绪音效/屏幕特效；非核心强制默认情绪。屏幕特效（shake/flashColor/vignette）可挂总开关 `effectsEnabled`。

## 7. NSFW CG 自动模式（可选）

- AI 输出 `[nsfw:角色:姿态]` 控制行 → 剧本行带 nsfwPose/nsfwCharacter → effect 检测后触发；
- Provider 按角色查 `CHARACTER_IMAGES[c].nsfw` 数组匹配姿态名 → `setNsfwCgUrl(url)`；未命中静默保持当前 CG；
- 背景层 `bgUrl={nsfwCgUrl ?? sceneBgUrl}` 覆盖一切；立绘层传空数组隐藏；
- 楼层切换/重解析时 `resetNsfw()` 复位。

## 8. 背景 CG 优先级链

```
nsfwCgUrl（NSFW 覆盖一切）
→ sceneBgUrl = getLocationImageSmart(场景路径, 天气, 昼夜)   [地点图集：完整路径精确匹配 → 末段模板匹配]
→ 地点随机池兜底（ensurePoolBinding → resolvePoolSceneImage，见 random-pools.md）
→ 纯色/氛围兜底
```

昼夜口径：`<scene_image>` 携带的 time 覆盖 MVU 时钟算出的昼夜。**抽袋有持久化副作用，所以池绑定放 effect 而非 render。**

## 9. 天气与昼夜 → 独立子系统文档

时段天气引擎（季节概率表、马尔可夫 7 日预报、确定性突变、正文回写、AI 注入、视觉叠层）已升为独立文档 **`weather-daynight.md`**。本手册只保留演出层联动点：背景 CG 优先级链里的天气/昼夜查表（§8）、CSS 层级令牌里的天气层 z-[19]（§11）、多角色卡的地点池室外降权（`character-locations.md`）。

## 10. 移动端适配（hooks.ts）

- `useIsMobile(breakpoint=768)`：**手动覆盖优先**（localStorage key + `useSyncExternalStore` 全局 store，可强制开/关），否则 `matchMedia` 自动检测。原因：iframe 中 matchMedia 测的是 iframe 自身视口，电脑全屏时可能误判，必须给用户手动开关兜底。
- 桌面/移动两套布局共用 memo 子组件，`isMobile` 切分支；移动端：触摸滑动翻页、输入常驻底栏、立绘限宽。

## 11. CSS 设计系统（index.css，Tailwind v4 @theme）

- **语义色板**：`--color-xxx` 直接变成 `bg-ink-900` 等工具类。按语义命名（背景墨色/正文纸色/主行动色/次强调/描边金/夜间面板），不用色值命名——换主题只改 @theme。
- **字体三件**：`--font-serif`（正文）、`--font-sans`、`--font-display`（标题/印章用展示字体）。
- **质感类**（按题材设计）：纸张纹理（双层 radial-gradient）、印章（rotate + 展示字体）、发光描边、竖排 `vertical-rl`、自定义滚动条。
- **galgame 演出类**：`.vn-textbox`（顶部渐入+backdrop-blur）、`.nameplate`（名牌，消费 `--plate-accent`/`--plate-glow` 角色主题色变量）、选项条（hover 右移+发光）、统一按钮体系。
- **层级令牌**（注释固定）：场景 z-0/10 → 天气 z-[19] → 文本框 z-20 → HUD z-30 → 弹窗 z-40 → 设置 z-60。动一层全表对一遍。
- **关键帧**：氛围粒子（元素级 CSS 变量控制漂移）、呼吸发光、流光文字（background-clip:text）；`@media (prefers-reduced-motion: reduce)` 统一关停装饰动画。

## 12. 其他值得照抄

- **ErrorBoundary** 包根，环境不合法直接 throw 出报错页。
- **空状态**：script 为空时仍渲染 HUD + 「等待剧情内容」，不白屏。
- **cn 工具**：`cn = twMerge(clsx(...))`（tailwind-merge + clsx）。
- **新手引导**（可选）：步骤位掩码存聊天变量，每次状态变化重算「第一个未完成且满足触发条件的步骤」。

## 13. 性能与重渲染清单（症状 → 解法）

| 症状 | 解法 |
|---|---|
| 列表里点一个节点/编辑一张卡，整个列表重渲染卡顿 | 列表项提取 `React.memo` 子组件（TreeNode / ShelfItem / CardItem 模式），父组件只传稳定 props |
| 播放屏每行台词都重渲染背景/平行事件面板 | 重型静态区块提取 memo 组件（SceneBackground / ParallelEventsPanel 模式） |
| 同一个回调内联写了 3 遍 | 抽 1 个 `useCallback`——内联箭头函数每次渲染都是新引用，传给 memo 子组件会击穿 memo |
| Provider 每轮让全部消费方重渲染 | value 里的 setter 全 `useCallback` 稳定化（见 architecture.md §9） |
| 有轮询定时器在跑 | 有事件就别轮询：`setInterval` → 事件监听驱动 |
| 首屏被大树/大图鉴拖卡 | 懒加载（地点树在弹窗打开时才构建） |

原则：**memo 生效的前提是 props 引用稳定**。内联对象/数组/函数字面量每次渲染都是新引用，等于白 memo——提到组件外当常量，或用 `useMemo`/`useCallback` 包住。动手前先用 React DevTools Profiler 确认重渲染源，再按表落刀。
