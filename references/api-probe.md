# TavernHelper API 存在性探针

**用途**：把「宿主升级后的静默 API 漂移」变成「响亮的对照表」。skill 的全部 TavernHelper/酒馆助手 API 用法以 architecture.md §8 为权威清单，本探针逐项核对该清单在**当前真实宿主**里是否仍然存在。

**何时跑**：① 新项目动工第一天（阶段 A 之后、阶段 B 之前）；② SillyTavern / 酒馆助手 / MagVarUpdate 任意一方升级后；③ 距上次核验超过 6–12 个月。

## 1. 运行语境（先读，否则误报）

酒馆助手把 TavernHelper 全局函数**注入到它创建的 iframe**（界面正则提升的代码块 iframe、脚本库脚本的执行环境）。因此：

- **正确的跑法**：把探针贴进「脚本库」里一个临时启用脚本的 console.log 环境，或在浏览器 DevTools 的 console 上下文切换器里**选中前端 iframe 上下文**（iframe 有名字，形如 `tavernhelper…`）再粘贴执行。
- **错误的跑法**：直接贴在酒馆主页面 console。主页面 `window` 上没有这些函数——那是注入机制，**不是 API 漂移**，别据此报警。
- 父页两项（`window.parent.$` / `window.frameElement`）必须在 iframe 语境里跑才有意义。

## 2. 探针脚本（零依赖、零副作用——只做存在性检查，绝不调用任何写函数）

```js
(() => {
  const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const probe = (label, get) => { let v; try { v = get(); } catch { v = undefined; } return { label, ok: v !== undefined, detail: typeof v }; };

  const fns = ['getChatMessages','getLastMessageId','setChatMessages','getVariables','updateVariablesWith',
    'eventOn','eventEmit','triggerSlash','generate','generateRaw','getModelList','injectPrompts',
    'getCharWorldbookNames','getChatWorldbookName','getWorldbook','getOrCreateChatWorldbook',
    'updateWorldbookWith','deleteWorldbookEntries','waitGlobalInitialized'];
  const rows = fns.map(n => probe(n, () => window[n]));

  const evts = [
    ['tavern_events.CHAT_CHANGED', () => window.tavern_events?.CHAT_CHANGED],
    ['tavern_events.MESSAGE_RECEIVED', () => window.tavern_events?.MESSAGE_RECEIVED],
    ['tavern_events.MESSAGE_UPDATED', () => window.tavern_events?.MESSAGE_UPDATED],
    ['tavern_events.GENERATION_AFTER_COMMANDS', () => window.tavern_events?.GENERATION_AFTER_COMMANDS],
    ['iframe_events.GENERATION_ENDED', () => window.iframe_events?.GENERATION_ENDED],
    ['Mvu.events.VARIABLE_UPDATE_ENDED', () => window.Mvu?.events?.VARIABLE_UPDATE_ENDED],
    ['Mvu.getMvuData', () => window.Mvu?.getMvuData],
    ['Mvu.replaceMvuData', () => window.Mvu?.replaceMvuData],
    ['Mvu.parseMessage', () => window.Mvu?.parseMessage],
    ['window.parent.$', () => window.parent?.$],
    ['window.frameElement', () => window.frameElement],
  ].map(([l, g]) => probe(l, g));

  const all = [...rows, ...evts];
  const miss = all.filter(r => !r.ok);
  console.table(all);
  console.log(`[api-probe] iframe语境=${inIframe} | ${all.length - miss.length}/${all.length} 存在 | 缺失: ${miss.length ? miss.map(r => r.label).join(', ') : '无'}`);
  if (!inIframe) console.warn('[api-probe] 当前不是 iframe 语境——TavernHelper 函数缺失大概率是注入机制，不是漂移（见 §1）');
})();
```

## 3. 判读规则

- **iframe 语境里缺失** → 真·漂移候选：回到本 skill 对应章节，改用宿主现行等价 API，并把差异记回坑表。
- **非 iframe 语境全红** → 正常，换语境重跑。
- **全绿** → 只证明「存在」，**不证明行为**（如 `updateWorldbookWith` 并发互覆约束、`VARIABLE_UPDATE_ENDED` 回调内直接改写传入 variables 的落盘时序、流式 `MESSAGE_UPDATED` 的楼层号语义）。行为契约的验证仍是阶段 B 真机门（翻楼/发送/重生成/变量收账闭环），探针不能替代它。

## 4. 基准快照（2026-09-04 · SillyTavern 1.18.0）

上述清单在基准日全部存在（幻璃镜与租借男友两项目同期真机运行佐证）。若你跑出缺失，说明宿主已偏离基准——顺带更新本文件的基准行。
