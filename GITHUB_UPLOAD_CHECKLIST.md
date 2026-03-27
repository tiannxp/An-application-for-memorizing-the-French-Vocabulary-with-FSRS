# GitHub Upload Checklist

这个目录是给 GitHub 准备的干净版本，目标是：

- 可以运行
- 可以继续开发
- 不包含本地缓存、数据库产物、备份和临时文件

## 建议上传的内容

- `app.py`
- `database_store.py`
- `flashcard.html`
- `reader.html`
- `upload.html`
- `script.js`
- `upload.js`
- `upload.css`
- `package.json`
- `package-lock.json`
- `requirements.txt`
- `.env.example`
- `.gitignore`
- `README.md`
- `french_app_data.xlsx`
- `scripts/`
- `docs/`
- `data_update_docs/`
- `up_date_dairy_docs/`

## 不要上传的内容

- `.env`
- `node_modules/`
- `__pycache__/`
- `uploaded_images/` 中的实际图片
- `database/*.sqlite3`
- `database/exports/` 中的导出文件
- `database/archive_*.json`
- `*.bak`
- `备份/`
- `functions_test/`

## 上传前最后检查

- 确认 `.env.example` 中没有真实密钥
- 确认 `.env` 没有被带上 GitHub
- 确认 `node_modules/` 没有上传
- 确认 SQLite 数据库没有上传
- 确认仓库首页说明与当前项目一致

## 其他说明

- 项目运行所需 Python 依赖写在 `requirements.txt`
- 前端依赖由 `package.json` 和 `package-lock.json` 管理
- 数据库会在运行时按配置自动创建
