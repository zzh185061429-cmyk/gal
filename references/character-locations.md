# 角色地点池（多角色「谁在哪」模拟，可选子系统）

多角色卡的核心问题是「此刻谁在哪」：主角在找人、AI 在写互动，都需要 NPC 位置自洽。本系统 = **固定日程兜底 + 空闲地点池加权随机**，蓝本是租借男友验证过的实现。注意与 random-pools.md 的分工：那套解决「配图」，这套解决「位置」，可组合使用（抽到地点后再查地点图）。

## 1. 三层位置模型与查询优先级

```
1. 正文覆盖（overrides）      —— AI 正文/移动标签解析出的位置，剧情正在发生的锁人
2. 日历覆盖（dateOverrides） —— 节日/考试/假期：固定地点或加权调整
3. 天气覆盖（weatherOverrides）—— 恶劣天气下特定角色的固定行为
4. 核心日程（entries）        —— 精确时间段的固定活动（上课/打工/值班）
5. 空闲地点池（freeSpots）    —— 日程盖不住的时间，从池中按权重随机   ← 本文档核心
6. defaultLocation            —— 全部落空的兜底
```

```ts
export type CharacterLocation = {
  character: string;
  location: string;
  parentLocation?: string;  // 区分不同住所下的同名子位置（如各家"主卧"）
  activity?: string;        // 核心日程有值（事实性，如课名）；空闲池无值
  isFree: boolean;
};
export function getCharacterLocation(character, date, overrides?, hostAvailability?, skipVisitSpots?): CharacterLocation | null;
export function getAllCharacterLocations(date, overrides?): CharacterLocation[];
export function getCharactersAtSpot(spotName, date, overrides?, parentLocation?): CharacterLocation[];
```

## 2. 空闲地点池数据模型（FreeSpot）

```ts
export type FreeSpot = {
  location: string;
  parentLocation?: string;
  weight: number;            // 相对权重——本系统的灵魂
  hourRanges: HourRange[];   // [startHour, endHour][] 该地点可用的时段（如 [14,19]）
  requiresHostAt?: string;   // 串门条目：主人在家才生效，值=主人住所名
};
```

设计要点：
- **weight 是唯一随机自由度**。写卡时按角色人设调权重（宅家型 `住所:10, 商圈:1`；social 型反之）。
- **activities 已删除**：角色在做什么由 AI 根据人设+上下文决定，前端只定位置。
- `hourRanges` 让同一池子分时段生效（深夜只可能在家/便利店）。

## 3. selectFreeSpot：加权随机五步修正链

```
① 时段过滤：hourRanges 含当前时刻的才可用
② 追加日历覆盖的 extraSpots（同样按时段过滤）
③ 串门校验：requiresHostAt 条目，主人家不在 hostAvailability 表=true 则剔除
④ 权重修正：假期学校地点 ×0.2 → 恶劣天气室外地点 ×outdoorMultiplier → 日历覆盖 weightMultipliers（按地点名/父地点名）
⑤ 种子加权随机：seed = hash(角色名+日期+小时)
```

```ts
// ⑤ 核心：确定性加权随机——同一小时内结果稳定，重渲染/重开不跳动
const seed = hashSeed(character, date);            // 角色+日期+小时
const total = available.reduce((s, x) => s + x.weight, 0);
let rand = seededRandom(seed) * total;
let selected = available[available.length - 1];
for (const spot of available) { rand -= spot.weight; if (rand <= 0) { selected = spot; break; } }
```

**种子必须同时含角色、日期、小时**：缺小时 → 全天一个位置（失去流动感）；缺角色 → 所有角色同刻齐跳（穿帮）。权重修正用 `map` 生成新数组，不改原数据。

## 4. 串门校验（防「主人不在家访客却在他床上」）

```ts
// 一次性预计算所有住所主人是否在家，再逐角色选位——避免角色间递归依赖
function precomputeHostAvailability(date, overrides?): Map<string, boolean> {
  // 主人有 override（正在剧情中）→ 判定"不可串门"：位置由脚本控制，
  // 访客不应通过池子自动出现在主人家；脚本应显式给访客也设 override
  // 递归防护：预计算主人位置时传 skipVisitSpots=true，主人自己的选位跳过串门条目
}
```

## 5. 活动标签：只注入 WHERE，不注入 WHAT

`formatLocationTable` 的设计决策（照抄）：

- 核心日程的 activity 是**事实性**的（课名/班次），保留注入；
- 空闲池**只注入位置**，让 AI 根据人设+上下文决定在做什么——前端写死活动会跟 AI 的剧情打架；
- UI（地图/手机地点页）需要显示"在干嘛"时，用 `getGenericActivity(location)` 按地点关键词映射**通用标签**（教室→上课中、食堂→用餐中、跑道→运动中），仅供界面，不入提示词。

## 6. 正文覆盖（overrides）

`scriptCharacterLocations: Record<角色名, 地点名>`，来源两种：

- AI 正文中的移动标签：`[move:区域/地点]`（正则 `/\[move:([^\]]+)\]/`，解析后从展示文本中剥除）；
- 前端交互写入（地图点人选、剧情交互锁人）。

覆盖值支持 `父地点/子地点` 斜杠形式。**有覆盖的角色视为"剧情中"**：地图/手机显示以覆盖为准，且其住所对访客关闭串门。

## 7. AI 注入（与天气同一时机）

```ts
eventOn(tavern_events.GENERATION_AFTER_COMMANDS, () => {
  const locations = getAllCharacterLocations(gameTime, scriptLocsRef.current);
  const table = formatLocationTable(locations, currentLocation, playerName);
  injectPrompts([{ id: 'character-locations', position: 'in_chat', depth: 0,
    role: 'system', content: table, should_scan: false }], { once: true });
});
// 输出形如：
// 【角色当前位置】
// 玩家：某地
// 角色A：某公寓/主卧
// 角色B：教学楼（金融学原理）   ← 核心日程才带 activity
```

同一注入里通常合并：模式提示（服务中/自由时间）、天气、时段详情、预报、场景扰动——一次 `injectPrompts` 打包。

## 8. 与其他子系统的耦合

- **天气**（weather-daynight.md）：室外降权吃 `outdoorMultiplier`；`weatherOverrides` 让特定角色恶劣天气固定行为（如宅家）优先于核心日程。
- **日历覆盖**：`match: {month, day} 或 {range:[始月,始日,终月,终日]}`，`festivalSpot` 固定地点 / `extraSpots` 追加 / `weightMultipliers` 调权——节日全城偏向某地点就靠它。
- **场景扰动**（可选）：与位置系统同源注入，按天气加权摇出「天不对/地不对/人不对/来人了/东西不对/计划不对」六轴抽象参数（85% 无 / 12% 单 / 3% 双），**只注入方向不注入事件**，让 AI 自己按当前地点天气推导具体突发——同一参数在不同场景产生不同剧情。
- **图**：地点池结果 → 查地点图集/地点池图引擎取背景图。

## 9. 注意点

- 角色没配日程 → `getCharacterLocation` 返回 null，`getAllCharacterLocations` 自然跳过；给主要角色都留 `defaultLocation`。
- 预计算主人在家表必须先于逐角色选位；预计算时 `skipVisitSpots=true` 防递归。
- 加权随机前先判 `totalWeight <= 0` 直接返回 null（全被降成 0 权时宁可无位置）。
- 位置表注入放 `GENERATION_AFTER_COMMANDS`（生成时），别放渲染路径——它只服务 AI。
