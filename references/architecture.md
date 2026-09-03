# 总架构与事件生命周期

核心决定：**播放屏（GameScreen）不挂任何 `eventOn` 监听**，所有酒馆事件集中在 `store/GameContext.tsx`，事件只把「最新楼层号」和「storyVersion」两个信号推给播放屏，播放屏再用 `getChatMessages` 拉楼层正文做纯函数解析。

## 1. 分层

```
store/GameContext.tsx   ← 唯一的酒馆事件接入点 + 全局游戏状态 + 持久化
components/screens/     ← GameScreen（播放中枢）/ 主菜单 / 其他大屏
components/ui/          ← TypingText / CharacterSprites / HUD / ChatInputWidget / Modal …
scriptParser.ts         ← 纯函数：楼层文本 → ScriptLine[]（零酒馆依赖，可单测）
utils/mvu.ts            ← MVU 适配层（读写/就绪/夹逼/订阅）
utils/interaction.ts    ← 重生成链路
utils/iframeGuard.ts    ← iframe 高度守卫
utils/*Worldbook.ts     ← 前端驱动世界书写入（可选）
data/                   ← 静态资产（图片直链查表）+ 引擎（池/天气等）
```

## 2. 核心数据流闭环

```
酒馆楼层文本
  │ getChatMessages(targetFloorId)[0]
  ▼
GameScreen 解析 effect（deps: targetFloorId/playerName/storyVersion/池注册表）
  │ 扫描池标签 + ensureBinding → dynamicSprites（运行期立绘表）
  │ parseScriptContent / parseOptions / parseSceneImageTag
  ▼
state: script / options / sceneImageInfo / currentIndex
  ▼
逐行播放（handleNext / Auto / Skip / 键盘 / 滚轮 / 触摸）→ 场景CG+立绘+打字机
  ▼
播完（currentIndex >= script.length-1）→ 显示选项 → 点击只"起草"不直发（setPendingMessage）
  ▼
发送：triggerSlash('/send 文本') → triggerSlash('/trigger await=true')
  ▼
酒馆生成：MESSAGE_RECEIVED → MESSAGE_UPDATED(流式) → iframe_events.GENERATION_ENDED
  │ GameContext 监听 → syncLatestFloor / storyVersion++ / finishGenerating
  ▼
lastAssistantFloorId 更新 / setViewingFloorId(null)
  → targetFloorId 变化 → 解析 effect 重跑 → 新楼层剧本 → 播放
```

## 3. 楼层三态模型（viewingFloorId）

```ts
const targetFloorId = viewingFloorId ?? lastAssistantFloorId;
```

- `viewingFloorId === null`：跟随最新（`lastAssistantFloorId` 由事件维护）。
- `viewingFloorId !== null`：回看历史（`isViewingHistory = true`）。
- 楼层列表：`getChatMessages('0-{{lastMessageId}}', { role: 'assistant' })` 扫出全部 assistant 层号。生成期间可用列表裁剪为 `f < generatingFloorId`，防止翻到正在生成的楼层。
- 翻到最后一层时调 `setViewingFloor(null)` 回到跟随模式。

## 4. GameContext 的事件监听表（4 个核心 + 1 个自定义 + MVU 订阅）

| 监听 | 行为 |
|---|---|
| `tavern_events.CHAT_CHANGED` | 重载聊天变量数据（玩家名/业务状态/池注册表）→ `initMvuPipeline()` → `setLastAssistantFloorId(getLatestAssistantId())` → `setViewingFloorId(null)`（切聊天回跟随模式） |
| `tavern_events.MESSAGE_RECEIVED` | `syncLatestFloor()`：生成中更新 `generatingFloorId`，否则更新 `lastAssistantFloorId` |
| `tavern_events.MESSAGE_UPDATED` | `syncLatestFloor()` + **条件性** `storyVersion++`（见防抖） |
| `iframe_events.GENERATION_ENDED` | `setTimeout(300)` 再 sync；非生成状态才 bump storyVersion；此后是钩子区：状态快照世界书等定时写入放 `setTimeout(300~500)` + try/catch（见 worldbook-write.md §7） |
| `<项目名>_story_updated`（自定义） | `syncLatestFloor()` + 无条件 `storyVersion++`——重生成路径（`eventEmit`）的兜底刷新 |
| MVU `onVariableUpdateEnded` | 数值夹逼、业务收账（见 mvu.md） |

`getLatestAssistantId()`：`getLastMessageId()` → 取该层，若非 assistant 回退看前一层。

## 5. 生成生命周期状态机

```ts
const startGenerating = (floorId?) => {
  const lockFloor = floorId ?? viewingFloorId ?? lastAssistantFloorId;
  if (lockFloor != null) setViewingFloor(lockFloor);  // 锁定画面到当前楼层
  setIsGenerating(true);
};
const finishGenerating = () => {
  setIsGenerating(false);
  setGeneratingFloorId(newFloorId); setLastAssistantFloorId(newFloorId);
  setViewingFloorId(null);   // 解锁 → targetFloorId 切到新楼层 → 解析 effect 重跑
};
```

发送流程的「画面锁定→新楼层渲染」全靠 `viewingFloorId` 在 lock/null 之间切换驱动。

### 三处防抖（最易踩坑）

1. **流式生成期间不 bump storyVersion**：MESSAGE_UPDATED 携带的是新楼层号，此时 bump 会让播放屏把锁定中的上一楼层误判为「本楼重生成」而重置回第 0 行（背景/立绘提前切换）。守卫：
   ```ts
   if (isGeneratingRef.current && messageId != null && messageId !== viewingFloorIdRef.current) return;
   setStoryVersion(v => v + 1);
   ```
2. **同楼层正文未变时重解析保持阅读进度**：`lastParseKeyRef` 记录上次 `{floor, story, content}`，只有「同楼层且正文变了」才判定为本楼重生成（清进度从头读）；事件抖动触发的同层重解析保持 `currentIndex`。阅读进度 Map 是模块级会话内存。
3. **GENERATION_ENDED 与 finishGenerating 双路径**：应用内发送流程（isGenerating 中）不在 GENERATION_ENDED 时 bump（finishGenerating 更新 lastAssistantFloorId 本身会触发重算）；本楼重生成的刷新由 `<项目名>_story_updated` 自定义事件兜底。

## 6. 发送用户输入（两条等价通道）

统一走 STScript，**不用** `createChatMessages`/`triggerGeneration`：

```ts
await triggerSlash('/send ' + trimmed);      // 1. 创建 user 楼层（宏/正则/世界书全生效）
await triggerSlash('/trigger await=true');   // 2. 触发生成并 await 完成
```

包在 `startGenerating()` / `finishGenerating()` 之间；失败恢复文本并通知。桌面端主文本框变形内嵌输入与移动端输入组件是同一套两步。

**选项是「起草」而非「直发」**：`handleSelectOption` 只做 `setPendingMessage(option)`，由输入框 effect 填入并等待用户确认发送。

## 7. 重新生成（原位替换，不删楼）

`utils/interaction.ts` 的 `regenerateCurrentFloor`：

1. 取最后一层（须 assistant），向上找最近 user 层作输入；
2. `getChatMessages('0-' + userFloorId)` 截断历史 → `generate({ user_input, should_stream:false, should_silence:true, overrides:{ chat_history:{ prompts } } })` 静默重生成（不建新楼层）；
3. `stripThinking` + 提取主体标签 → `Mvu.parseMessage(parsedWithVars, oldData)` 解析变量；
4. `setChatMessages([{ message_id: lastFloorId, message: maintext }], { refresh: 'none' })` 原位替换楼层内容；
5. `eventEmit('<项目名>_story_updated')` 通知前端刷新。

避免删除再创建导致的「楼层消失」问题。

## 8. TavernHelper 全局 API 实际用法清单（权威用法）

| 全局函数/对象 | 用法 |
|---|---|
| `getChatMessages(id \| '0-{{lastMessageId}}' \| '0-N')` | 读楼层正文/扫描 assistant 楼层/取截断历史；返回数组，`[0].message/.role/.message_id` |
| `getLastMessageId()` | 最新楼层号 |
| `setChatMessages([{message_id, message}], {refresh:'none'})` | 原位替换楼层内容 |
| `getVariables({type:'chat'\|'character'})` / `updateVariablesWith(fn,{type:...})` | 聊天/角色卡变量持久化（玩家名、业务状态、池注册表） |
| `eventOn(tavern_events.X \| eventName)` → 返回 `EventOnReturn`，`.stop()` 反注册 | 全部监听注册 |
| `eventEmit('自定义事件')` | 应用内广播（重生成刷新） |
| `tavern_events.CHAT_CHANGED / MESSAGE_RECEIVED / MESSAGE_UPDATED` | 见监听表 |
| `iframe_events.GENERATION_ENDED` | 生成结束信号 |
| `triggerSlash('/send …')`、`triggerSlash('/trigger await=true')` | 发送用户输入 + 等待生成 |
| `generate({user_input, should_stream:false, should_silence:true, overrides:{chat_history:{prompts}}})` | 静默生成（重生成） |
| `generateRaw({should_silence:true, max_chat_history:0, custom_api:{apiurl,key,model,source,max_tokens}, ordered_prompts})` | 副API独立调用，不入聊天历史（可选，见 §10） |
| `getModelList({apiurl, key})` | 拉取副API模型列表（宿主转发无 CORS；旧版酒馆助手无此函数需提示更新） |
| `getCharWorldbookNames('current')` / `getChatWorldbookName('current')` / `getWorldbook(name)` / `getOrCreateChatWorldbook('current')` / `updateWorldbookWith(name, fn)` / `deleteWorldbookEntries(name, pred)` | 世界书读取/前端写入（可选） |
| `waitGlobalInitialized('Mvu')` / 全局 `Mvu` | MVU 就绪探测、`getMvuData({type:'message',message_id})`、`replaceMvuData(data, opts)`、`parseMessage(text, oldData)`、`Mvu.events.VARIABLE_UPDATE_ENDED` |
| 父页 jQuery `window.parent.$` + `window.frameElement` | 伪全屏（隐藏兄弟楼层 + fixed 定位）与 iframe 高度守卫 |

每个全局函数调用都包 try/catch——前端必须能在浏览器裸跑（无酒馆环境）时不崩，只降级。

## 9. 状态与持久化模式（GameContext）

- **ref 镜像**：所有会被事件回调读到的 state 都维护 `xxxRef.current = xxx`（事件回调闭包拿不到最新 state）。
- **更新三连**：业务更新函数同时更新 React state 与聊天变量（`updateVariablesWith`），一次不可变更新写回——不写两处就会在「切聊天回来」时丢状态。
- **通知系统**：`addNotification(message, type)` + 定时自动清理，卸载时统一 clearTimeout。
- **性能**：value 里的 setter 全部 `useCallback` 稳定化，避免每轮重建导致所有消费方重渲染。

## 10. 副API独立调用（可选）

旁路任务（推演/摘要/评分）不该污染主聊天历史：

- 已配副API → `generateRaw({ should_silence:true, max_chat_history:0, custom_api:{apiurl,key,model,source,max_tokens}, ordered_prompts })`，ordered_prompts 自组 [systemPrompt, systemPrompt(素材), userPrompt(格式)]，另附自取的最近几楼 `<content>` 上下文与世界书上下文（都做字数截断）；
- 未配置 → 回退主连接 `generate()`（自带聊天历史）；
- 解析响应：优先 JSON（先全文 parse，失败取首个平衡 `{...}` 再 parse），再降级按行拆；
- 副API配置存角色卡变量（跨聊天共享）。
