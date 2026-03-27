# French Vocabulary Flashcard App / Application de mémorisation du vocabulaire français / 法语词汇记忆应用

A lightweight study app that combines FSRS flashcards, a reading workspace, and AI-assisted card creation.

Une application légère qui réunit des flashcards avec FSRS, un espace de lecture, et la création assistée de cartes par IA.

一个轻量级学习应用，把 FSRS 闪卡复习、阅读工作台和 AI 辅助制卡整合在一起。

## English

### Overview

This project is a personal French-learning workspace built around three connected flows:

- review vocabulary with FSRS-based flashcards
- read and annotate imported articles in the Reader MVP
- create new cards from text or images with optional Gemini support

The current version uses a Flask backend, SQLite persistence, and a static HTML/CSS/JavaScript frontend.

### Main Features

- Flashcard review page with due-card queue, rating actions, review summary, and focus timer
- Reader MVP with article import, editing, highlighting, vocabulary inbox, and article storage
- Upload page for creating cards from typed expressions or uploaded images
- SQLite-based storage for cards, reviews, articles, highlights, and reader data
- Import and export workflow for Excel and JSON snapshots
- Optional Gemini integration for AI-generated vocabulary cards

### Tech Stack

- Backend: Flask, Flask-CORS, SQLite, pandas
- Frontend: HTML, CSS, vanilla JavaScript
- Scheduling: FSRS via npm dependency
- Optional AI: Google Gemini

### Project Structure

```text
app.py                  Flask entry point and API routes
database_store.py       SQLite schema and data access layer
flashcard.html          Main flashcard review page
reader.html             Reader MVP page
upload.html             Card creation page
script.js               Main flashcard frontend logic
upload.js               Upload and manual card creation logic
scripts/                Data import and migration utilities
docs/                   Product and technical planning notes
data_update_docs/       Database migration notes
up_date_dairy_docs/     Development logs
```

### Quick Start

1. Clone the repository.
2. Create a Python virtual environment.
3. Install Python dependencies with `pip install -r requirements.txt`.
4. Install frontend dependencies with `npm install`.
5. Copy `.env.example` to `.env`.
6. Run `python app.py`.
7. Open:

- `http://127.0.0.1:5000/flashcards`
- `http://127.0.0.1:5000/reader`
- `http://127.0.0.1:5000/upload`

### Environment Variables

Example values are provided in `.env.example`.

- `GEMINI_API_KEY`: optional, required only for AI card generation
- `DB_PATH`: main SQLite database path
- `READER_DB_PATH`: reader SQLite database path
- `EXCEL_FILE_PATH`: source Excel file path
- `DEBUG`: Flask debug mode
- `PORT`: local server port

### Notes

- The app remains usable without `GEMINI_API_KEY`; only AI-assisted card creation is disabled.
- SQLite database files, export files, caches, and local backups are intentionally excluded from the public Git snapshot.
- `github_share/` is a clean upload snapshot prepared for publishing and is not meant to be committed inside the working directory.

## Français

### Aperçu

Ce projet est un espace de travail personnel pour l'apprentissage du français, organisé autour de trois flux connectés :

- réviser le vocabulaire avec des flashcards basées sur FSRS
- lire et annoter des articles importés dans le Reader MVP
- créer de nouvelles cartes à partir de texte ou d'images avec une assistance Gemini en option

La version actuelle repose sur un backend Flask, une persistance SQLite, et une interface statique en HTML/CSS/JavaScript.

### Fonctionnalités principales

- Page de révision avec file de cartes à revoir, boutons d'évaluation, résumé des révisions et minuteur de concentration
- Reader MVP avec import d'articles, édition, surlignage, boîte de réception de vocabulaire et stockage des articles
- Page d'ajout de cartes à partir d'expressions saisies ou d'images téléversées
- Stockage SQLite pour les cartes, les révisions, les articles, les surlignages et les données du lecteur
- Flux d'import/export pour Excel et les instantanés JSON
- Intégration Gemini facultative pour générer des cartes de vocabulaire

### Pile technique

- Backend : Flask, Flask-CORS, SQLite, pandas
- Frontend : HTML, CSS, JavaScript natif
- Ordonnancement : FSRS via dépendance npm
- IA optionnelle : Google Gemini

### Démarrage rapide

1. Clonez le dépôt.
2. Créez un environnement virtuel Python.
3. Installez les dépendances Python avec `pip install -r requirements.txt`.
4. Installez les dépendances frontend avec `npm install`.
5. Copiez `.env.example` vers `.env`.
6. Lancez `python app.py`.
7. Ouvrez :

- `http://127.0.0.1:5000/flashcards`
- `http://127.0.0.1:5000/reader`
- `http://127.0.0.1:5000/upload`

### Variables d'environnement

- `GEMINI_API_KEY` : facultative, nécessaire uniquement pour la génération IA
- `DB_PATH` : chemin de la base SQLite principale
- `READER_DB_PATH` : chemin de la base SQLite du lecteur
- `EXCEL_FILE_PATH` : chemin du fichier Excel source
- `DEBUG` : mode debug Flask
- `PORT` : port local

### Remarques

- L'application reste utilisable sans `GEMINI_API_KEY` ; seule la création assistée par IA est désactivée.
- Les bases SQLite, les exports, les caches et les sauvegardes locales ne sont pas inclus dans la version publique.
- `github_share/` correspond à un instantané propre préparé pour la publication.

## 中文

### 项目简介

这个项目是一个面向法语学习的个人工作台，目前围绕三条主流程构建：

- 用基于 FSRS 的闪卡系统复习词汇
- 在 Reader MVP 中导入、清洗、阅读并标注文章
- 通过文本或图片生成新卡片，并可选接入 Gemini 做 AI 辅助制卡

当前版本采用 Flask 作为后端，SQLite 作为持久化存储，前端为静态 HTML、CSS 和原生 JavaScript。

### 主要功能

- 闪卡复习主页，支持到期卡片队列、评分按钮、复习统计和专注计时器
- Reader MVP，支持文章导入、编辑、高亮、词汇收集箱和文章持久化
- 上传页，支持手动输入表达或上传图片生成卡片
- 使用 SQLite 存储卡片、复习记录、文章、高亮和阅读数据
- 支持 Excel 导入与 JSON、Excel 导出
- 可选接入 Gemini，用于 AI 辅助生成词汇卡片

### 技术栈

- 后端：Flask、Flask-CORS、SQLite、pandas
- 前端：HTML、CSS、原生 JavaScript
- 记忆调度：FSRS npm 依赖
- 可选 AI：Google Gemini

### 快速开始

1. 克隆仓库。
2. 创建 Python 虚拟环境。
3. 运行 `pip install -r requirements.txt` 安装 Python 依赖。
4. 运行 `npm install` 安装前端依赖。
5. 将 `.env.example` 复制为 `.env`。
6. 运行 `python app.py`。
7. 在浏览器中打开：

- `http://127.0.0.1:5000/flashcards`
- `http://127.0.0.1:5000/reader`
- `http://127.0.0.1:5000/upload`

### 环境变量

- `GEMINI_API_KEY`：可选，仅在启用 AI 制卡时需要
- `DB_PATH`：主 SQLite 数据库路径
- `READER_DB_PATH`：阅读器 SQLite 数据库路径
- `EXCEL_FILE_PATH`：源 Excel 文件路径
- `DEBUG`：Flask 调试模式
- `PORT`：本地服务端口

### 说明

- 没有配置 `GEMINI_API_KEY` 时，应用仍可运行，只是 AI 制卡接口会被关闭。
- SQLite 数据库、导出文件、缓存目录和本地备份不会进入公开仓库。
- `github_share/` 是为了发布而整理出的干净快照目录，不建议作为当前工作目录的一部分再提交回本地项目。
