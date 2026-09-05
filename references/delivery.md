# 构建与交付（webpack → dist → GitHub → jsDelivr → 界面正则）

## 1. 构建系统（tavern_helper_template）

- **无 vite**，主构建是 webpack5：`pnpm build`（production）/ `build:dev` / `watch`（开发）。
- **自动入口发现**：glob 收集 `{示例,src}/**/index.{ts,tsx,js,jsx}`；目录下有 `index.html` 视为"界面项目"（script+html），否则纯脚本项目。CI 下含 `@no-ci` 注释的入口被跳过。
- 输出：`src/yaoguai/<项目名>` → `dist/yaoguai/<项目名>/index.js`（ESM，单 chunk）；有 html 入口时再由 HtmlWebpackPlugin 产出 `index.html`。
- **单文件内联**：`HtmlInlineScriptWebpackPlugin`（JS 全内联）+ `MiniCssExtractPlugin` + `HTMLInlineCSSWebpackPlugin`（CSS 内联成 `<style>`）。产物是一个自包含 index.html（内联样式 + 字体 link + 内联 `<script type="module">` + `<div id="root">`）——正则 load 的就是它，无需额外资源请求。
- **externals 策略（关键）**：
  - `jquery→$`、`lodash→_`、`toastr`、`showdown`、`YAML`、`zod→z` 映射到酒馆助手 iframe 已提供的全局；
  - 其余 npm 包 external 为 `module-import https://testingcf.jsdelivr.net/npm/<pkg>/+esm`（运行时 CDN 拉 ESM）；
  - **react/react-dom/motion/framer-motion/clsx/tailwind-merge 等强制打包**——避免双 React 实例和 CSP 问题（白屏/hook 报错的常见根因）。
- watch 模式附加：socket.io 向酒馆推送 `iframe_updated` 热更；`pnpm sync watch` 联动 tavern_sync。

## 2. 本地开发

- `node serve.mjs`：CORS 全开的静态服务器。
- 导入一个 **disabled 的本地开发正则**（与正式正则同构，URL 换 `http://localhost:<port>/dist/yaoguai/<项目名>/index.html`），调试时启用、交付时禁用。
- 浏览器直接开产物可测纯 UI，但酒馆全局（getChatMessages 等）不存在——适配层 try/catch + 占位值降级就是为此设计。

## 3. 交付物清单（`导入到酒馆中/` 目录，手工维护）

| 文件 | 作用 |
|---|---|
| `<项目名>-世界书.json` | 世界书（含 [initvar]/[mvu_update] 契约条目） |
| `<项目名>-界面-正式.json` | 界面正则（楼层文本 → iframe） |
| `<项目名>-界面-实时修改.json` | 本地开发正则（`disabled:true`，指向 localhost） |
| `<项目名>-脚本-Mvu.json` | MVU 框架脚本（一行 CDN import） |
| `<项目名>-脚本-变量结构.json` | Zod 变量结构脚本 |
| `<项目名>-脚本-锁定前端.json`（可选） | 全屏楼层锁定脚本 |
| `导入说明.txt` | 导入步骤 |

交付层最有价值、两项目均真机验证的两件：**界面-正式正则**（§4）与**锁定前端脚本**（§8）。已评估弃置的变体：统一视图（脚本 JSON 引导单 iframe 覆盖全部聊天、隐藏酒馆原生楼层）——无价值，不纳入交付清单，勿再从蓝本项目里吸收它。

## 4. 界面正则 JSON 字段逐解

```json
{
  "scriptName": "<项目名>-界面",
  "findRegex": "/[\\s\\S]*/s",
  "replaceString": "```\n<body>\n<script>\n$('body').load('https://cdn.jsdelivr.net/gh/<user>/<repo>@master/dist/yaoguai/<项目名>/index.html')\n</script>\n</body>\n```",
  "placement": [2],
  "disabled": false,
  "markdownOnly": true,
  "promptOnly": false,
  "runOnEdit": false,
  "substituteRegex": false,
  "minDepth": null, "maxDepth": null,
  "trimStrings": []
}
```

- `findRegex:/[\s\S]*/s`：匹配楼层全部文本（s 标志含换行）。
- `placement:[2]`：**仅显示层（display）**，不改提示词——楼层的真实文本仍是 AI 输出（变量解析、回看历史都靠它），显示层才变成 iframe。
- `markdownOnly:true`：只影响渲染。
- 替换串机制：酒馆渲染带 ``` 围栏的 `<body>` 代码块时，酒馆助手把该代码块提升为 iframe；iframe 里 `$('body').load(URL)` 把 CDN 单文件 HTML 整页拉进来。链路 = 楼层文本 → 正则替换成代码块 → iframe → jQuery.load 远程 HTML。

## 5. 脚本类 JSON（酒馆助手脚本库导出格式）

```json
{
  "id": "<固定 UUID —— 重复导入覆盖同位脚本>",
  "name": "Mvu",
  "enabled": true,
  "type": "script",
  "content": "import 'https://…/bundle.js';",
  "info": "人读说明",
  "button": { "buttons": [ {"label":"重演","visible":false} ] },
  "data": {},
  "export_with": { "data": true, "button": true }
}
```

角色卡内不塞大段代码，只挂"引导器"（一行 CDN import），代码本体走 CDN——发新版即全员自动更新。两种交付并存：.json 直接导入脚本库；.js（TS 编译产物）供 CDN import 引导。

## 6. 角色卡 YAML（角色卡/index.yaml，tavern_sync 格式，可选）

- 首行声明 schema（StageDog tavern_sync character.zh.json）；中文字段名（世界书名称/条目/启用/激活策略.类型："蓝灯"/"绿灯"）。
- 公共字段用 YAML 锚点复用（`&分隔符` + `<<: *分隔符`）。
- 脚本挂载：`扩展字段.酒馆助手.脚本库` 数组，每项 `名称/id(固定 UUID)/启用/类型: script/内容`。

## 7. CDN 与 CI

- 发布链路：push 到 main/master → GitHub Actions checkout → **删 dist** → pnpm install && pnpm build → add-and-commit 提交新 dist → autotag 打 `vX.Y.Z`。
- jsDelivr 直接映射 GitHub 路径：`https://cdn.jsdelivr.net/gh/<user>/<repo>@master/dist/yaoguai/<项目名>/index.html`。打 tag 是为了让 `@master` 非版本引用走缓存策略。
- `git config --global merge.ours.driver true`：dist 冲突一律取当前版本（CI 会重建）。
- **更新不生效**：CDN 缓存是主因。手段：发布打 tag、必要时换仓库名/路径强刷。注意 purge 只清 jsDelivr 边缘缓存，**清不掉手机浏览器自身 HTTP 缓存**——手机端自检见 §7.5「手机端缓存自检」。

## 7.5 手动发布器（可选，不等 CI 的快速通道）

若工作区有 `tools/publis/publish_artifact.mjs`（该发布器是工作区私有工具，不随本 skill 分发；没有它就走上面的 CI 路线）：直接把构建产物推到 CDN 仓库，**当前分支与本地工作区零改动**（git plumbing 全程走临时索引）。

```
node tools\publis\publish_artifact.mjs <仓库> dist/yaoguai/<项目名>/index.html
```

- `<仓库>` 三种写法：已配置的远程名 / `owner/repo` / 完整 URL；后两种首次推送自动登记同名远程。
- 机制：`GIT_INDEX_FILE` 临时索引 → `read-tree` 远端 head → `add` 指定路径 → `write-tree` → 与远端 tree 完全一致则跳过 → `commit-tree -p 远端head`（快进推送，历史保留）→ push。
- 选项：`-m 信息`、`-b 分支`（默认 master）、`--replace-all`（整体替换）、`--dry-run`。
- 成功后为每个文件打印 CDN 地址（路径逐段 encodeURIComponent，中文文件名安全）。

**日常更新三步**：① `pnpm build`（不打包就发布=传旧文件）→ ② publish 命令 → ③（可选，要立刻生效才做）浏览器打开 `https://purge.jsdelivr.net/gh/<user>/<repo>@master/dist/...` 逐个刷缓存（显示 `"success": true`）；不刷则玩家最多 12h 后自动拿到新版。正则/脚本 JSON 一个字不用改——URL 没变，内容已是新版。

**⚠ 构建与发布绝不许串在同一条命令里跑**（`build & publish` 会翻车）：webpack 还没把 10MB 级单文件产物写完，`git add` 就读走了半截，仓库里进截断 blob，玩家拿到行为诡异的前端且极难察觉。必须等 build 完全结束（进程退出）再单独跑 publish（CI 路线天然分步，无此坑）。发布后自检一条：CDN 文件字节数 == 本地 `dist` 文件字节数（用 `fs.statSync(...).size` 比字节，别比字符串长度——UTF-16 码元数不等于字节数；也别拿 `</html>` 当结尾判据，单文件产物以 `</body>` 收尾）。

**手机端缓存自检**：purge 只清 jsDelivr 边缘，清不掉玩家手机浏览器自己的 HTTP 缓存（@master 文件浏览器侧可缓存约 12h）。UI 上要放**可见版本号**（如音乐面板角落的引擎修订号），玩家报「没更新」先让他看版本号，再看是不是要清浏览器缓存/无痕窗。

**三条铁律**：① 发给别人的 JSON 里不许出现 `localhost`（只允许出现在默认禁用的「实时修改」开发 JSON 里）；② 发布前必须先 build；③ 新建 CDN 仓库时一个勾都不打（勾了 README 首推必冲突）。

**排查**：`! [rejected] (non-fast-forward)`=仓库被网页端手动改过（勿强推）；404=等 5 分钟 + 确认仓库 Public；「无需发布」=没改东西或忘了 build。**别发整个文件夹**（会把 .map、LICENSE.txt 等调试文件也传上去）。

## 8. 锁定前端脚本（可选，纯脚本项目）

双项目真机验证过的交付件。不是防篡改，而是**全屏某楼层时隐藏其他楼层并防止酒馆销毁该楼层 iframe** 的体验增强脚本。纯脚本项目（无 html 入口），产物 `index.js`，用脚本 JSON `content: import 'CDN…/index.js'` 挂载。四层机制：

1. **CSS 隐藏**：向父页注入 `<style id="tavern-<项目名>-lock-style">`：`.mes:not([mesid="N"]) { display:none !important }`。
2. **父页原型拦截（核心）**：向 `window.parent.document.head` 注入 `<script>`，在**父页 JS 上下文**里猴子补丁三个 API：`HTMLIFrameElement.prototype.remove`、`Node.prototype.removeChild`（含嵌套检查：被删节点内部若含受保护楼层 iframe 也拦截）、`jQuery.fn.remove`（酒馆大量用 jQuery）。目标节点的 `closest('[mesid]')` 等于锁定楼层号时跳过删除——从源头阻止酒馆切换/重渲染时销毁界面 iframe。提供 `window.__tavernLockCleanup()` 恢复原型；重新注入前先清理旧补丁。
3. **全屏事件驱动**：监听父页 `fullscreenchange`；进入全屏且元素属于某楼层 → `lockFloor(id)`；退出 → `unlockFloor()`。脚本晚加载时若已处于全屏也会补处理。
4. **新楼层自动隐藏**：`MutationObserver` 观察 `#chat` 新增的 `.mes`，不属于锁定楼层立即 `display:none`；`pagehide` 全面清理。

与前端本体的配合：前端 App.tsx 里的 iframe 高度守卫、`window.__<项目名>Fullscreen` 标志与这套全屏/楼层生命周期围绕同一状态。

## 9. 导入步骤（导入说明.txt 的五步）

1. 导入世界书 JSON，绑定到角色或聊天；
2. 导入两个正则：界面-正式（启用）+ 界面-实时修改（默认禁用，本地开发才开）；
3. 导入酒馆助手脚本（Mvu 框架 + 变量结构）;
4. `[initvar]变量初始化勿开` 保持禁用；
5. 开新聊天，验证蓝灯条目出现、界面 iframe 正常加载。

## 10. 从零照做的最小清单

1. `Use this template` 建仓库 → 启用 Actions 写权限；
2. `src/yaoguai/<项目名>/`：`index.html`（空壳+字体）+ `index.tsx`（React 入口）+ `src/`；
3. `src/yaoguai/<项目名>/导入到酒馆中/`：四类 JSON + 导入说明；
4. `src/yaoguai/<项目名>/角色卡/`：index.yaml + 脚本引导器（Mvu/变量结构）；
5. 纯脚本（如锁定前端）单独目录只放 `index.ts`；
6. push → CI 自动构建提交 dist + 打 tag → 正则/脚本 JSON 的 URL 指向 `cdn.jsdelivr.net/gh/<user>/<repo>@master/dist/…` 闭环。
