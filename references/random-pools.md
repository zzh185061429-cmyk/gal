# 随机池图引擎（可选子系统）

同类实体（路人/NPC/地点）超过十来个、逐个配图不可维护时才启用。图片资产全部为生成期写入的图床直链，运行时**查表不拼接**。核心思想三个词：**幂等绑定、洗牌袋去重、属性硬约束**。

## 0. 两个方向（决定你的池怎么设计）

- **地点池 = 先抽后演**：前端先抽一套图，把图套的"气质描述"（desc）回注给 LLM，LLM 照着演。
- **人物池 = 先演后配**：LLM 正文已写出 NPC 的性别/年龄/形态，打 `[人物:…]` 标签，前端按标签属性抽图，保证文图一致。

## 1. 通用属性池核心（attrPoolCore.ts，可直接照抄）

```ts
export interface AttrAssetLike { id: string; cls: string; gender: string; age: string; variant: string; url: string; }
// id 即池内原始路径，如 'B1_妖类L1/男/老/富/01'——路径即属性

export interface AttrBinding {
  instanceName: string;          // LLM 起的实例名（"水鬼""王掌柜"），即主键
  assetId: string; url: string;
  cls: string; gender: string; age: string; variant: string;  // 绑定时命中的属性快照（排查文图一致性用）
  boundAt: string;
}
export interface AttrRegistry {
  bindings: Record<string, AttrBinding>;     // 实例名 → 绑定
  usedByBucket: Record<string, string[]>;    // 桶键 → 已用图 id 列表
}
```

### 幂等绑定算法 drawAttrBindingOp

签名：`(pool, registry, instanceName, boundAt, pickCandidates, bucketOf) → { registry, binding?, created }`

1. `instanceName` 为空 → 直接返回；
2. `registry.bindings[instanceName]` 已存在 → **原样返回，不重抽**（幂等的关键）；
3. `pickCandidates(pool)` 空或 undefined → 不配图返回 undefined（硬约束封在闭包里，核心不知道具体属性）；
4. **桶内洗牌袋**：`unused = candidates.filter(a => !(usedByBucket[bucketOf(a)] ?? []).includes(a.id))`，均匀随机抽一个；
5. **整袋用尽重洗**：候选全用过 → 删掉候选集涉及的所有桶键，在整个候选集上重抽；
6. 抽中后把 id 追加进 `usedByBucket[bucket]`，**不可变更新**返回新 registry。

上层负责：created 时整体写回聊天变量 + 可选提示。存储键带 `<项目名>` 前缀。

## 2. 属性型人物池（文图一致，属性精确匹配）

- 标签协议：`[人物:名称,类别=B1,性别=女,年龄=青,形态=富]`；扫描正则 `/\[人物:([^\]\n]+?)\]/g`（matchAll + 同名去重）；逗号分隔（中英文均可），键支持别名（类别/class、性别/gender、年龄/age、形态/身份/variant）；未给的键交给前端随机。
- 桶键：`${cls}|${gender}|${age}|${variant}`。
- **候选链（属性放宽规则）——最值得抄**：

```ts
const layers: (keyof Attrs)[][] = [
  ['cls', 'gender', 'age', 'variant'],   // 精确：四属性全匹配
  ['cls', 'gender', 'age'],              // 弃形态
  ['gender', 'age'],                     // 弃类别（保性别+年龄）
  ['gender'],                            // 只保性别
];
// 逐层 filter，第一层非空即返回
// 全空 → 兜底：无性别泛用图，仍无则 undefined（不配图）
```

**身份类硬约束（性别等文图强相关属性）任何放宽层级都不跨——宁可不配图也不配错图。** `matches` 只匹配给定键（`want === undefined` 视为通配）。

## 3. 模糊匹配人物池（职业/身份型 NPC）

同构，差异全在候选闭包：

- **模糊匹配**：`fuzzyVariant = 相等 || 互相 includes`（标签"药铺掌柜"能命中池中"药铺掌柜坐堂大夫"）；
- 声明了职业：两层候选（模糊职业+性别+年龄 → 模糊职业+性别），都没有 → undefined——**职业声明了就绝不跨职业**；
- 未声明职业：落专用无名路人矩阵（性别×年龄×阶层）；
- 正常人必须有性别，不设无性别兜底；
- 路人出场频繁，**静默绑定不提示**。

## 4. 地点池（tier 型，按档位去重而非属性桶）

- `PoolBinding { instanceName, assetId: '${tier}/${name}', tier, boundAt }`；`PoolRegistry { bindings, usedByTier: Record<string,string[]> }`。
- **tier 判定 `detectPoolTier(instanceName, sceneName?)`**：从实例名后缀正则判档位，有序规则先命中先赢（如 `/王府$/→wangfu`、`/铺/→pu`、`/(村|庄|寨)/→cunzhai`…）；另有场景名证据（专有殿名直接判高档）。
- `parsePoolPath`：处理 `[scene:实例名/场景名]`——按 `/` 切段，末段为场景名，其余段逐个试 detectPoolTier。
- 洗牌袋按 `usedByTier`；限时池（`inBag:false`）自由复用不标记；`inBag:true` 全用尽 → 整袋解禁重洗（返回 `reset:true` 供上层提示）。
- 场景取图 `resolvePoolSceneImage`：精确场景名 → 别名组（一组同义场景名共用）→ 兜底第一个场景；indoor 取 `variants['昼'|'夜']`；outdoor 先试 6 键精确组合（晴昼/晴夜/阴昼/阴夜/雪昼/雪夜），缺失退到 昼/夜。
- 新绑定提示可分级：重要池醒目提示，路人静默。

## 5. 数据文件组织（生成期脚本产出，勿手改）

```
<项目>Pool.ts:        PoolAsset { name, tier, scenes: Record<场景名, { type:'indoor'|'outdoor', desc:气质描述, variants: Record<变体键, URL> }> }
                      POOL_TIERS: Record<tier, { label 展示名, inBag }>
人物池.ts:            AttrAssetLike[]（id 路径即属性，cls 分大类）
characterImages.ts:   CHARACTER_IMAGES: Record<名, { sprites: Record<拼音情绪key,URL>, sfw/nsfw: SpriteCategory[], avatarUrl }> + NPC_IMAGES（单张立绘不入图鉴）
```

池文件由生成脚本从本地 manifest 产出（解析图床链接清单 → TS 常量，见 asset-pipeline.md）。生成器记录在文件头注释。

## 6. 接线方式（GameScreen）

解析楼层文本时：`scanTags(msg.message)` → 对每个标签调 `ensureBinding`（幂等）→ 得 `dynamicSprites: Record<说话人名, 立绘URL>` 注入 scriptParser 的立绘 fallback。**跨楼层兜底**：本层没打标签但历史层绑定过的 NPC，从 registry 恢复立绘。固定主角直接硬绑。

## 7. 确定性随机原则

- 需要"同楼层稳定"的随机（天气滚动、分时段事件）→ LCG 种子（`s=(s*9301+49297)%233280`，seed=楼层号或 `gameDayOrdinal*31+slot*7`）。
- 图池抽取可裸 `Math.random()`——因为结果已被 registry 幂等固化，抽一次永久生效。
