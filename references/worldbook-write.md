# 前端驱动的世界书写入（可选子系统）

**前端把游戏状态同步进世界书**——AI 每轮要看到最新状态。条目名统一带 `<项目名>` 前缀。

## 1. API 面

```ts
getOrCreateChatWorldbook('current')        // 取或建聊天世界书，返回名称
getCharWorldbookNames('current')           // 角色卡世界书 { primary, additional[] }
getChatWorldbookName('current')
getWorldbook(name)                         // 读条目数组
updateWorldbookWith(name, wb => nextWb)    // 读改写：传入条目数组，返回新数组
deleteWorldbookEntries(name, entry => bool)
```

## 2. 蓝/绿灯选型原则

```ts
const ACTIVE_ENTRY_TEMPLATE = {     // 蓝灯（constant）：AI 每轮可见
  enabled: true,
  strategy: { type: 'constant', keys: [], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
  position: { type: 'at_depth', role: 'system', depth: 0, order: 200 },
  probability: 100,
  recursion: { prevent_incoming: true, prevent_outgoing: true, delay_until: null },
};
const CLOSED_ENTRY_TEMPLATE = {     // 绿灯（selective）：带关键词按需激活
  strategy: { type: 'selective', keys: [...关键词], … },
  position: { type: 'after_character_definition', role: 'system', depth: 0, order: 200 },
  …
};
```

- **蓝灯**用于「环境状态」——当前时间地点、进行中事务、状态快照。状态变化发生在玩家行动那一刻，不能靠关键词触发。
- `at_depth:0 system, order 200`：与格式条目同层（D0 内容读取最稳），同深度按 order 排序合并。
- **绿灯**用于「已完结史料」——完结事务转为 selective + 结案关键词，节省 token。
- `recursion.prevent_incoming/outgoing: true` 防条目互相触发失控。

## 3. upsert 幂等写法（所有条目操作的标准形）

```ts
await updateWorldbookWith(wbName, wb => {
  const idx = wb.findIndex(e => e.name === entryName);
  if (idx >= 0) {
    const next = [...wb];
    next[idx] = { ...next[idx], content, ...TEMPLATE };   // 重写时用模板归一托管字段 → 自愈旧版/被改坏的条目
    return next;
  }
  return [...wb, { name: entryName, content, ...TEMPLATE }];  // 不存在（新聊天/被手删）→ 追加补回
});
```

- 条目名用**稳定 ID**（如 `档案_${id}`）而非业务名——改名只改 content，条目名不变。
- 每次重写都归一模板字段（推荐，自愈力最强）。
- 全部 try/catch + console.warn，失败不抛出阻断主流程。

## 4. 单条目幂等翻页（状态快照条目的标准模式）

固定**单条**蓝灯条目（如「黄历_今日」），翻页 = 整条重写 content（旧内容不残留，prompt 里永远只有当前状态）：

```ts
const CONTENT_VERSION = 1;   // 模板/映射表/条目配置变更时 +1 → 旧聊天自动重写归一
// 状态键 = `v${版本}-${年}-${月}-${日}-${相关状态摘要}`
const nextKey = …;
const vars = getVariables({type:'chat'});
if (vars?.[STATE_KEY] === nextKey) return false;   // 没变 → 零开销跳过
// …updateWorldbookWith 重写…
updateVariablesWith(vars => ({...vars, [STATE_KEY]: nextKey}), {type:'chat'});  // 记键
```

- 读不到聊天变量时继续走写入路径：**宁可重写，不可缺条**。
- 内容由纯本地计算生成（零 AI API）。
- 触发点：CHAT_CHANGED、时间同步回调、以及任何可能跨状态的时机——ensure 函数自己把关，调用方无脑调即可。

## 5. 并发互覆问题（实战真坑）

`updateWorldbookWith` 是读-改-写；两次并发调用会互相覆盖对方的修改。**所有世界书写入串行化**：

```ts
createEntryA()
  .then(() => createEntryB())          // 串行：前一个完成再写下一个
  .catch(e => console.warn('…失败:', e));
```

写复杂状态时优先「一次渲染完整 content 后单次 upsert」，而不是分多次小写入。另一个防竞态细节：更新数据时**从 ref 里取已同步的最新数组**，勿再手动拼接（否则条目内数据双份）。

## 6. 内容分区设计（渲染给 AI 的 content 结构，供参考）

同一份游戏数据渲染给 AI 时按语义分区：

- 已确立事实 → 待确认信息（软信息标注）→ 推断（未经证实）→ 综合结论（已证/待验分开）；
- **AI 专属区**：隐藏判定与处理指令（如"判定为假：渐进安排反证，待玩家自行推翻"）——制造戏剧反讽，玩家界面不渲染这部分；
- 叙事节奏指令（如"一幕至多一处新信息"）；
- 内容版本号：模板/映射表变更时 +1，配合状态键让旧聊天条目自动重写归一。

## 7. 定时任务型写入（GENERATION_ENDED 内）

- 状态快照条目：状态变化才重写（幂等由上层 ref 对比把关）。
- 归档类：提取特定标签块 → append 到对应条目（有目标条目才写，无则 console.warn 跳过）。
- 这些都放 `setTimeout(300~500ms)` 延迟——等楼层与 MVU 稳定后再写，且 try/catch 隔离，失败不影响主流程。
