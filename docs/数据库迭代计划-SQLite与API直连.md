# 数据库迭代计划：从 Excel 到 SQLite，再到 API 直连（含阅读器/手写/写作复用）

记录日期：2026-03-21（Europe/Paris）

## 背景与目标

当前数据链路（现状）是：

- AI/后端写入 Excel（`french_app_data.xlsx`）
- 触发脚本生成 `database_structured.json` -> `data_frontend.json`
- 前端从 `data_frontend.json` 读取内容，复习进度落在 `localStorage`
- 手动点击“同步”把 `localStorage` 整库 POST 到后端，再回写 Excel

这条链路能跑，但问题非常明确：

- “写入/读取”来源太多（Excel、JSON、localStorage），容易出现数据漂移
- 构建链条太长（Python 脚本 + Node 脚本），任何一步失败都导致断链
- 与后续功能耦合差：阅读器（粘贴导入文章 + 高亮/笔记 + 词袋 + 手写 ink）会引入更多实体，Excel 不适合作为扩展底座
- 复习进度以 localStorage 为准，会阻碍跨设备（Surface/iPad）与写作模块复用

本计划的目标：

1. 用 SQLite 替换 Excel，成为唯一事实来源（SSOT）
2. 逐步把前端数据源从“静态 JSON + localStorage 整库同步”改为“后端 API 直连”
3. 把阅读器（文章/高亮/笔记/词袋/手写 ink）纳入同一套数据库模型，为写作模块复用预留接口
4. 全过程可回滚，尽量不打断现有使用（迁移期允许 Excel 导出与兼容）

## 总体策略（最小风险）

分阶段“双写/兼容”迁移：

- 阶段 0：引入配置（`.env`）与数据库文件路径，但不改行为
- 阶段 1：新增 SQLite（只读导入）+ 导入脚本 + 校验工具
- 阶段 2：后端写入切到 SQLite（Excel 退为导出/备份）；新增阅读器相关表与 API
- 阶段 3：前端改为 API 直连，移除 `data_frontend.json` 构建链路与“整库同步”依赖
- 阶段 4：引入 review_logs / 统计 / 写作复用 API / 手写 ink（按需分批落地）

每阶段都保持“可运行、可验证、可回退”。

## 阶段里程碑

### 阶段 0：配置集中化（低成本，高收益）

- 新增 `.env`：
  - `GEMINI_API_KEY=...`
  - `DB_PATH=./french_vocab.db`
  - `DEBUG=true`
  - `CORS_ORIGINS=http://localhost:xxxx`（若需要）
- 后端读取配置，不再把路径/API key 写死在源码里
- `.gitignore` 加入 `.env` 与本地数据库文件

验收：

- 不改任何功能，现有 Excel 流程可用

### 阶段 1：SQLite 只读导入（并行，不影响现有）

新增：

- `migrations/` 或 `scripts/` 下的导入脚本：
  - 从 `french_app_data.xlsx` 导入到 SQLite
  - 导入时做字段清洗与类型规范
- 校验脚本：
  - 统计数量一致性（notes/cards/tags/note_tags）
  - 抽样比对关键字段（expression/definition/tags/EX1/EX2）

验收：

- SQLite 中的数据可完整覆盖 Excel 内容
- 不改后端写入路径，仍写 Excel

### 阶段 2：后端写入切换到 SQLite（Excel 降级为备份/导出）+ 阅读器数据入库

调整后端：

- AI 制卡、文本建卡、图片建卡：写入 SQLite
- `sync_progress`：把前端 FSRS 状态写入 SQLite（短期允许 batch 写入，长期改为每次 review 直接写）
- 新增阅读器相关 API 与表（先支持“复制粘贴导入”，后续再加 URL 抓取）：
  - `articles`（文章快照）
  - `highlights`（高亮/笔记）
  - `vocab_inbox`（词袋）
  - （可选）`ink_strokes`（手写 ink，建议作为单独阶段）
- 可选：保留“导出到 Excel”的按钮/接口作为备份（不再作为主存储）

验收：

- 不依赖 Excel 也能完成：新增卡、复习、同步进度
- 不依赖 Excel 也能完成：文章粘贴导入、创建高亮与笔记、把高亮入词袋
- Excel 仍可导出作为“冷备份/可视化检查”

回滚策略：

- 保留原 Excel 写入代码路径（用配置开关切回）

### 阶段 3：前端改为 API 直连（移除构建管道）

目标：

- 前端不再 `fetch('./data_frontend.json')`
- 改为：
  - `GET /api/cards/due`（到期复习 + 新卡配额）
  - `POST /api/cards/:id/review`（提交评分，返回新状态）
  - `GET /api/review/today`（今日回顾列表）
  - `GET /api/articles/:id` / `GET /api/articles/:id/highlights`（阅读器直连）
- 进度不再依赖 `localStorage` 整库同步
  - 可保留 `localStorage` 作为“离线缓存/临时队列”，但以服务端为准

验收：

- 删除或不再需要 `scripts/build_structured_json.py`、`scripts/prepare_frontend_data.js` 的运行链路
- 故障面显著减少：无 Node 构建依赖也可学习

### 阶段 4：为统计与阅读库扩展（可选）

引入：

- `review_logs`：每次评分/复习都落日志（做统计的基础）
- 写作复用接口：
  - 按文章/高亮/笔记/词条搜索
  - 写作侧可引用高亮内容并打开阅读器作为参考
- 手写 ink（Surface/iPad）：
  - `ink_strokes` 或等价结构，落库并可复现到文章快照上

说明：

- 阅读器（粘贴导入）建议在阶段 2 就把“文章/高亮/词袋”落库；手写 ink 可单独作为阶段 4 的增量。

## 表结构草案（SQLite）

> 目标：兼容现有字段，同时为扩展留口子。字段命名尽量稳定、可迁移。

### cards（闪卡内容 + 当前 FSRS 状态 + 来源关联）

- `id` INTEGER PRIMARY KEY
- `expression` TEXT NOT NULL
- `contexte` TEXT
- `type` TEXT
- `definition_fr` TEXT
- `synonymes` TEXT  (建议存 JSON 字符串，或单独表)
- `traduction_zh` TEXT
- `notes` TEXT
- `ex1` TEXT
- `ex2` TEXT
- `tags` TEXT  (短期可冗余；长期用 tags/note_tags 正规化)
- `audio_path` TEXT
- 来源关联（为阅读器/写作复用预留）：
  - `source_article_id` INTEGER NULL
  - `source_highlight_id` INTEGER NULL
- FSRS state（直接列）：
  - `due` TEXT (ISO8601)
  - `stability` REAL
  - `difficulty` REAL
  - `reps` INTEGER DEFAULT 0
  - `lapses` INTEGER DEFAULT 0
  - `last_review` TEXT (ISO8601)
  - `state` INTEGER
- `created_at` TEXT
- `updated_at` TEXT

索引建议：

- `idx_cards_due` on (`due`)
- `idx_cards_expression` on (`expression`)

备注：

- 若未来要支持“多词库/多 deck”，加 `deck_id`（TEXT/INTEGER）即可

### tags / card_tags（规范化标签）

- `tags(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL)`
- `card_tags(card_id INTEGER, tag_id INTEGER, PRIMARY KEY(card_id, tag_id))`

### review_logs（学习统计基础）

- `id` INTEGER PRIMARY KEY
- `card_id` INTEGER NOT NULL
- `reviewed_at` TEXT NOT NULL
- `rating` INTEGER NOT NULL  (Again/Hard/Good/Easy)
- `elapsed_ms` INTEGER  (可选)
- `prev_due` TEXT / `new_due` TEXT（可选）

### articles（阅读器：文章快照）

- `articles`
  - `id` INTEGER PRIMARY KEY
  - `title` TEXT
  - `source_url` TEXT
  - `source` TEXT  (建议枚举：`paste` / `url`)
  - `content_raw` TEXT  (用户粘贴的原始文本/HTML)
  - `content_html` TEXT (清洗后的阅读排版 HTML，作为渲染快照)
  - `version` INTEGER DEFAULT 1
  - `created_at` TEXT
  - `updated_at` TEXT

### highlights（阅读器：高亮 + 笔记 + 稳定定位）

- `highlights`
  - `id` INTEGER PRIMARY KEY
  - `article_id` INTEGER NOT NULL
  - `quote_text` TEXT NOT NULL
  - `color` TEXT
  - `note` TEXT
  - 位置锚点（对同一份 content_html 快照稳定即可）：
    - `start_path` TEXT
    - `start_offset` INTEGER
    - `end_path` TEXT
    - `end_offset` INTEGER
  - `created_at` TEXT

### vocab_inbox（从阅读高亮到制卡的缓冲层）

- `vocab_inbox`
  - `id` INTEGER PRIMARY KEY
  - `article_id` INTEGER
  - `highlight_id` INTEGER
  - `expression` TEXT NOT NULL
  - `context_sentence` TEXT
  - `user_note` TEXT
  - `status` TEXT  (`draft`/`confirmed`/`rejected`)
  - `created_at` TEXT

### ink_strokes（手写 ink，可选阶段）

- `ink_strokes`
  - `id` INTEGER PRIMARY KEY
  - `article_id` INTEGER NOT NULL
  - `article_version` INTEGER NOT NULL
  - `points_json` TEXT NOT NULL  (points array，建议含 x/y/t/pressure)
  - `color` TEXT
  - `width` REAL
  - `created_at` TEXT

备注：

- `highlight_cards` 表可以不单独存在：直接用 `cards.source_*` 也能完成反向跳转；如未来需要“一条高亮关联多张卡”，再引入 join 表。

## 迁移与兼容细节

### 1) 时间字段统一

- 内部统一用 ISO8601 字符串存储（SQLite 原生无 DATETIME 类型）
- Python/JS 侧在边界处 parse/format

### 2) synonymes 字段

当前前端/数据文件里出现过数组/字符串两种形态。建议：

- 数据库存储为 JSON 字符串（如 `["a","b"]`），API 返回时统一成数组

### 3) 与现有 FSRS 逻辑衔接

现状：

- 前端用 `fsrs.js` 计算新状态，并写回 `localStorage`
- 通过 `sync_progress` 批量回写 Excel

迁移策略：

- 阶段 2：仍允许前端计算 FSRS，把“新状态”写入 SQLite（batch ingestion 先跑通）
- 阶段 3：把“提交 rating -> 计算新状态”的职责迁到后端（可选，但建议最终做）
  - 优点：单一真相、便于日志与统计
  - 缺点：后端需要一套 FSRS 计算实现（JS 复用或 Python 实现）

折中方案：

- 后端记录 `review_logs`，但允许前端提交“rating + 新状态”，后端只做校验与落库

### 4) 迁移期如何减少“断链”

目标：尽快让系统从“文件生成”转为“API 真相”。

- 优先移除：`database_structured.json` -> `data_frontend.json` 这条构建链
- 优先替换：localStorage 整库同步 -> 以“每次 review 落库”为主（或至少支持 incremental batch）
- 保留导出：Excel/Markdown/JSON 作为备份与可携带格式，而不是主数据来源

## 验收清单（建议每阶段都跑）

- 数据一致性：导入前后卡片数、标签数一致
- 关键路径：新增卡 -> 出现在待复习队列 -> 评分 -> due 更新 -> 今日回顾可见
- 容错：DB 文件不存在时能自动初始化；Gemini key 缺失时给出清晰错误
- 备份：提供导出 JSON/导出 Excel 的能力（至少在迁移期）

## 推荐优先级（从高到低）

1. `.env` 与路径解耦（立即做）
2. SQLite 并行导入 + 校验（建立基础）
3. 后端写入切换到 SQLite（Excel 退为备份）+ 阅读器文章/高亮/词袋落库
4. 前端改 API 直连（移除构建链路与整库同步依赖）
5. review_logs / 写作复用 / 手写 ink（按需求拆分落地）
