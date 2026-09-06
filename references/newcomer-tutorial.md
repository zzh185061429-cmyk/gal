# 新手教程系统：选择门 + 演出式带练（双蓝本真机验证 2026-09-07）

三件套，让新玩家第一次进入就被教会、老玩家永不被打扰。命名一律带 `<项目名>` 前缀（聊天变量键、window 标志同全局前缀规范，见 `13-命名空间与迭代发布.md`）：

1. **选择门（Experience Gate）**：进游戏后一次性询问「我是第一次游玩 / 我是老手」，认领结果落聊天变量。
2. **演出式教程引擎**：教程台词构造成 `ScriptLine[]` **注入原生播放管线**——打字机、立绘情绪、场景 CG、打字音效全部白拿，画面 100% 就是真实游戏画面。**绝不另造教程 UI**（那是歧路：两套演出永远长得不一样，且每个演出能力都要重做一遍）。
3. **面板实操带练**：讲到复杂系统（背包/案卷/手机等面板类玩法）时切 **Q版小人 + 角落气泡**，真实调用业务 API 全程操作演示，讲到哪就把那个具体界面亮到哪。

## 1. 选择门

```ts
const GATE_KEY = '<项目名>Experience';            // 聊天变量：{ choice:'veteran'|'newcomer', tutorialDone?:true }
function useExperienceGate() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let claimed = false;
    try {
      const st = getVariables({ type: 'chat' })?.[GATE_KEY];
      claimed = st?.choice === 'veteran' || st?.tutorialDone === true;
    } catch { /* 本地预览等无酒馆环境：视为未认领，仅本会话生效 */ }
    if (!claimed) {
      const t = setTimeout(() => setActive(true), 900);   // 等 0.4s 入场动画安定再掀幕
      return () => clearTimeout(t);
    }
  }, []);
  const choose = (choice: 'veteran' | 'newcomer') => {
    setActive(false);
    if (choice === 'veteran') persist({ choice });        // 老手：立即落存档永不再问
    // 新手：这里不落存档——教程完成/跳过时才写 { choice:'newcomer', tutorialDone:true }
  };
  return { active, choose };
}
```

要点：
- **落存档时机**是行为的灵魂：老手立即认领；新手只有走完（或跳过）教程才写 `tutorialDone`，中途刷新下次**重头再问再教**（教程从头播，成本可接受；漏了这条，新手中断一次就永远学不到）。
- `getVariables` 全程 try/catch——本地浏览器裸跑静默视为未认领，只影响本会话。
- 覆盖层 UI：全屏半透明 backdrop-blur + 项目同款卡片风格 + z-60；背景幕**不可点击关闭**（必须择一而答）；两个按钮给出明确的主次层级。

## 2. 演出式教程引擎

### 2.1 注入（核心只做三件事）

```tsx
const tutorial = useNewcomerTutorial({ seekTo: i => setCurrentIndex(i), /* openPanel/closePanel 回调 */ });

// ① 解析 effect 顶部早退（tutorial.active 进 deps）——教程退出后自然恢复楼层解析
useEffect(() => {
  if (tutorial.active) return;
  /* 原解析逻辑 */
}, [/* 原依赖 */, tutorial.active]);

// ② 注入：active 翻真时用教程台词替换 script
useEffect(() => {
  if (!tutorial.active) return;
  setScript(TUTORIAL_SCRIPT); setCurrentIndex(0);
  setOptions([]); /* 清空选项/平行事件等 */
}, [tutorial.active]);

// ③ 阅读进度持久化同样跳过教程期间（别把教程行号写进楼层进度表）
```

台词行的构造（`<项目名>` 的角色字典里取立绘）：
- 每行都带 `location`——播放屏的 sceneLocation 通常**只读当前行，没有解析器的继承语义**；场景路径含 `<user>` 令牌就写字面量（图库键是字面量匹配）。
- 立绘：情绪中文名 → 拼音 key 映射（`'开心':'kai-xin'`…），查角色字典 `sprites[key]`，缺省回落默认情绪图。

### 2.2 翻页拦截与绕行道封堵

```tsx
// handleNext 顶部：章节切换 / 结业都在这里截
if (tutorial.active && tutorial.phase === 'performance') {
  if (currentIndex === tutorial.notebookTriggerIndex - 1) { tutorial.beginPanelDrill(); return; }
  if (currentIndex >= tutorial.script.length - 1) { tutorial.finish(false); return; }
}
```

- **触发行号按台词内容自寻址**（`BEATS.findIndex(b => b.line.text.startsWith('如果嘛'))`），写死序号会因加台词漂移。
- **必须封掉的绕行道**：Auto 连播、Skip、Ctrl 长按——它们绕过 handleNext 直接改 index，会踩穿章节触发器（按钮锁进 pointer-events-none 的按钮组 + 键盘 Ctrl 分支加 `!tutorial.active` + Skip effect 守卫同样加）。
- 键盘 Enter / 滚轮 / 触摸滑动翻页**保留**——教程本身也要玩家点击推进，这才是演出。
- 教程期间锁定：HUD（locked prop → 容器 pointer-events-none）、底部按钮组、输入栏、面板触发钮。玩家唯一能点的是「继续」与「跳过教程」。

### 2.3 讲按钮 = 真实按钮高亮

讲解 HUD/工具栏按钮的行，用**真实按钮 DOM id**（`btn-<项目名>-xxx`，第一天就给按钮定 id）驱动高亮：按钮组件接受 `highlighted`，**直接换配色样式**（金底发光 + 呼吸动画），不要叠类名（Tailwind 同名属性冲突不可控）。锁定与高亮都经 props 下发，播放屏不掺教程逻辑。

## 3. 面板实操带练（复杂系统）

正文文本框会挡住面板——此章节**脱离文本框**，切 Q版小人 + 角落气泡（z-60：透明全屏幕阻断底下交互，小人+气泡贴角落**不遮面板内容**，显示步骤 i/N）。

**演示 = 真实调用业务 API，玩家亲眼看每一步**；步骤执行器是「先执行动作、后换台词」的数组：

```
加第一条数据（看系统自动生成关联实体，如案卷/存档/条目）
→ 当场改名（看名称实时变化）
→ 加第二条 → 打开详情视图（看实体卡片与连结关系）
→ 合成高阶实体（文案预写）→ 亲手编辑润色（看文字实时变）
→ 弹关键表单看一眼（只看不提交）→ 清场焚毁 → seekTo 回正文演出
```

铁律：
- **内容全部预写，绝不调 AI/副API**——演示不能被 API 可用性绑架。
- **讲到哪亮到哪**：给面板组件加教程驱动 props（如 `tutorialFocusId` 自动展开详情、`tutorialShowForm` 自动弹表单），effect 内用 ref 比对变化才触发（防 deps 重跑反复执行）。
- 演示者形象用项目自带的小人/头像图，气泡样式与全局设计系统同宗。

## 4. 演示数据卫生（三条，缺一条就留渣）

1. **pollFind**：context 操作后 React 状态异步刷新，单次 `setTimeout(60)` 后立刻 find 常扑空 → 轮询 `pollFind(fn, 15)`（80ms×15）直到找到。
2. **内容匹配清扫**：清理按**演示文案文本反查实体 id** 再删，只认内存 ref 会漏掉「中断刷新后 refs 归零」的孤儿数据；开局（begin）预清扫一次 + finish/跳过/组件卸载兜底清扫。
3. **只删自己的**：清扫匹配只认演示专用文案/名称常量，绝不误删玩家真实数据。

## 5. 真坑清单（按踩到的顺序）

| 症状 | 根因 | 正解 |
|---|---|---|
| 进游戏即崩、被错误边界兜住（幻璃镜显示「灵境偶滞」），症状看起来与教程无关 | 教程钩子声明在解析 effect **之后**，effect 的 deps 数组在渲染期就读了 tutorial → TDZ | 钩子调用上移到所有引用点之前，并注释标记 |
| 带练第 2 步找不到第 1 步刚写入的数据（如改名静默失败） | setState 异步，单次等待扑空 | pollFind 轮询 |
| 中断刷新后演示数据残留在玩家存档 | 清理只认内存 ref | 内容匹配扫除 + begin 预清扫 |
| 章节触发器被踩穿 / 教程中画面自己往后跑 | Auto/Skip/Ctrl 绕过 handleNext 直接改 index | 三个绕行道全部封掉（见 §2.2） |
| 全屏按钮台词与按钮标签对不上 | 按钮标签随全屏态切换（如「常态/屏息」） | 教程开场主动拉起伪全屏（ref 包 `if (!isFullscreen) toggle()`） |

## 6. 验收门

- **本地**：构建过；产物含教程字符串；门两分支行为对（老手永不再问 / 新手中断刷新会重问重教）。
- **真机**：全流程走一遍——开场立绘情绪正确、按钮高亮与台词一一对应、带练每步画面有**可见变化**、结业清场后干净、再进不再问。
- 用户确认才算过（自动化只能给证据）。幻璃镜活体实现见 `mirage-galgame-frontend` skill（`references/newcomer-tutorial.md`，含真实源码路径对照）。
