# 剧本协议设计指南（AI↔前端合同）

协议是 AI 世界书「格式」条目与前端解析器之间的合同，**必须先于 UI 设计定稿**。本文给出一套实战验证过的参考协议，以及修改/扩展它的规范。解析器是纯函数（楼层文本 → ScriptLine[]，零酒馆依赖，可单测）。

**先定协议再写 UI。** 前端必须宽容解析：两端都假设对方会出错。

## 1. 参考协议：ScriptLine 类型

```ts
export type LineType = 'narrator' | 'dialog' | 'thought';

export interface ScriptLine {
  type: LineType;
  speaker?: string;      // 说话人名；'<user>' 表示玩家
  emotion?: string;      // 情绪名（中文），经 EMOTION_MAP 查立绘
  text: string;
  color?: string;        // 主题色类名
  avatar?: string;       // 头像 URL
  sprite?: string;       // 立绘 URL
  location?: { path: string; displayName: string };  // 场景，后续行继承
  // 你的控制行产生的状态放这里（参考实现还有 nsfwPose/nsfwCharacter）
  custom?: Record<string, unknown>;
}
```

## 2. 可播内容只来自 `<content>` 标签

解析第一步：从楼层正文提取 `<content>…</content>` 块（可多个）。

**宽容降级**：没包标签时可设计为「剥思维链后全文视为剧本」，但要意识到思维链/变量更新块会混进来。参考实现选择强制 `<content>`（世界书格式条目教 AI 输出），另在重生成链路用 `<maintext>` 标签提取主体。

## 3. 行格式与正则

| 格式 | 类型 | 正则 |
|---|---|---|
| `角色名[情绪]:"对话"` | dialog | `/^(.+?)\[(.+?)\]:"(.+)"$/s` |
| `<user>:"对话"` | dialog | `/^<user>:"(.+)"$/s` |
| `角色名[情绪]:*独白*` | thought | `/^(.+?)\[(.+?)\]:\*(.+)\*$/s` |
| `<user>:*独白*` | thought | 同上简化 |
| 纯文本 | narrator | 兜底 |

所有正则 `s` 标志（`.` 匹配换行）、大小写不敏感按需。

### 情绪映射

AI 输出情绪名，立绘数据用拼音 key，中间查表：

```ts
const EMOTION_MAP: Record<string, string> = { '开心':'kai-xin', '默认':'mo-ren', '生气':'sheng-qi' /* … */ };
```

取立绘：`sprites[EMOTION_MAP[emotion]]` → fallback `sprites['mo-ren']`（默认情绪）→ fallback 运行期登记的动态立绘（随机池引擎，见 random-pools.md）。

### 说话人匹配

`findCharacterByName`：遍历角色表匹配 `name` 或 `alias`（别名数组）。`isUser`：`'<user>'`、`'我'`、玩家名都算玩家。

## 4. 隐形控制行（不渲染，只更新状态）

| 标签 | 正则 | 行为 |
|---|---|---|
| `[scene:区域/…/场景名]` | `/^\[scene:([^\]]+?)\]$/` | 更新 `currentLocation`（displayName 取路径最后一段） |
| `[nsfw:角色名:姿态名]` / `[nsfw:姿态名]` | `/^\[nsfw:(?:(.+?):)?(.+?)\]$/` | 更新 NSFW 姿态状态（可选功能） |
| 自定义池标签，如 `[人物:名,键=值,…]`（独占一行） | 池引擎正则 | 吞掉不渲染（绑定在播放屏层完成，见 random-pools.md） |

解析算法本质：**带若干状态变量（currentLocation / currentNsfwPose…）的单遍逐行状态机**。每行都带当时的状态快照，实现「后续句子继承」——控制行是「从此生效直到下一个控制行」，不是「仅当前行」。

### 标签与对话同行

AI 常写 `[人物:茶客甲,职业=…][害怕]:"…"`。处理：检测行首标签前缀后**把标签替换为其中的角色名**，使后续对话正则能匹配：

```ts
const TAG_PREFIX_RE = /^\[(人物|地点):([^\]]+?)\]\s*/;
```

## 5. 选项解析（三路并取）

`parseOptions(rawText)`：
1. `<options>` 块内以 `>` 为前缀的行；
2. `<choice>…</choice>` 块；
3. 多个独立 `<choice>text</choice>`。

去重合并。AI 记不住一种格式，三路并取显著提高命中率。

## 6. 其他标签（按需采用）

- `<scene_image>路径/天气/时间</scene_image>`：驱动背景 CG。解析从末尾弹时间（昼/夜）再弹天气（sunny/cloudy/snowy），剩余全作路径。
- `<parallel_event>`：块内 `地点|事件` 行 → 平行事件列表（地图/HUD 展示，可选）。
- `<storytale title="…">…</storytale>`：AI 在 `<content>` 之外输出的剧情外传块，正则提取后可写世界书归档（可选）。

## 7. 思维链剥离（stripThinking，所有入口统一用一份）

```ts
const THINKING_PAIRS = [
  ['<think>', '</think>'], ['<thinking>', '</thinking>'],
  ['<Chain_of_Thought>', '</Chain_of_Thought>'], ['<draft>', '</draft>'],
  ['<simple_thinking>', '</simple_thinking>'],
];
// 成对标签整体移除（转义后拼接，gi 标志）
// + 混合标签（如 ⋘…</think>）与前缀截断型按需追加
```

多处实现不一致会导致「正文残留/历史残留」显示错乱——**必须合并为单一工具函数**，所有入口（播放解析、历史视图、重生成提取）统一用一份。

## 8. 变量更新块不归前端管

AI 按世界书 `[mvu_update]` 条目输出变量更新指令（MVU 框架的 UpdateVariable 语法），**前端不解析、不剥离**——显示层正则会把它藏掉，MVU 框架负责落盘，前端只读结果。`<content>` 限定可播范围后，残留的更新块自然被隔离。

## 9. 修改协议的规范（加一个控制行的步骤）

1. 定义**行首、独占一行**的正则（避免在自由文本里做危险的全局替换）；
2. 在解析状态机加一个状态变量（继承语义：从此生效到下一个控制行）；
3. `ScriptLine.custom`（或新字段）承载该状态；
4. 世界书「格式」条目**同步写一遍约定**（AI 侧唯一的学法来源）；
5. 前端宽容：键支持中英文别名、大小写不敏感；AI 没输出时全部降级。

## 10. 给协议设计者的建议（为什么这样定）

- **标签简短**：AI 每楼都要输出，标签越长 token 越贵、越容易写错。
- **控制行独占一行 + 行首匹配**：避免在自由文本里做危险的全局替换。
- **中文键名**：中文世界观卡里 AI 用中文键（`性别=女`）远比英文键稳定；解析端做中英文别名兼容。
- **每条 AI 侧格式约定都要在世界书「格式」条目里写一遍 + 前端宽容解析兜底**：两端都假设对方会出错。
- **逐楼快照语义**：控制行继承，不是仅当前行生效。
