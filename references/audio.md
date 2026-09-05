# 音频子系统（打字音效 / 情绪音效 / BGM）

设计纲领：**零外部音频文件**——全部音效用 Web Audio API 程序化合成；BGM 用可直连的音频直链。音频偏好存 localStorage（设备级偏好，不是存档数据，不进聊天变量）。localStorage 键带 `<项目名>` 前缀。

## 1. SFX 音效引擎（sfxPlayer.ts，单例 `export const sfx`）

### AudioContext 生命周期（自动播放策略）

浏览器规定 AudioContext 必须在用户交互后创建。构造函数里挂一次性监听：

```ts
window.addEventListener('pointerdown', initOnce);   // 首次点击/按键
window.addEventListener('keydown', initOnce);       // → init() 创建 ctx + masterGain
// init() 内：ctx.state === 'suspended' 时 resume()
```

所有播放函数开头守卫 `if (!this.ctx || !this.masterGain) return;`——用户没交互过就静默跳过，绝不报错。

### 三个合成原语（所有音效的积木）

```ts
playTone(freq, duration, type='sine', gain=0.2, startOffset=0)
  // 振荡器 + GainNode，exponentialRampToValueAtTime(0.001) 收尾防爆音
playSweep(startFreq, endFreq, duration, type, gain, startOffset)
  // frequency.exponentialRampToValueAtTime 扫频
playNoise(duration, filterFreq, gain, filterType='bandpass', startOffset)
  // 白噪声 buffer + BiquadFilter（bandpass/highpass/lowpass）
```

### UI 音效集（SfxId）

`click`（扫频短促）/ `confirm`（双音上升）/ `tabSwitch`（高通噪声）/ `panelOpen`（上升扫描，+60ms 偏移与按钮 click 声错开成 cascade）/ `panelClose`（下降扫描）/ `pageTurn`（噪声+低音）/ `error`（双音下降方波）/ `achievementUnlock`（上升琶音）。

### 打字音效 blip（逆转裁判式电子嗓音）

与打字机配套，`TypingText` 每批字符调 `sfx.playBlip(speaker)`：

- **确定性音高**：`hashBlipFreq(name)` 名字哈希 → 260~620Hz 之间固定一档——**同一角色永远同调**，路人 NPC 也各有声线；想钉死某角色就在 `CHARACTER_BLIP_FREQ` 表里加名字；旁白（speaker 缺省）用中性低音 210Hz。
- **音色**：方波恒定音高（低通 `min(3000, max(1200, freq*4))` 削刺耳谐波）+ 一记 20ms 带通噪声做起音瞬态（"声母"颗粒感，白噪声 buffer 复用）。
- **抑扬**：相邻 blip 音高 ×1.06 微交替（`blipAccent` 翻转）+ ±2% 随机失谐。
- **节流按时间不按字符**：`blipGapMs(interval)` 由密度档位定（2=60ms / 3=85ms / 4=115ms），`ctx.currentTime` 与上次间隔比较——出字再快也保持均匀点射节奏。
- 设置项：`volume`（默认0.3）/ `muted` / `blipEnabled` / `blipInterval`，localStorage 键 `<项目名>-sfx-settings`，逐项类型校验回退默认。

### 情绪音效 playEmotion(emotion)

情绪名 → 合成短语，每种情绪一个固定配方，例如：生气=低频锯齿+低通噪声、惊讶=高频下扫、开心=大三和弦琶音、伤心=下行双音。与屏幕特效（shake/flash/vignette）同源触发，核心角色限定。

## 2. 设置共享层模式（pub-sub store + useSyncExternalStore）

模块级单例状态 + subscribe + `useSyncExternalStore` hook，值得照抄：

```ts
export const bgmBridge = {
  getState, getVolume, getMuted,
  setVolume, setMuted, toggleMuted,
  subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
};
export function useBgmSettings() {
  return useSyncExternalStore(bgmBridge.subscribe, bgmBridge.getState);
}
```

- localStorage load 时逐字段 `typeof` 校验，坏数据回退默认值。
- 作用：设置面板与悬浮播放器读写同一份音量/静音，无需提升 state 到 Provider。

文本设置同构：`textSpeed: 0=瞬间/1=慢55ms/2=普通28ms/3=快10ms`（`getTextDelay(speed)` 供打字机用），`autoWaitMultiplier` 0.5~2 供 Auto 模式定时用。

## 3. BGM 播放器（MusicPlayerWidget.tsx）

- **曲库**：文件顶部 `const TRACKS: Track[] = []`（`{id, title, meta, url}` 直链，mp3/ogg/m4a，需允许跨域引用）。**曲库为空时整个挂件不渲染**——填上直链自动出现。
- **播放核心**：单个隐藏 `<audio preload="metadata">`；切曲 effect 里 `a.src !== absolute` 才换 src + load，按 isPlaying 续播；`a.play().catch(() => setIsPlaying(false))` 吞掉自动播放拒绝。
- **三种模式** `PlayMode = 'list'|'loop'|'shuffle'`：loop 直接 `audio.loop = true`（ended 不会触发）；list 用 `(i+1)%len`；shuffle 用 `Math.random()`。
- **音量同步**：effect 监听 store → `a.volume = getEffectiveBgmVolume()`（静音=0）。
- **悬浮球可拖拽**：pointer capture + 6px 移动阈值区分"拖动"与"点击"（未拖动的 pointerUp = 展开/收起面板）；位置存 localStorage `<项目名>-music-pos`，clamp 在视口内；展开面板 fixed 定位跟随球，放不下自动翻转（上方→下方）并 clamp。
- 所有按钮 `sfx.play('click')`；唱片旋转动画受全局 `effectsEnabled` 总开关约束。
- 音量滑条：透明 range input 叠在自绘进度条上（自定义外观）。

## 4. 跨楼层 BGM 出声权仲裁（多楼层必读，r6）

酒馆正则把**每个 AI 楼层都替换成整套应用的 iframe**——每个 iframe 都 import 一份引擎（模块级单例）、都有潜在 `<audio>`。楼层多于一个后不裁决，就会多楼层同时出好几首曲子。§3 的单层播放器是基线；要支持多楼层，加一层与具体曲库无关的仲裁：

### 架构要点

- **意图与出声权分离**：
  - **意图**（放不放 playing、第几曲、播放模式）存 localStorage 共享区 `<项目名>-bgm-shared`，同源各层互通；任何楼层的遥控器改动全体同步。
  - **出声权**（fgMid = 楼层 mesid）属于**最后一个含本应用 iframe 的楼层**——不看可见性：全屏读旧楼层时新楼层一到即接管，旧层让位静默。识别同应用楼层：每个引擎在 window 挂 `__<项目名>_APP__` 标记，只统计带标记的后续楼层（用户消息楼层、无关脚本 iframe 不算）。
  - 可选：曲库按场景分模块，模块自动档由上层逻辑喂入，manual > auto > 无。
- **每 500ms tick 巡检**：兜底 storage 事件缺失 + 出声权裁决 + 起播重试。
- **音频元素只在出声楼层创建**（隐藏 `<audio>`）；非出声层恒静默。
- **自动播放策略**：起播被拒挂一次性 pointerdown/keydown 补播 + tick 周期重试（永远按共享区状态驱动，被拦后下次对账自动补上）。
- **进度持久化**：出声楼层每秒把 `fgTime`（秒）/`fgKey`（曲键）写进共享区；接管楼层加载到**同曲**时 `loadedmetadata` 后 seek 接续，换曲从头播。

### 六条铁律（每条都是踩过的真坑）

1. **writeShared 先读盘再合并 patch**——绝不用本地（可能过期）状态整包回写，否则把别的楼层刚写的 playing/fgMid/trackIdx 回滚：表现为暂停被撤销、出声权反复易主（齐鸣/忽大忽小）、曲目从头重播。
2. **togglePlay 按共享区最新值翻转**（`!loadShared().playing`），不按本地旧值。
3. **曲内进度进共享区**（见上），否则每次出声权移交/切层都从头重播。进度字段与 UI 字段**分离对账**（只比较 UI 字段再 notify/apply），否则每秒进度写会触发全楼层 React 重渲染。
4. **mesid 探测瞬时失败不能永久缓存 null**——null 语义是「独立预览 = 永远出声」，一失败就固化会让该层永远自认出声层、不受任何裁决；探测期（约 30s）每 tick 重试，之后才固化。
5. **同 iframe 重复执行防御**：window 挂 `__<项目名>_BGM_INSTANCE__`，重执行先 dispose 旧实例（停巡检、移除 audio），防双 `<audio>` 齐鸣；dispose 后的实例不再读写共享区。
6. **localStorage 半失效（读得出写不进）切内存真相源**：读写一旦抛错立刻置 storageBroken，之后以内存态为准——否则巡检把盘上旧 playing:true 读回来，暂停永远不生效。**绝不能用默认值兜底**（默认 playing:true 会复活播放）。此模式适用于任何「多 iframe 共享 localStorage」的状态层（§2 音量/静音共享层同理）。

### 遥控器纪律

遥控器是纯 UI：读共享意图（各层一致）渲染；播放/切歌/选模块/模式全部转交引擎写共享意图，不直接碰 audio。三种模式 `PlayMode = 'list'|'loop'|'shuffle'` 语义不变。**面板角落渲染引擎修订号**——玩家自检设备上加载到了哪一版（CDN purge 清不掉手机浏览器自身 HTTP 缓存，见 delivery.md §7.5）。

### 已知平台边界

iOS Safari 的 `HTMLMediaElement.volume` 只读——音量滑条在 iPhone 上调不动实际响度；要彻底解决需 Web Audio 路由（MediaElementSource + GainNode），属独立改造。
