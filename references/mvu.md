# MVU 变量系统接入全案

MVU = MagVarUpdate（`https://github.com/MagicalAstrogy/MagVarUpdate`），每楼层维护 `stat_data` 快照的变量框架。本文覆盖：挂载、schema、世界书侧契约、前端适配层、降级链。

设计总纲：**MVU 缺席时全部静默降级，前端绝不崩。**

## 1. 挂载（酒馆助手脚本库，两份脚本）

### 脚本一：Mvu 框架本体

`content` 只有一行 ESM 引导（代码本体走 CDN，发新版即全员自动更新）：

```ts
import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';
```

metadata.json 里 `id` 用**固定 UUID**（重复导入覆盖同位脚本），`button.buttons` 定义隐藏按钮（重新处理变量/重读初始变量/快照楼层/重演楼层等，`visible:false` 保留功能入口不占 UI），`export_with: {data:true, button:true}`。

### 脚本二：变量结构（Zod schema）

```ts
import { z } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/npm/zod@3/index.js';
import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

export const Schema = z.object({
  时间: z.object({ 年: z.coerce.number(), 月: z.coerce.number(), 日: z.coerce.number(), 时辰: z.coerce.number() }).prefault(…),
  位置: z.object({ 当前地点: z.string().prefault('初始地点') }),
  状态: z.record(z.string(), z.coerce.number().min(0).max(100))
        .describe('对象名→好感度；对象登场时 insert，退场时 remove'),
});
$(() => { registerMvuSchema(Schema); });
```

要点：
- `z.coerce.number()` 容忍 AI 输出字符串数字；
- `describe()` 文本会被 MVU 生成给 AI 的变量说明（AI 因此知道取值语义与分段）；
- `prefault()` 是初始默认值；
- `$(() => …)` 是酒馆助手环境的 jQuery ready，保证 MVU 已加载后再注册。

## 2. 世界书侧契约（脚本职责的最小部分）

- `[initvar]变量初始化勿开`：**禁用的蓝灯条目**，作为初始变量模板（MVU 读取它初始化 stat_data），不注入提示词。
- `[mvu_update]变量更新规则` / `[mvu_update]变量输出格式`：启用的蓝灯条目，教 AI 输出变量更新指令（UpdateVariable 语法：replace/delta/insert/remove/move 的 JSONPatch）。
- `变量列表`：启用的蓝灯条目，列出现有变量及取值范围。
- 前端**不写**这三个条目——它们随角色卡世界书发布；前端只写动态状态条目（见 worldbook-write.md）。

## 3. 前端适配层（utils/mvu.ts，逐函数）

文件头写明设计原则：**stat_data 的读写、就绪探测、种子写入、事件订阅在此层；业务判定与条目渲染不在此层。MVU 未就绪时读回退占位值，全部静默不抛错。**

```ts
// 就绪探测：waitGlobalInitialized('Mvu') 带超时竞速，超时回退 window.Mvu 探测
export async function ensureMvuReady(timeoutMs = 8000): Promise<boolean>
// 读 stat_data：优先指定楼层（默认最新），回退聊天变量 getVariables({type:'chat'}).stat_data
export function readStatData(messageId?: number): Record<string, any> | null
// 业务读取：逐字段夹逼 + 缺失回退默认值（不信任 AI 输出的任何数值）
export function readGameTime(messageId?) / readLocation(messageId?) / …
// 收账夹逼：在 VARIABLE_UPDATE_ENDED 回调内直接改写传入 variables（官方范式），返回是否有修改
export function clampStatNumbers(variables: any): boolean
// 种子写入：字段缺失时写入初始值（对旧聊天同样生效）
//   优先写最新楼层 Mvu.replaceMvuData，失败回退聊天变量 updateVariablesWith
export async function seedStatDataIfMissing(): Promise<boolean>
// 前端直接改状态（不经 AI 报告的行动代价），真日历进位用 Date 引擎
export async function addGameHours(hours: number): Promise<GameTime | null>
// 订阅变量更新结束（透传 更新后/更新前 两份变量表），返回解绑函数
export function onVariableUpdateEnded(cb: (variables, variablesBefore) => void): () => void
```

### 收账回调标准写法（GameContext.initMvuPipeline）

```ts
onVariableUpdateEnded((variables, _before) => {
  clampStatNumbers(variables);              // ① 夹逼数值
  // ② 业务收账：如无活跃对象时清空对应状态
  // ③ 同步派生 UI（时间→状态条目翻页等）
  syncTimeFrom(readGameTime());
  // ④ 阈值提醒（对比上次值判断"增加"而非绝对值）
  if (value > lastValueRef.current) addNotification('…', 'warning');
  lastValueRef.current = value;
});
```

**铁律：此事件内勿用 `getMvuData` 重读，时序上可能拿到旧值；直接改写传入的 variables，框架随后落盘。**

## 4. 降级链（每条读写都是三层）

```
楼层 MVU 数据（Mvu.getMvuData({type:'message', message_id})）
  → 聊天变量（getVariables({type:'chat'}).stat_data）   [仅读"最新"时回退]
  → 本地占位值（DEFAULT_XXX 等常量）                     [浏览器裸跑预览]
```

写同理：`Mvu.replaceMvuData` → `updateVariablesWith({type:'chat'})` → 静默失败 + console.warn。

所有全局访问包 try/catch：`getVariables`、`getLastMessageId`、`Mvu` 在浏览器裸跑时根本不存在，**不能让 ReferenceError 冒出适配层**。

## 5. 调试

- 每步 console.info/warn 带 `[<项目名>]` 前缀（如 `[<项目名>] stat_data 种子已写入最新楼层`）。
- MVU 框架自带界面按钮（快照/重演/重读初始变量），保持 `visible:false` 挂载，排障时可在酒馆助手脚本库临时开启。
- 变量视图：前端可做一个 VariablesModal 直接渲染 `readStatData()` 供玩家/作者核对。
