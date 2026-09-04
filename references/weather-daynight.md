# 天气与昼夜系统（建议默认子系统）

昼夜/时段流逝感几乎是所有卡的标配——它同时驱动三件事：**视觉**（滤镜/粒子/CG 变体）、**AI 提示词**（当前天气+时段详情+未来预报）、**其他子系统**（地点池室外降权、场景扰动）。本文是时段天气引擎的完整设计（v3：时段天气 + 突变 + 预报），蓝本是租借男友项目验证过的实现。

## 1. 时段与昼夜

```ts
export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';
const PERIOD_ORDER: TimePeriod[] = ['morning', 'afternoon', 'evening', 'night'];
// 06-12 上午 / 12-18 下午 / 18-24 傍晚 / 0-6 夜间
export function getTimePeriod(date: Date): TimePeriod;
```

- 昼夜口径统一从**游戏时钟**推导（`getDayNight(gameDateTime)`），CG 查表、滤镜、立绘明暗共用这一个函数。中式/古风卡可升级为**按节气日出日入漂移**的口径（见 §12）。
- `<scene_image>` 等正文标签携带的时间**覆盖**时钟推导（AI 明示优先）。

## 2. 天气类型与影响参数

每个天气类型绑定两个参数：给 AI 的自然语言描述 + **室外地点权重乘数**（供地点池降权用）：

```ts
const WEATHER_EFFECT = {
  '晴':   { description: '晴朗，阳光充足',         outdoorMultiplier: 1.0 },
  '阴':   { description: '阴天，光线偏暗',         outdoorMultiplier: 0.9 },
  '小雨': { description: '小雨，地面湿滑',         outdoorMultiplier: 0.35 },
  '大雨': { description: '大雨，不宜外出',         outdoorMultiplier: 0.15 },
  '雪':   { description: '下雪，天寒地冻',         outdoorMultiplier: 0.2 },
  '雾':   { description: '雾天，能见度低',         outdoorMultiplier: 0.6 },
  '雷暴': { description: '雷暴天气，危险不宜外出', outdoorMultiplier: 0.1 },
};
export function isBadWeather(w)   // 小雨/大雨/雪/雷暴
export function isRainyWeather(w) // 小雨/大雨
```

`outdoorMultiplier` 是天气影响玩法的关键钩子：天气不只好看，还要让 NPC 行为跟着变（见 character-locations.md）。

## 3. 季节概率表

按「年周期分段」（学期/季节/自定义时段）各配一张概率表，同一引擎换卡只换表：

```ts
const AUTUMN_TABLE  = { '晴':35, '多云':25, '阴':15, '小雨':12, '大雨':4, '雪':0, '雾':7,  '雷暴':2 };
const WINTER_TABLE  = { '晴':30, '多云':22, '阴':18, '小雨':5,  '大雨':2, '雪':15,'雾':8,  '雷暴':0 };
```

## 4. 预报系统（持久化到聊天变量）

维护一个 **7 日滚动预报**（`ForecastEntry[]`），存聊天变量（切聊天自动重置，符合"世界随聊天走"）：

```ts
type ForecastEntry = {
  dateStr: string;                  // 'YYYY-M-D'
  type: WeatherType;                // 主导天气（下午时段）
  description: string; outdoorMultiplier: number;
  periods?: Record<TimePeriod, WeatherType>;          // 各时段天气
  suddenChangeApplied?: Partial<Record<TimePeriod, boolean>>; // 突变已检查标记
};
let forecastCache: ForecastEntry[] | null = null;     // 内存缓存，避免每次读变量
```

`ensureForecast(currentDate)` 在**游戏日期变更时**由 GameContext 调用，自愈式维护：

- 无预报 → 马尔可夫链生成 7 天；
- 今天在预报内 → 裁剪过期天数 + 从最后一天的夜间天气续马尔可夫链补足 7 天；
- 今天不在预报内 / 旧版数据（缺 periods 字段）→ 重新生成；
- 一切变更写回聊天变量。

## 5. 马尔可夫链（天气有趋势，不乱跳）

在季节概率表基础上做两重加权后随机：

- **持续性因子**：同一天气延续的权重倍数（晴 2.5、阴 2.0、小雨 1.8、大雨 0.7、雷暴 0.3——大雨雷暴天然短暂）；
- **相似性分组**：相邻类型 ×1.5（晴↔多云↔阴↔小雨↔大雨↔雷暴 相邻过渡）。

生成预报时从「前一天的夜间天气」起链，保证跨天趋势连续。

## 6. 确定性突变（一天内天气会变，且重渲染不抖）

每小时检查一次，**种子 = 日期哈希 × 31 + 小时 × 7919**（同刻结果稳定）：

- ~10% 概率突变；其中 80% 取相似组温和变化（晴→多云），20% 从季节表剧烈抽取（晴→雷暴）；
- 突变**持久写回预报条目**（`periods[period]` + `suddenChangeApplied` 标记防重复应用）——特效、AI 注入、后续消息全部自然同步，无需手动清除。

无预报数据时的 fallback：`hashGetWeather(date)` 按日期字符串哈希在季节表里确定性抽取（同一天结果稳定），保证浏览器裸跑也有合理天气。

## 7. 查询 API 面

```ts
getWeather(date)            // 当前时刻天气：预报→时段→突变→fallback哈希（所有消费方统一走这一个）
getDailyWeather(date)       // 当天主导天气（预报展示用）
getTodayWeatherDetail(date) // "今日天气：上午晴，下午多云，傍晚阴，夜间小雨"
getDailyPeriods(date)       // 四时段结构化数据（手机天气 App 用）
getForecastSummary(date)    // "【未来天气】明天：…，后天：…"（未来4天，AI 注入用）
```

## 8. 两条写回路径

天气系统不只是随机产生，还要被两股力量修改：

1. **场景扰动写入**（`setCurrentPeriodWeather`）：扰动系统摇出「天不对」时，按天气阶梯（雷暴←大雨←雪←雾←小雨←阴←多云←晴）走步数换天气，**直接改写预报缓存**——变化持久，后续消息一致。
2. **AI 正文回写**（`syncWeatherFromText`）：生成结束后从 `<content>` **只扫旁白行**（剔除含 `]:"` 的对话行、`<user>` 行、`*内心` 行——台词里聊天气不算数），按关键词优先级表匹配（雷暴→大雨→小雨→雪→雾→阴→多云→晴，先匹配先赢，只取第一个），与当前天气不一致则同步回预报系统。

## 9. AI 注入（GENERATION_AFTER_COMMANDS + injectPrompts）

生成前的提示词注入统一挂在 `tavern_events.GENERATION_AFTER_COMMANDS`：

```ts
injectPrompts([{
  id: 'weather-context',
  position: 'in_chat', depth: 0, role: 'system',
  content: [`【当前天气】${weather.type}（${weather.description}）`,
            getTodayWeatherDetail(date), getForecastSummary(date)].filter(Boolean).join('\n'),
  should_scan: false,       // 不触发世界书绿灯扫描
}], { once: true });        // 本次生成一次性生效
```

## 10. 视觉层（WeatherOverlay）

- **不替换背景图**（为每个地点×每种天气出图成本爆炸），而是叠**半透明色块**模拟光线影响：室外浓（大雨 0.42 透明度深蓝）、室内淡同色调，晴/多云透明。
- 雨/雪/雾/闪电加 **Canvas 粒子**（雨 120/300 滴两档、速度线长随强度）。
- **禁用 backdrop-filter**——在部分浏览器/iframe 上下文会白屏，用半透明色块叠加替代。
- 室内外判定与地点池共用同一个 `isOutdoorLocation(location)`。

## 11. 注意点

- 所有消费方（滤镜/粒子/AI 注入/地点降权/手机天气 App）**统一走 `getWeather()`**，自建状态必然分叉。
- 突变和扰动必须写回预报缓存，只改渲染状态会导致下一条消息天气"变回去"。
- 预报存聊天变量（世界随聊天走）；`suddenChangeApplied` 标记必须持久化，否则同一小时反复掷突变。
- 加载聊天变量逐字段类型校验（`in WEATHER_EFFECT`），坏数据丢弃走 fallback，不抛错。

## 12. 游戏内日历与黄历（岁时历，可选）

中式/古风世界观的高分件：真实农历、节气、黄历宜忌，且宜忌可升级为**玩法系统**（「宜忌在志怪世界里是真实的，非民间迷信」——宜捕捉的日子设伏真的更顺）。与时段天气同属「游戏内时间」引擎，共用游戏时钟。

### 三套纯本地算法（不要用近似日期表 + 随机宜忌）

- **农历**：jjonline lunarInfo 查表（1900-2100，每项十六进制编码一年的闰月位+大小月），公历↔农历精确互转；
- **节气**：寿星天文公式（VSOP87 简化的太阳视黄经法）按年精确计算——节气每年漂移一天左右，**固定日期表必穿帮**；
- **宜忌**：建除十二神（十二值日）——日支与月支的相对关系确定性定神，十二神轮转全年不重复。**随机抽宜忌会导致同一天两次打开结果不一样**，同理穿帮。

### 历注三层结构（进 prompt 的部分）

1. **值神宜忌**（硬规则）：当日神煞对应的通行宜忌；
2. **值神之性**（方向定调）：一句「建日之气主生发启新……」，让 AI 把当日之气泛化到宜忌未列出的行动；
3. **业务历注**（本卡翻译）：把传统农耕宜忌翻译成本卡玩法的行动指令——「宜捕捉」→「缉拿设伏、追凶索犯最佳之日」。每条都是 AI 可执行的叙事指令。

token 预算：全表只存代码，进 prompt 的只有当日一组（≤300 token）。

### 两个设计决策

- **AI/玩家信息对称**：世界书条目与玩家侧日历弹窗共用同一个生成函数——AI 看到的攻略玩家也看得到（与 worldbook-write.md §6 的「AI 专属区」相对，按玩法需要二选一）。
- **节气驱动的日出日入**：昼夜判定不用固定 6/18 点，按当前节气查日出日入表（24 节气 × [日出, 日入]，半小时粒度，按地域口径配表：华北夏至 5:00-19:30、冬至 7:30-17:00）——冬天 17 点已入夜、夏天 19 点仍是昼，CG 选图/滤镜/AI 注入共用这一个口径。

### 落地接线

- 世界书侧：单条蓝灯「黄历_今日」幂等翻页（标准模式见 worldbook-write.md §4）；日期键 = `v版本-年-月-日-动态摘要`——**因果账等动态字段变化也要触发翻页**；
- 纪年映射：游戏纪年 ↔ 公历固定偏移（`eraYearToSolarYear` 一对函数）；游戏日序数（Date.UTC 天数差）给排期与确定性种子共用；
- 小时 → 时辰换算（`hourToShichen`）作为时间戳与历注的公共工具。
