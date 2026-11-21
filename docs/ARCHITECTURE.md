# 天机历 · 架构设计文档

> 版本：v1.0（初版框架完成态）
> 日期：2026-11-20
> 定位：2026 Qoder 高校创造力大赛 · LifeHack 生活娱乐赛道参赛作品
> 状态：本地 MVP 已完成并逐项实测通过；Qoder Sites 公开部署为下一阶段工作（见 §9）

---

## 1. 项目概述

「天机历」是一款传统文化运势体验 Web 应用，融合 **周易六十四卦、传统黄历、二十八宿值日、八字五行、择吉、民俗解梦、实算星象** 七个维度，
由规则引擎生成每日运势与吉日推荐，并可调用大模型（DeepSeek）生成通俗白话解读。
共 11 个功能页：今日 / 黄历 / 择吉 / 运势 / 八字 / 摇卦 / 解梦 / 观星 / 同象 / 合参 / 设置
（章节以 `src/data/chapters.js` 为唯一清单，择吉与解梦为竞品调研后新增，见 §5.6、§5.7；观星见 §5.8；同象见 §5.10）。

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
1. 除 AI 解读外**零网络依赖**——历法、卦象、运势、星象全部本地计算，离线可用、结果可复现。
2. 隐私最小化——生辰仅存浏览器 localStorage；AI 解读时才随请求发送。
3. 确定性优先——黄历/星宿按日期确定；运势按"日期+日主"哈希确定；摇卦随机但同日同事只取初卦。

---

## 3. 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 框架 | Vue 3 + Vite 8（JavaScript） | 轻量、构建快、产物纯静态，符合 Sites 托管要求 |
| 历法引擎 | lunar-typescript（6tail） | 一个库覆盖农历/干支/宜忌/彭祖/吉神/二十八宿/节气/八字/纳音/胎元命宫 |
| 卦爻辞数据 | open-iching 公版结构化数据 | 64 卦 × 卦辞 + 386 爻辞（含用九/用六），已校验修正 |
| 天文推算 | 自研 `lib/sky.js`（JPL 近似行星根数 + Meeus 第 47 章月历 + 26 亮星表） | 不引星历表/星图渲染库，离线可算，精度可对 JPL Horizons 复核（见 §5.8） |
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
│   ├── App.vue                 # 页头 HUD + 章节索引/导航 + 全局快捷键 + 懒加载 KeepAlive + 页脚免责声明
│   ├── style.css               # 国风设计系统（CSS 变量 + 组件样式 + 铜钱/爻动画）
│   ├── store.js                # Vue reactive 全局状态 + localStorage 持久化
│   ├── data/
│   │   ├── hexagrams.json      # 64 卦数据（71KB）
│   │   ├── dreams.json         # 梦境词库（96 条，公版周公解梦民俗释义）
│   │   └── tongxiang.json      # 同象坐标库（16 条史载/演义事件，各带系日依据与精度）
│   ├── lib/
│   │   ├── calendar.js         # 黄历/星宿/八字封装 + 五行生克关系
│   │   ├── hexagram.js         # 三钱法摇卦 + 本卦/变卦推演
│   │   ├── fortune.js          # 运势规则引擎（确定性打分）
│   │   ├── solar.js            # 真太阳时与太阳视位置（时角/高度方位）
│   │   ├── sky.js              # 星空位置推算（日月行星 + 26 亮星 + 今夜轨迹）
│   │   ├── tongxiang.js        # 同历法坐标匹配（八通道加权，按系日精度闸门）
│   │   └── ai.js               # DeepSeek SSE 客户端 + prompt 组装（今日/卦象/梦境/星象四态）+ 设置存取
│   ├── components/
│   │   ├── DateBar.vue         # 日期切换（前一日/后一日/日期选择/回到今天）
│   │   ├── KindredTimes.vue    # 同象卡（此刻↔彼时坐标对照 + 史/演义分标 + 依据披露）
│   │   └── AiPanel.vue         # AI 解读浮层（流式打字机 + 错误处理 + 中止）
│   └── views/
│       ├── HomeView.vue        # 今日总览（观天象首屏+历法+宜忌+星宿+运势摘要+AI入口）
│       ├── AlmanacView.vue     # 黄历详情（全量宜忌/冲煞/吉神/方位/星宿歌诀）
│       ├── ZejiView.vue        # 择吉（事项×范围扫描吉日，避冲生肖，跳转黄历）
│       ├── FortuneView.vue     # 运势详情（综合分/四分项/开运参考）
│       ├── BaziView.vue        # 八字（公历/农历输入+四柱表+五行分布条）
│       ├── DivinationView.vue  # 摇卦（铜钱动画+卦象+动爻+变卦+卦簿持久化）
│       ├── DreamView.vue       # 解梦（关键词/别名匹配+分类浏览+热门梦境+AI解梦）
│       ├── SkyView.vue         # 观星（星空罗盘+观测读数+今夜轨迹+月相+行星亮星清单+位置校准+AI观星解读）
│       ├── KindredView.vue     # 同象（08 章，坐标卡+匹配通道说明+坐标库全览+边界声明）
│       ├── SynthesisView.vue   # 合参（09 章，跨模块汇总）
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

### 5.8 观星 `lib/sky.js` + `views/SkyView.vue`（07 章 · 仰见星辰）

纯本地天文位置推算，不引入任何天文星历依赖包（不引星空渲染库、不引星历表）。

**算法与来源**：

| 计算 | 方法 |
|------|------|
| 行星 | JPL *Approximate Positions of the Planets* 的 1800–2050 线性根数表（a/e/I/L/ϖ/Ω 各带世纪变率）+ 开普勒方程牛顿迭代 → 日心黄道 → 地心视黄经/黄纬；视星等取 `H + 5·log10(r·Δ) + k·i`（日心/地心距 + 相位角线性项）。未叠加同源文档的 18/54 项摄动级数，故外行星残差偏大 |
| 太阳 | 地平坐标复用 `lib/solar.js` 的 `getSolarPosition()`（平黄经/平近点角低阶展开 + 恒星时→时角）；黄经另由 `sunEcliptic()` 给出，供昏影分级与月相角距使用 |
| 月亮 | Meeus《Astronomical Algorithms》第 47 章 ELP2000/82 截断主项（含 A1–A7 共振项）→ 黄道坐标 + 地平视差 |
| 坐标换算 | 黄道↠赤道（真黄赤交角 ε = 23.4393° − 4e-7°/日）↠地平（恒星时 → 时角），并以 1.396971°/世纪 的岁差把 J2000 根数归算到观测历元平春分点 |
| 月亮高度 | 由地心距求地平视差 π，`Δh = −π·cos h` 修正；地平附近 π≈57′，直接影响升落时刻 |
| 轨迹 | 今夜 10 分钟采样高度序列，线性插值过零点 → 升起/落下/中天/最高，并标注拱极（`circumpolar`）与整夜不升（`neverUp`） |
| 星表 | `STAR_CATALOG` 26 颗亮星（J2000 赤经赤纬 + 视星等 + 中西星官/二十八宿名），自行与摄动未计 |

**暗夜指数**：`darkness`（太阳高度分 4 档：天光未退/民用昏影/航海昏影/天文黑夜）× 0.62 + `(100 − 月光削减)` × 0.26 + 目标高度加成（≤12）；
三项分量在 UI 上统一为"越高越好"（月光分量以 `无月 = 100 − moonPenalty` 呈现）。

**星空罗盘（`SkyView.vue`）**：方位—高度极射投影，`仰视` 定向（天顶居中、北朝上、东在左，与抬头看天的直觉一致）；
30°/60° 高度圈、黄道折线、月出月没方位刻度；标注按「日月 → 行星 → 亮星」优先级占位，撞框换侧、换侧仍挤则不标。
月相亮面由两段弧构成：外缘半圆 + 长短轴随照明度收放的明暗界线弧（首页 `ChapterInstrument` 的星盘微图沿用同一画法）。

**精度（对 JPL Horizons DE441，2026-11-21 / 2026-06-15 / 2027-02-03 / 2035-09-09 四个历元）**：
行星黄道坐标最大角差 **0.081°**（土星，Δλ）；日月反推 ICRF(J2000) 最大 **0.0133°**（48″，月亮赤经）；
星表 J2000 历元往返最大 **8.9e-6°**；北极星 2026 视赤纬 89.372°（J2000 目录 89.264°，向北天极靠近，进动方向正确）。
比对口径：几何日心/地心位置 vs Horizons 地心视位置，故 Δλ 中含周年光行差（≤20.5″）与章动，属预期残差。

**数据与隐私**：`store.location`（默认北京 39.9042/116.4074，可 GPS 或手动校准，与 CosmicHero/TimeCompass 共用）；
观星解读只随请求发送 `dayInfo` + 星象快照（`store.skySession`，含时刻、城市级坐标、暗夜指数、月相、可见行星与已升亮星、今夜事件表），
**不含生辰八字与运势**，AiPanel 的星象来源条目对此有明确说明。
`lib/sky.js` 只经 `SkyView.vue` 静态引入、首页用动态 `import()` 后台取数，因此不进首屏 chunk。

### 5.9 全局快捷键 `App.vue`

章节导航是扁平的：今日为上一层，`chapters` 数组顺序即同级左右顺序。`handleShortcuts` 挂在 window 上，统一让位于更强的上下文：

| 按键 | 行为 |
|------|------|
| `←` `→` | 在章节之间前进/后退（首尾不循环；今日页按 `←` 不动作） |
| `Backspace` | 回上一层（非今日页 → 今日；今日页仅吞掉默认行为，避免触发浏览器后退） |
| `Esc` | 索引层开着 → 只关索引；否则非今日页 → 回今日 |
| `I` | 打开章节索引（`Shift+I` 不劫持，留给开发者工具） |

守卫顺序：`defaultPrevented` / 修饰键 / AI 浮层开着 / 焦点在 `input·textarea·select·contenteditable`（`isTyping()`）时一律直接返回，因此日期选择、生辰录入、经纬度输入不受影响；只有真正处理了的按键才 `preventDefault`。索引层内另有 `handleIndexKeys` 负责 `Esc` 关闭与 `Tab` 焦点循环；键位说明常驻索引页脚（`<kbd>` + `style.css` 的 `.index-keys`）。

### 5.10 同历法坐标 `lib/tongxiang.js`（A 机制 · 同象）

把「某个历史人物在某个历史阶段也遇到了这种星象」做成可核验的计算，而不是文案。事件库只存**日期与叙事**，
干支、值日星宿、节气段一律交给既有的 `getDayInfo()` 反查——引擎只回答坐标是否重合，不推断际遇。

**系日精度闸门**（核心设计）：每条事件带 `date.precision`，决定它允许打开哪些通道，避免用推算出来的锚点日冒充史实。

| precision | 含义 | 可用通道 |
|-----------|------|---------|
| `full` | 年与农历月日均有一手依据 | 全部八条 |
| `lunar-day` | 月日有文本依据、年系推定 | 同农历月日、同农历月、同季 |
| `month` | 仅系到月 | 同农历月、同季 |
| `season` | 仅系到节令（如「严冬天气」） | 同季 |

**通道与权重**：同值宿 55 / 同日支 42 / 同农历月日 35 / 同干支年 30 / 同节气段 20（需同段且距节气同日 ±2）/ 同日干五行 14 / 同农历月 12 / 同季 8。
`findKindred(dateStr)` 取加权和降序、同年距升序，界面按 ≥50 / ≥20 折算「强 / 中 / 弱」三格，并注明这只是重合坐标条数。

**历法底座验证**：lunar-typescript 对古代日期双向换算一致（`Lunar→Solar→Lunar` 全等）。三条一手文本自证——
兰亭「岁在癸丑」→ 353 年干支确为癸丑（换算得 353-04-22）、《水调歌头》「丙辰中秋」→ 1076-09-15 年干支丙辰、
《前赤壁赋》「壬戌之秋，七月既望」→ 1082-08-12 年干支壬戌且恰为七月十六。史载系日亦与通行公历吻合：
岳飞绍兴十一年十二月廿九 → 1142-01-27、崖山祥兴二年二月初六 → 1279-03-19、崇祯十七年三月十九 → 1644-04-25。
**公元前不可用**（负年号会算出 `undefined` 干支），`solarStr()` 对 `year <= 0` 直接拒收，故库中不收先秦事件（荆轲、司马迁等只能另作人物谱，不参与同象匹配）。

**史/演义分标**：`kind: history | fiction` 在卡面直接标注（演义用虚线边框），`star` 字段挂天罡地煞星号（林冲天雄星、杨志天暗星、鲁智深天孤星、宋江天魁星）；
非 `full` 精度另有一行「系日依据」把 `basis` 原文摆出来。风雪山神庙一类原著只有「严冬天气」而无纪年，
故只做同季匹配，且界面写明「不作为史实陈述」。

**分包与导航**：同象独立成章（`chapters.js` 08 / KINDRED，合参顺延 09），`views/KindredView.vue` 经 `App.vue` 的 `loaders` 动态引入，坐标库随该章单独成块（23.05 kB / gzip 10.61 kB）；
`SynthesisView` 仍只渲染 `HomeAiConclusion`、不引入同象卡，入口块不受影响。章节索引、上/下章翻页与 `←`/`→` 快捷键全部从 `chapters` 派生，新章自动接入。

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

### 7.1 观星模块验证（2026-11-21，node 直调 + 浏览器实测）

| 用例 | 结果 |
|------|------|
| 算法精度 | 对 JPL Horizons（DE441）四历元（2026-11-21 / 2026-06-15 / 2027-02-03 / 2035-09-09）比对：五颗行星黄道坐标最大角差 0.081°（土星 Δλ），日月反推 ICRF(J2000) 最大 0.0133°（48″），日心距与 Horizons 一致到 0.003 AU ✓ |
| 星表 | 26 星 J2000 历元往返（进动→归算）最大角距 8.9e-6°；北极星 2026 视赤纬 89.372°，向天极靠近，进动方向正确 ✓ |
| 物理自检 | 北极星最高 40.5° ≈ 当地纬度 39.9°；织女一中天 88.9° ≈ 90−φ+δ；金星/水星"晨见于东方"与 04:11 升、09:40 中天自洽；土星 14:44 升 → 20:50 中天 → 02:49 落 ✓ |
| 一夜轨迹 | 2026-11-21 北京：日入 16:49 · 昏影终 17:23 · 天文黑夜 18:28→05:31 · 日出 07:11；南门二、老人标"[不升]"，北斗一/五与北极星标"[拱极]" ✓ |
| 星空罗盘 | 极射仰视投影方位/高度正确；标注避让后金星–角宿一、水星–太阳不再叠字 ✓ |
| 位置校准 | GPS 授权与手动经纬度（−90…90 / −180…180 越界拦截）即时重绘星图与轨迹 ✓ |
| 日期切换 | DateBar 改 2026-12-22（冬至）→ 事件表整表重算并显示"2026-12-22 夜"（需 `input` 事件，Vue v-model 生效）✓ |
| AI 观星解读 | 面板标题"观星解读"；抓包确认 context = `dayInfo` + 今夜星空块，**不含 bazi/fortune**；后端未部署时按 404/503 静默降级 ✓ |
| 首页联动 | 星轨第 07 卡渲染星盘微图（暗夜指数 + 月相双弧 + 亮星点），暗夜指数/可见数随 `store.location` 即时变化 ✓ |
| 分包 | `npm run build` 通过；`sky.js` 被提成共享 chunk `sky-*.js`（16.3 kB / gzip 6.9 kB），由 `SkyView` 与首页的动态 `import()` 共用，入口块仅 +1.3 kB |

未验证项：真实 Key 下的完整流式解读（待 Key）；像素级视觉截图（应用内浏览器面板隐藏，DOM 结构已验证）。

### 7.2 快捷键验证（2026-11-21，浏览器 DOM 实测）

| 用例 | 结果 |
|------|------|
| 同级换章 | 今日 `←` 不动作；`→` → `#/almanac` → `#/zeji`；`←` 回 `#/almanac` ✓ |
| 回上一层 | `#/zeji` 按 `Backspace` → `#/`；今日页按 `Backspace` 不离开（原生后退被拦截）✓ |
| `Esc` | `#/fortune` → `#/`；索引层开着时只关索引、不改 hash ✓ |
| `I` | 打开索引，页脚键位说明与 5 个 `<kbd>` 正常渲染 ✓ |
| 输入框让位 | 焦点在 `input[type=date]` 时 `←`/`Backspace` 均不导航，值保持 `2026-11-21` ✓ |
| AI 浮层让位 | `#/sky` 打开"观星解读"后 `Esc` 只关面板，hash 仍为 `#/sky` ✓ |

---

## 8. 已知限制与风险

1. **合规**：占卜类内容必须以"传统文化体验/娱乐参考"呈现，免责声明已全站覆盖；AI prompt 已禁迷信恐吓与专业建议。部署公开后避免"算命""改运"类营销措辞。
2. **直连 Key 暴露**：开发态用户自填 Key 存 localStorage 仅适合自用；公开部署必须走服务端代理（§9）。
3. **晚子时**：八字时柱按 lunar-typescript 默认策略，未做真太阳时/晚子时流派选项（娱乐场景可接受）。
4. **运势文案**：规则打分是民俗演绎而非统计预测，文档与界面均明示娱乐属性。
5. **观星近似边界**：行星根数表标称适用 1800–2050，而日期选择器放开到 1901–2099，区间外为线性外推（残差随世纪增大）；
   升落/中天取 10 分钟采样 + 线性插值且以几何地平 h=0 判定，未计蒙气差与日面半径，故"日入"比历书视日落早约 5–8 分钟、时刻量化到 ±5 分钟；
   亮星表未计自行（百年尺度 <0.1°）。以上对肉眼观星与星图标注足够，不适用于望远镜指向。

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