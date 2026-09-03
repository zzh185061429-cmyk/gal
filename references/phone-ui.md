# 小手机（游戏内设备 UI，可选子系统）

游戏内嵌一部手机：悬浮球入口 → 手机壳 → App 网格 → 各 App。它同时是**信息聚合面板**（天气/日历/地图/图鉴的统一入口）和**社交模拟器**（角色私聊/群聊/朋友圈/论坛，由副API 生成，不占主线楼层）。蓝本是租借男友项目（11 个 App、69KB PhoneContext、86KB phoneApi）验证过的实现。

## 1. 三层结构

```
PhoneFloatButton  悬浮球：可拖拽、松手吸附最近屏幕边缘、未读红点+震动、点击展开
                  位置存 localStorage；拖动阈值 5px 区分"拖动"与"点击"
PhoneApp          壳：黑色状态栏（品牌+游戏时钟+电量）→ 桌面（App 图标网格）→ Home 条
                  App 全部 lazy() + Suspense 懒加载；AnimatePresence 切换；遮罩点击关闭
Phone*App         各 App 自带 AppHeader（壳不统一渲染顶部导航）
```

- 壳只管：打开状态、当前 App、桌面网格、徽标汇总（`unreadCount + groupUnreadCount`）。
- App 图标带徽标（未读数/badge），数据来自 PhoneContext。

## 2. PhoneContext 统一状态

```ts
{
  config: PhoneConfig,              // 角色关联 + 副API配置 + 引导标记
  messages: Record<角色名, PhoneMessage[]>,   unreadCount,
  moments: PhoneMoment[],           // 朋友圈
  groupChats: GroupChat[], groupMessages, groupUnreadCount,
  followedPosts: ForumPost[],       // 论坛关注帖
  isPhoneOpen, openPhone, closePhone,
  dispatchBadge,                    // 业务徽标
  sendMessage / markRead / clearChatHistory / refreshForum / …
}
```

与 GameContext 并列的独立 Provider——手机是自洽子系统，只读游戏时钟/位置/天气做展示与生成上下文。

## 3. 数据持久化三层（最关键的设计）

| 数据 | 存哪 | 为什么 |
|---|---|---|
| 配置（角色关联、副API、开关） | **角色卡变量** `getVariables({type:'character'})` | 跨聊天共享：换聊天不用重配 |
| 内容（消息、朋友圈、群聊、关注帖） | **聊天变量** | 世界随聊天走：不同聊天文件是不同世界线 |
| UI 偏好（悬浮球位置、主题） | **localStorage** | 设备级，不进存档 |

读取全部逐字段 `typeof` 校验回退默认，包 try/catch——浏览器裸跑降级。

## 4. 副API 社交模拟管线

手机的核心玩法：**主线之外的角色生活**由副API 独立生成，不污染主聊天历史。

```ts
type SubApiConfig = { apiurl, key, model, source };   // 存角色卡变量
generatePhoneMessage(...)   // 角色主动发私聊（人设条目+最近剧情+游戏时间 → 消息）
generateMoment(...)         // 角色发朋友圈（随机地点 + 配图可选）
generateMomentReply(...)    // 朋友圈评论回复
generateForumPosts(...)     // 论坛帖子（板块定义: 八卦/吐槽/求助…）
generateForumReply(...)     // 帖子回复
generateGroupMessage(...)   // 群聊
detectOrderIntent(...)      // 从玩家输入检测业务意图（如下单）
```

- 每个生成函数都是同一模式：`generateRaw({ should_silence:true, max_chat_history:0, custom_api, ordered_prompts })`，prompt 由 [预设注入, 角色人设条目, 最近主线剧情摘要, 输出格式] 组装；
- **`autoMessageEnabled` 总开关**：关闭后不再自动触发角色私聊/朋友圈（防打扰）；
- 副API 未配置时手机**仍然可用**（手动收发消息、看天气日历），只是不自动生成——降级不瘫痪。

## 5. 聊天历史压缩（防膨胀）

消息只存聊天变量会无限膨胀，压缩管线：

- 超过阈值后把旧消息交副API 总结成一段摘要（200-400 字，保留关键事件/约定/情感变化）；
- 摘要消息 `isSummary: true` —— UI 显示为灰色卡片而非气泡；`originalMessages` 保留原始消息（可展开查看），**嵌套压缩时继承子摘要的原始消息**；
- 总结结果同时写回该角色的世界书聊天记录条目（见 §6），主线 AI 永远能看到压缩后的关系史。

## 6. 世界书联动（让主线 AI 看到手机里发生的事）

- 每个关联角色一对条目：**人设条目**（只读，供生成 prompt 用）+ **聊天记录条目**（`createCharChatLogEntry / updateCharChatLogEntry / ensureAllCharChatLogEntries` 幂等维护）；
- 条目内容含游戏内时间戳 `gameTs`（如 `10/8 19:30`）——AI 才能区分"昨天发的消息"和"刚才发的消息"；
- 群聊同理（摘要 + 条目同步）；朋友圈评论同样回写。
- 条目操作全部串行 + try/catch（见 worldbook-write.md 的并发互覆）。

## 7. 与主线的接口

- `[move:区域/地点]` 标签：AI 在私聊/正文里输出移动意图，`parseMoveTag` 解析后剥除标签并写入 `scriptCharacterLocations`（角色位置覆盖，见 character-locations.md）；
- 手机的位置页/地图复用 `getCharacterLocation` 全家桶；天气页复用天气引擎 `getDailyPeriods`；
- 主线提示词注入（位置表/天气/模式）见各自文档——手机**不重复注入**，只消费。

## 8. App 组装建议

**通用件**（几乎任何卡都能直接用）：聊天（微信式）、朋友圈、天气、日历、音乐、设置、引导页。
**业务定制**：论坛（世界观有公共舆论场才要）、派单/订单（服务/交易类玩法）、成就、画廊/图鉴、地图。
**共用件**（PhoneShared）：空状态、AppHeader、气泡、徽标——先抽共用件再加 App，否则 11 个 App 各写一遍头部。

最小可玩组装 = 悬浮球 + 壳 + 聊天 + 天气 + 设置（副API配置页）。其余 App 按需求追加，壳的 AppView 联合类型加一项 + 懒加载一行。

## 9. 注意点

- 手机是 fixed 全屏浮层（z-50 级），注意与伪全屏/锁定前端的层级协调（层级令牌表见 frontend-playbook.md §11）；
- 未读数分私聊/群聊两组汇总，红点只挂悬浮球与 App 图标，别在 HUD 到处挂；
- 游戏时钟是手机状态栏与所有 gameTs 的唯一来源（GameContext 的 gameTime）；
- 懒加载 App 的 Suspense fallback 要配壳内配色，白块穿帮很明显。
