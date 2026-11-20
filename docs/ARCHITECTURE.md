# 天机历 · 架构设计文档

> 版本：v1.0（初版框架完成态）
> 日期：2026-11-20
> 定位：2026 Qoder 高校创造力大赛 · LifeHack 生活娱乐赛道参赛作品
> 状态：本地 MVP 已完成并逐项实测通过；Qoder Sites 公开部署为下一阶段工作（见 §9）

---

## 1. 项目概述

「天机历」是一款传统文化运势体验 Web 应用，融合 **周易六十四卦、传统黄历、二十八宿值日、八字五行、择吉、民俗解梦** 六个维度，
由规则引擎生成每日运势与吉日推荐，并可调用大模型（DeepSeek）生成通俗白话解读。
共 8 个功能 Tab：今日 / 黄历 / 择吉 / 运势 / 八字 / 摇卦 / 解梦 / 设置（择吉与解梦为竞品调研后新增，见 §5.6、§5.7）。

- **产品定位**：传统文化体验 + 娱乐参考，全站显著标注免责声明，不做医疗/投资/决策建议。
- **目标场景**：评委/用户打开网页 3 分钟内可完成"看黄历 → 排八字 → 摇一卦 → 看运势 → AI 解读"完整体验。
- **参赛赛道**：LifeHack 生活娱乐（官方示例"生活小工具、互动叙事与生成式玩具、可以在浏览器里玩 3 分钟的东西"）。

### 1.1 比赛硬性约束（来源：天池赛题页 532536）

| 约束 | 说明 |
|------|------|
| 开发工具 | 必须全程使用 Qoder 开发（本项目满足） |
| 部署形态 | **必须部署到 Qoder Sites 并设置公开访问**，不接受本地文件/压缩包 |
| 作品帖 | 2026-11-30 18:00 前在天池赛题页论坛发布，含五部分：自我介绍 / 作品是什么 / 为什么做 / 怎么用（5 步内）/ Qoder 制作过程（多截图） |
| 认证 | 天池实名认证 + 阿里云大学生认证；university.aliyun.com/action/qoder 领 Qoder CN 学生权益 |
| 时间线 | 报名+发帖截止 11-30 18:00 → 初筛 12-07（每赛道 14 队）→ 线上路演决赛 12-15 |
| 可选加分 | 小红书/抖音/X 分享（标题带"2026 Qoder 高校创造力大赛"）可获社交传播奖 |

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────┐
│  浏览器（Vue 3 SPA，纯静态产物）                          │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 今日总览  │ │ 黄历/星宿 │ │ 八字排盘  │ │ 周易摇卦  │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│  ┌──────────┐ ┌──────────┐                             │
│  │ 择吉扫描  │ │ 民俗解梦  │ （调研后新增 Tab）            │
│  └────┬─────┘ └────┬─────┘                             │
│       └────────────┴─────┬──────┴────────────┘         │
│                    ┌─────┴─────┐                        │
│                    │ 运势引擎   │ ← 五行生克规则打分       │
│                    └─────┬─────┘                        │
│  ┌───────────────────────┴──────────────────────────┐   │
│  │ 核心库：lunar-typescript（历法/干支/八字/星宿）      │   │
│  │ 本地数据：hexagrams.json（64卦）+ dreams.json（96条）│   │
│  │ 本地持久化：localStorage（生辰/卦簿/设置）           │   │
│  └──────────────────────────────────────────────────┘   │
│                         │ AI 解读（SSE 流式）            │
└─────────────────────────┼───────────────────────────────┘
              当前：直连 DeepSeek（用户自填 Key，开发态）
              目标：↓
┌─────────────────────────┼───────────────────────────────┐
│  Qoder Sites            ▼                               │
│  静态托管（dist/） + Edge Function「app」（Deno）         │
│  POST /functions/v1/app/interpret                       │
│  Secret: DEEPSEEK_API_KEY（服务端持有，浏览器不可见）      │
│  限流 + 输入校验 + 固定上游 api.deepseek.com              │
└─────────────────────────────────────────────────────────┘
```

**架构原则**：
1. 除 AI 解读外**零网络依赖**——历法、卦象、运势全部本地计算，离线可用、结果可复现。
2. 隐私最小化——生辰仅存浏览器 localStorage；AI 解读时才随请求发送。
3. 确定性优先——黄历/星宿按日期确定；运势按"日期+日主"哈希确定；摇卦随机但同日同事只取初卦。

---

## 3. 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 框架 | Vue 3 + Vite 8（JavaScript） | 轻量、构建快、产物纯静态，符合 Sites 托管要求 |
| 历法引擎 | lunar-typescript（6tail） | 一个库覆盖农历/干支/宜忌/彭祖/吉神/二十八宿/节气/八字/纳音/胎元命宫 |
| 卦爻辞数据 | open-iching 公版结构化数据 | 64 卦 × 卦辞 + 386 爻辞（含用九/用六），已校验修正 |
| AI | DeepSeek（deepseek-chat，OpenAI 兼容 SSE） | 中文好、成本低、国内访问稳定 |
| 部署（下阶段） | Qoder Sites 静态托管 + Edge Function（Deno） | 比赛硬性要求；Secret 服务端持有 |
| 视觉 | 原生 CSS 设计系统（暗色"观天象"仪表风，另一窗口重构；CSS 变量名沿用 --paper/--cinnabar/--gold 等） | 新页面通过变量继承主题 |

---

## 4. 目录结构（现状）

```
tianji/
├── index.html                  # 入口，zh-CN，标题/描述/favicon
├── public/favicon.svg          # 朱砂印章式「易」字图标
├── src/
│   ├── main.js                 # createApp 入口
│   ├── App.vue                 # 页头 + 六 Tab 导航 + KeepAlive + 页脚免责声明
│   ├── style.css               # 国风设计系统（CSS 变量 + 组件样式 + 铜钱/爻动画）
│   ├── store.js                # Vue reactive 全局状态 + localStorage 持久化
│   ├── data/
│   │   ├── hexagrams.json      # 64 卦数据（71KB）
│   │   └── dreams.json         # 梦境词库（96 条，公版周公解梦民俗释义）
│   ├── lib/
│   │   ├── calendar.js         # 黄历/星宿/八字封装 + 五行生克关系
│   │   ├── hexagram.js         # 三钱法摇卦 + 本卦/变卦推演
│   │   ├── fortune.js          # 运势规则引擎（确定性打分）
│   │   └── ai.js               # DeepSeek SSE 客户端 + prompt 组装（今日/卦象/梦境三态）+ 设置存取
│   ├── components/
│   │   ├── DateBar.vue         # 日期切换（前一日/后一日/日期选择/回到今天）
│   │   └── AiPanel.vue         # AI 解读浮层（流式打字机 + 错误处理 + 中止）
│   └── views/
│       ├── HomeView.vue        # 今日总览（观天象首屏+历法+宜忌+星宿+运势摘要+AI入口）
│       ├── AlmanacView.vue     # 黄历详情（全量宜忌/冲煞/吉神/方位/星宿歌诀）
│       ├── ZejiView.vue        # 择吉（事项×范围扫描吉日，避冲生肖，跳转黄历）
│       ├── FortuneView.vue     # 运势详情（综合分/四分项/开运参考）
│       ├── BaziView.vue        # 八字（公历/农历输入+四柱表+五行分布条）
│       ├── DivinationView.vue  # 摇卦（铜钱动画+卦象+动爻+变卦+卦簿持久化）
│       ├── DreamView.vue       # 解梦（关键词/别名匹配+分类浏览+热门梦境+AI解梦）
│       └── SettingsView.vue    # AI 配置（开发态）+ 关于/免责
└── docs/ARCHITECTURE.md        # 本文档
```

---

## 5. 核心模块设计

### 5.1 历法引擎 `lib/calendar.js`

| 导出 | 职责 |
|------|------|
| `getDayInfo(dateStr)` | 返回某日全量黄历：农历文本、年月日干支、宜忌、冲煞、彭祖百忌、吉神凶煞、二十八宿（宫+兽+宿+七政+动物，如"北方玄武 · 牛金牛"）、宿歌、节气区间（getPrevJieQi(true)/getNextJieQi(true)）、喜/财/福神方位、当日天干五行 |
| `getBazi(profile)` | 生辰 → 四柱干支/五行/纳音、五行计数、日主五行、生肖、胎元/命宫/身宫、旬空、缺行提示。支持公历（Solar.fromYmdHms）与农历（Lunar.fromYmdHms，闰月传负月数） |
| `relationOf(envWx, meWx)` | 五行关系判定：比和 / 生我 / 我生 / 克我 / 我克 |
| `SHENG / KE / RELATION_DESC` | 生克映射表与关系白话释义 |

关键 API 备忘（lunar-typescript）：
- `lunar.getDayYi()/getDayJi()` 宜忌数组；`getDayChongDesc()/getDaySha()` 冲煞
- `lunar.getXiu()/getZheng()/getAnimal()/getGong()/getShou()/getXiuLuck()/getXiuSong()` 星宿全家桶
- `lunar.getEightChar()` → `getYear()/getMonth()/getDay()/getTime()`、`getXxxWuXing()`（返回干支两字五行）、`getXxxNaYin()`、`getTaiYuan()/getMingGong()/getShenGong()/getDayXunKong()`
- 日主五行取 `LunarUtil.WU_XING_GAN[dayGan]`（单字）

### 5.2 卦象引擎 `lib/hexagram.js`

**数据格式**（hexagrams.json，array 自下而上）：
```json
{ "id": 11, "name": "泰", "symbol": "䷊",
  "array": [1,1,1,0,0,0],          // 初爻→上爻，1阳0阴
  "combination": ["乾","坤"],       // [下卦, 上卦]
  "scripture": "小往大来，吉，亨。",
  "lines": [ {"id":1,"name":"初九","scripture":"..."}, ... ] }
```
乾/坤各 7 条 lines（第 7 条为用九/用六）。已修正原数据错字"见龙再田"→"见龙在田"。

**三钱法算法**：
- 每爻投 3 枚铜钱（crypto.getRandomValues），背=3 字=2，求和：
  - 6 老阴（动，变阳）概率 1/8；7 少阳 3/8；8 少阴 3/8；9 老阳（动，变阴）1/8
- 六爻自下而上累积 → `buildResult(lines)`：
  - 本卦码 = 各爻阴阳 join；变卦码 = 动爻取反
  - Map 查表得本卦/变卦对象；`fullName()` 生成"地泽临/乾为天"式全称（习坎特判"坎为水"）
  - 动爻取本卦对应爻辞；**六爻皆动且本卦为乾/坤时取用九/用六**
- 卦名自然象映射：乾天 坤地 震雷 巽风 坎水 离火 艮山 兑泽

**卦簿规则**：`localStorage["tianji.gua.{dateStr}.{questionHash}"]` 存六爻结果；
同日同问直接还原初卦（"初筮告，再三渎"），换问题文本即新卦。

### 5.3 运势引擎 `lib/fortune.js`

**输入**：当日天干五行（环境）× 日主五行（我）→ 生克关系 → 分项基础分：

| 关系 | 事业 | 财运 | 感情 | 健康 |
|------|-----|-----|-----|-----|
| 生我 | 88 | 70 | 84 | 88 |
| 比和 | 80 | 66 | 82 | 84 |
| 我生 | 74 | 80 | 76 | 66 |
| 我克 | 70 | 88 | 72(+8 男) | 72 |
| 克我 | 62 | 58 | 68(+10 女) | 56 |

- 扰动：`FNV-1a hash(dateStr|日主|分项) % 15 - 7`，clamp 40~98 → **同日同人结果稳定**
- 星级 = round(score/20)；无八字时基础分 72（通用运势）
- 开运参考：取"生我"之五行 → 颜色（木青绿/火朱红/土黄棕/金素白/水玄蓝）、河图数（水1,6 火2,7 木3,8 金4,9 土5,10）、方位（木东/火南/土西南/金西/水北）
- 每分项 5 档文案库（TIPS，1~5 星各一句）

### 5.4 AI 解读 `lib/ai.js`（现状：开发态直连）

- 设置存 `localStorage["tianji.settings"]`：baseUrl（默认 https://api.deepseek.com）、apiKey、model（deepseek-chat）
- `buildContext()` 把结构化数据（日期干支/黄历宜忌/星宿/节气/命主四柱五行/运势分项/卦象动爻/梦境释义）拼为 JSON 用户消息；按 `aiContextKind` 三态切换问法（今日综合解读 / 卦象解读 / 梦境解读——梦境态要求结合传统解梦文化与现代心理视角，温和积极）
- 系统 prompt 约束：国学讲解员人设、积极温和、**禁医疗/投资/赌博建议**、凶象温和引导、400-600 字分节
- `streamInterpret()`：fetch POST /chat/completions（stream:true），手工解析 SSE `data:` 帧增量回调；非 200 抛含状态码错误；AbortController 支持中止

### 5.5 全局状态 `store.js`

`reactive({ dateStr, profile, settings, aiOpen, aiContextKind, hexSession, dreamSession, tabRequest })`；
watch 深度持久化 profile/settings；派生函数 `dayInfo()/bazi()/fortune()` 供各视图 computed 使用。
- `dreamSession`：解梦页选中的词条（{keyword, alias, cat, luck, text}），供 AiPanel 组装梦境上下文
- `tabRequest`：跨 Tab 跳转信号（择吉页点吉日 → 设置 dateStr 并请求黄历 Tab），App.vue watch 后执行 switchTab 并清空

### 5.6 择吉 `views/ZejiView.vue`（竞品调研后新增）

- 事项 → 黄历宜忌关键词映射（EVENTS）：嫁娶['嫁娶','订婚','纳采']、搬家['入宅','移徙']、开业['开市','开张','开业','立券','交易']、出行、签约、动土、祈福、安床、理发、入学
- 扫描算法：从今日起逐日调 `getDayInfo()`（范围 30/60/90 天，computed 缓存），日宜数组与关键词求交集即命中；无独立择吉数据源，完全复用历法引擎
- 避冲：勾选"避开冲我生肖"后过滤 `info.chong` 以命主生肖结尾的日（需已录入八字）
- 结果卡展示公历/农历/干支/命中宜项，点击 `gotoDay(ds)` 设置 dateStr + tabRequest='almanac' 跳转黄历详情

### 5.7 解梦 `views/DreamView.vue` + `data/dreams.json`（竞品调研后新增）

- 词库：96 条民俗词条 `{keyword, alias[], cat, luck(吉/平), text(传统释义+白话)}`，分类：动物/人物/自然/物品/行为/身体/建筑/饮食/植物/鬼神；释义整理自公版《周公解梦》民俗文本，界面明示娱乐参考
- 匹配规则：查询词与 keyword/alias **双向 includes**（"被蛇咬"命中"蛇"的别名），搜索时清空已选卡片（watch query）；分类按钮与热门梦境 chips 辅助浏览
- 选中词条 → 展示释义卡 + "AI 解梦"按钮：写入 `store.dreamSession` 并 `openAi('dream')`，AiPanel 标题切为"梦境解读"

---

## 6. 数据与持久化

| Key | 内容 | 生命周期 |
|-----|------|---------|
| `tianji.profile` | 生辰 {calendar, year, month, day, hour, minute, leap?, gender} | 用户清除前 |
| `tianji.settings` | AI 配置（部署后移除，见 §9） | — |
| `tianji.gua.{date}.{hash}` | 当日某问的六爻结果 | 按日自然失效 |

---

## 7. 初版验证记录（2026-11-20，浏览器 DOM 实测）

| 用例 | 结果 |
|------|------|
| 黄历 2026-11-20 | 丙午年己亥月戊戌日、宜忌/冲煞/彭祖/吉神/牛金牛/立冬→小雪 全部正确 |
| 八字 公历 1995-08-15 14:00 | 乙亥 甲申 戊寅 己未，日主戊土属猪，五行缺火 ✓ |
| 八字 农历 1995 六月二十 | 转换公历 1995-07-17 ✓；农历三十逢小月正确报错拦截 ✓ |
| 运势 戊土逢戊戌日 | 判"比和"，扶运火/朱红/正南 ✓ |
| 摇卦 | 实测得地泽临（九二、六四动）变震为雷，卦辞爻辞变卦核对无误 ✓ |
| 卦簿 | 切 Tab 返回同日同问还原初卦，不重摇 ✓ |
| AI 链路 | 请求真实到达 DeepSeek；无 Key 提示、无效 Key 401 错误展示正常 ✓ |
| 择吉 嫁娶×30 天 | 命中 9 个吉日；勾选避冲后冲猪日正确剔除 ✓ |
| 择吉 交叉校验 | node 直调 lunar-typescript：2026-11-22 庚子宜嫁娶纳采（命中）、11-21 己亥无嫁娶（排除）✓ |
| 择吉 跳转 | 点吉日切黄历 Tab 且日期同步（11-22 恰交小雪，节气显示正确）✓ |
| 解梦 | 关键词搜索、别名匹配（"被蛇咬"→蛇）、分类浏览、热门 chips ✓；AI 面板标题"梦境解读"+无 Key 提示 ✓ |
| 构建 | `npm run build` 通过（54 modules，388ms） |

未验证项：真实 Key 下的完整流式解读（待 Key）；像素级视觉截图（应用内浏览器面板隐藏，DOM 结构已验证）。

---

## 8. 已知限制与风险

1. **合规**：占卜类内容必须以"传统文化体验/娱乐参考"呈现，免责声明已全站覆盖；AI prompt 已禁迷信恐吓与专业建议。部署公开后避免"算命""改运"类营销措辞。
2. **直连 Key 暴露**：开发态用户自填 Key 存 localStorage 仅适合自用；公开部署必须走服务端代理（§9）。
3. **晚子时**：八字时柱按 lunar-typescript 默认策略，未做真太阳时/晚子时流派选项（娱乐场景可接受）。
4. **运势文案**：规则打分是民俗演绎而非统计预测，文档与界面均明示娱乐属性。

---

## 9. 下一阶段：Qoder Sites 部署改造方案（供后续窗口直接执行）

> 依据 sites-building / sites-hosting 技能规范整理。比赛要求公开访问 + 评委零配置体验 AI。

### 9.1 新增 Edge Function（`tianji/functions/`）

- `index.ts`：`Deno.serve(handler)`；`handler.ts`：纯 Request→Response，自包含、相对导入带扩展名
- 路由：`POST /functions/v1/app/interpret`（按 pathname 末段匹配 `interpret`，未知路径 404）
- 逻辑：
  1. 校验 method/content-type/body ≤ 16KB，context 为对象
  2. 限流：内存 Map 按 IP（x-forwarded-for）每日 ≤ 20 次（best-effort，isolate 重启重置）
  3. `Deno.env.get('DEEPSEEK_API_KEY')` 缺失 → 503 `{error:'service_not_configured'}`
  4. 服务端组装 system prompt（从前端 ai.js 迁移）+ 用户 context，固定上游 `https://api.deepseek.com/chat/completions`，model deepseek-chat，max_tokens≈900，60s 超时
  5. 上游 SSE body 直通回浏览器（text/event-stream）；上游失败映射 502，不回显原始异常
- Secret 名：`DEEPSEEK_API_KEY`（prepare_site.secretNames 声明；**值由用户在 Sites Settings 界面录入，不进聊天/代码/工具参数**）

### 9.2 前端改造

- `ai.js`：`streamInterpret(context, onDelta, signal)` 改调同源 `/functions/v1/app/interpret`；移除 baseUrl/apiKey/model；`service_not_configured` 显示"AI 解读暂未开放"
- `SettingsView.vue`：移除 Key 表单，保留关于/免责；`store.js` 移除 settings
- `style.css`：接入 Nudge 变量契约（appearance/radius/spacing/typography/motion）：
  `--site-bg/--site-fg/--site-accent/--site-on-accent/--site-surface/--site-muted/--site-border/--site-font`、
  `--site-radius`、`calc(24px*var(--site-space,1))`、`calc(48px*var(--site-type,1))`、`calc(180ms*var(--site-motion,1))`，
  默认值保持现有国风观感；动效 honor prefers-reduced-motion
- `vite.config.js`：dev 代理 `'/functions/v1/app': 'http://127.0.0.1:8000'`（本地 Deno 或 Node shim 验证 handler）

### 9.3 发布流程要点

1. `open_design_workbench`（projectPath=tianji，name=天机历，pages=[/]，capabilities 五项）
2. `npm run build` → `prepare_site`（webDirectory: "dist"，functionDirectory: "functions"，secretNames: ["DEEPSEEK_API_KEY"]，spa 按需）
3. 等 Functions 就绪 → 用户在 Settings 录入 Secret 并确认同步
4. `publish_site` → 验证 published:true → **设置公开访问**（比赛要求，需用户确认受众变更）
5. 线上实测一次真实 AI 解读（代表路径）→ `show_publish_confirmation` 交付
6. 起草天池作品帖（五部分 + 过程截图清单），11-30 18:00 前发布

### 9.4 作品帖素材清单（待补）

- Qoder 对话过程截图：需求分析、方案问答、代码生成、浏览器实测、错误修复（星宿"牛牛"→"牛金牛"、卦辞错字修正）
- 应用截图：今日总览 / 黄历 / 八字排盘 / 摇卦动画与结果 / AI 解读流式输出
- 一句话介绍：「打开网页 3 分钟，看今日黄历、排自己的八字、摇一卦周易，AI 用白话讲给你听——传统文化娱乐小工具。」

---

## 10. 运行方式（当前开发态）

```bash
cd tianji
npm install        # 已装：vue、lunar-typescript
npm run dev        # http://localhost:5173
npm run build      # 产物 dist/
```

AI 解读：设置页填入 DeepSeek API Key（仅存浏览器本地）。