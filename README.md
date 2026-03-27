# AI-Powered French Flashcard App

![license](https://img.shields.io/badge/license-MIT-428f7e?style=flat-square) ![python](https://img.shields.io/badge/python-3.8+-3776ab?style=flat-square) ![flask](https://img.shields.io/badge/flask-latest-000000?style=flat-square) ![javascript](https://img.shields.io/badge/javascript-ES6+-f7df1e?style=flat-square) ![algorithm](https://img.shields.io/badge/algorithm-FSRS-f48041?style=flat-square)

This is a full-stack French flashcard learning application. It integrates the automated card creation power of Google's **Gemini multimodal model** with the advanced **FSRS (Free Spaced Repetition Scheduler)** algorithm, providing French learners with an end-to-end solution from vocabulary capture to long-term memorization.

---

## ✨ Core Features

🧠 **1. AI-Powered Automated Card Creation (Based on Gemini 2.5 Flash)**
- **Multimodal Input**: Supports uploading textbook screenshots or directly inputting text.
- **Smart Extraction**: Automatically performs OCR to extract key vocabulary, highlighted expressions, or contextual phrases from images.
- **Comprehensive Analysis**: Auto-generates pure French definitions, synonyms, standard Chinese translations, and authentic bilingual (French-Chinese) example sentences (EX1, EX2).

📈 **2. Advanced FSRS Spaced Repetition Engine**
- **Native Module Power**: Utilizes the native `fsrs.js` (WebAssembly) module for more efficient and precise review scheduling than traditional Anki (SM-2).
- **Dynamic Rating System**: Supports four feedback options—Again, Hard, Good, and Easy—to dynamically adjust the review schedule.

---

## 💡 Tech Stack & UX Highlights

Beyond its core features, this project also pursues excellence in technical implementation and user experience:

**🔧 Technical Highlights**
- **Decoupled Architecture**: Uses Flask (Python) for the backend API, separated from the modern frontend (or vanilla JS), ensuring a clean structure that is easy to maintain and extend.
- **WebAssembly Performance**: The core FSRS algorithm runs in a Wasm environment, ensuring that complex calculations achieve near-native performance directly in the browser.
- **Modular Design**: The project follows modular principles, making it easy to swap out the AI model or scheduling algorithm with low coupling.

**🎮 User Experience (UX) Highlights**
- **Immersive Reading Mode**: Activate the word capture and card creation feature with a single click while reading, enabling a seamless "read-and-remember" workflow without breaking your focus.
- **Interactive Learning**: Core actions like flipping cards and selecting feedback feature smooth animations and instant responses to enhance engagement.
- **Gamified Motivation**: Includes a built-in focus timer and learning statistics to gamify the learning process, helping users stay motivated through positive reinforcement.

---

## ⚙️ Quick Setup & API Configuration Guide

⚠️ **Important Notice**: The AI card creation feature of this project relies on a third-party API. For security, the code only contains a placeholder. **You must configure your personal Google Gemini API Key after cloning the repository to use the app.**

1.  **Clone the project locally**

    ```bash
    git clone https://github.com/tiannxp/An-application-for-memorizing-the-French-Vocabulary-with-FSRS.git
    ```

2.  **Configure the API Key**
    - Find the global configuration file in the project directory (e.g., `.env`, `config.py`, or the main source file).
    - Search for `YOUR_API_KEY_HERE` or a similar API configuration variable.
    - Replace it with your own real API key.
    - **Security Warning**: Never push code containing your real API key to a public GitHub repository!

3.  **Install Dependencies and Run**
    - **Backend (Flask):**
      ```bash
      # Navigate to the backend directory
      cd backend
      # Install dependencies
      pip install -r requirements.txt
      # Start the server
      python app.py
      ```
    - **Frontend:**
      - If it's a static site, simply open `index.html` in your browser.
      - If it uses Node.js, run `npm install` and `npm start`.

---

## 🚀 Roadmap

This project is under active development, and suggestions are welcome! The following features are planned for future releases:
- [ ] **Multi-device Sync**: Support syncing learning progress and decks across devices via a cloud service.
- [ ] **Deck Import/Export**: Support for importing and exporting decks in various formats like Anki and CSV.
- [ ] **Visualized Learning Statistics**: Add more comprehensive charts, such as forgetting curves and daily review counts, to make progress visible at a glance.
- [ ] **Offline Mode**: Allow users to review flashcards without an internet connection.

---

## 📸 App Preview

> 👇 **Please add your app screenshots here**
> *<img width="2848" height="1666" alt="cardA" src="https://github.com/user-attachments/assets/a4fde32f-33e5-474d-911b-ce290e6cea14" />*
> *<img width="2840" height="1638" alt="cardB" src="https://github.com/user-attachments/assets/13bd56cd-a10a-4496-a748-0e403d65a44e" />*
> *<img width="2828" height="1654" alt="cardC" src="https://github.com/user-attachments/assets/862338fd-e70e-426b-8a29-0bd13cad9d85" />*
> *<img width="2844" height="1662" alt="cardD" src="https://github.com/user-attachments/assets/bf011958-af6b-413e-beb8-b6d3e8d9db49" />*

---

# 🇫🇷 AI-Powered French Flashcard App (Application de Flashcards de Français Propulsée par l'IA)

![license](https://img.shields.io/badge/license-MIT-428f7e?style=flat-square) ![python](https://img.shields.io/badge/python-3.8+-3776ab?style=flat-square) ![flask](https://img.shields.io/badge/flask-latest-000000?style=flat-square) ![javascript](https://img.shields.io/badge/javascript-ES6+-f7df1e?style=flat-square) ![algorithm](https://img.shields.io/badge/algorithm-FSRS-f48041?style=flat-square)

Ceci est une application full-stack d'apprentissage de flashcards de français. Elle combine la puissance de création automatisée de cartes du **modèle multimodal Gemini** de Google avec l'algorithme avancé de **répétition espacée FSRS (Free Spaced Repetition Scheduler)**. L'objectif est d'offrir aux apprenants du français une solution complète, de la capture de vocabulaire à la mémorisation à long terme.

---

## ✨ Caractéristiques Principales

🧠 **1. Création de Cartes Automatisée par IA (Basée sur Gemini 2.5 Flash)**
- **Entrée Multimodale** : Prise en charge de l'upload de captures d'écran de manuels ou de la saisie directe de texte.
- **Extraction Intelligente** : OCR automatique pour extraire les mots-clés, les expressions surlignées ou les phrases contextuelles des images.
- **Analyse Complète** : Génération automatique de définitions en français pur, de synonymes, de traductions en chinois simplifié, accompagnés de phrases d'exemple authentiques et bilingues (français-chinois) (EX1, EX2).

📈 **2. Moteur de Répétition Espacée FSRS Avancé**
- **Propulsé par un Module Natif** : Utilise le module natif `fsrs.js` (WebAssembly) pour un ordonnancement des révisions plus efficace et précis que celui d'Anki traditionnel (SM-2).
- **Système d'Évaluation Dynamique** : Prend en charge quatre niveaux de réponse — À revoir (Again), Difficile (Hard), Bien (Good) et Facile (Easy) — pour ajuster dynamiquement le calendrier de révision.

---

## 💡 Points Forts Techniques et Expérience Utilisateur (UX)

Au-delà de ses fonctionnalités de base, ce projet vise l'excellence en matière de mise en œuvre technique et d'expérience utilisateur :

**🔧 Points Forts Techniques (Technical Highlights)**
- **Architecture Découplée** : Utilise Flask (Python) pour l'API backend, séparé du frontend moderne (ou JS natif), garantissant une structure claire, facile à maintenir et à étendre.
- **Performance WebAssembly** : L'algorithme FSRS de base s'exécute dans un environnement Wasm, assurant que les calculs complexes atteignent des performances quasi-natives directement dans le navigateur.
- **Conception Modulaire** : Le projet suit des principes modulaires, ce qui facilite le remplacement du modèle d'IA ou de l'algorithme de répétition avec un faible couplage.

**🎮 Points Forts de l'Expérience Utilisateur (UX Highlights)**
- **Mode Lecture Immersif** : Activez la fonctionnalité de capture de mots et de création de cartes en un clic pendant la lecture, permettant un flux de travail "lire et mémoriser" sans interrompre votre concentration.
- **Apprentissage Interactif** : Les actions principales comme le retournement des cartes et la sélection des réponses sont dotées d'animations fluides et d'un retour instantané pour améliorer l'engagement.
- **Motivation par la Ludification** : Intègre un minuteur de concentration et des statistiques d'apprentissage pour ludifier les tâches, aidant les utilisateurs à rester motivés grâce à un renforcement positif.

---

## ⚙️ Guide d'Installation Rapide et de Configuration API

⚠️ **Avis Important** : La fonctionnalité de création de cartes par IA de ce projet dépend d'une API tierce. Pour des raisons de sécurité, le code ne contient qu'un placeholder. **Vous devez configurer votre clé API personnelle de Google Gemini après avoir cloné le dépôt pour utiliser l'application.**

1.  **Cloner le projet en local**

    ```bash
    git clone https://github.com/tiannxp/An-application-for-memorizing-the-French-Vocabulary-with-FSRS.git
    ```

2.  **Configurer la Clé API**
    - Trouvez le fichier de configuration global dans le répertoire du projet (par ex. `.env`, `config.py`, ou le fichier source principal).
    - Recherchez `YOUR_API_KEY_HERE` ou une variable de configuration similaire.
    - Remplacez-la par votre propre clé API.
    - **Avertissement de Sécurité** : Ne publiez jamais de code contenant votre véritable clé API sur un dépôt GitHub public !

3.  **Installer les Dépendances et Lancer l'Application**
    - **Backend (Flask) :**
      ```bash
      # Accéder au répertoire du backend
      cd backend
      # Installer les dépendances
      pip install -r requirements.txt
      # Démarrer le serveur
      python app.py
      ```
    - **Frontend :**
      - S'il s'agit d'un site statique, ouvrez simplement `index.html` dans votre navigateur.
      - S'il utilise Node.js, exécutez `npm install` puis `npm start`.

---

## 🚀 Feuille de Route (Roadmap)

Ce projet est en développement actif et les suggestions sont les bienvenues ! Les fonctionnalités suivantes sont prévues pour les prochaines versions :
- [ ] **Synchronisation Multi-appareils** : Prise en charge de la synchronisation de la progression et des paquets de cartes entre différents appareils via un service cloud.
- [ ] **Import/Export de Paquets** : Prise en charge de l'import et de l'export de paquets dans divers formats comme Anki et CSV.
- [ ] **Visualisation des Statistiques d'Apprentissage** : Ajout de graphiques plus complets (courbes d'oubli, volume de révision quotidien, etc.) pour rendre les progrès visibles.
- [ ] **Mode Hors Ligne** : Permettre la révision des flashcards sans connexion Internet.

---

## 📸 Aperçu de l'Application

> 👇 **Veuillez ajouter vos captures d'écran de l'application ici**
> *<img width="2848" height="1666" alt="cardA" src="https://github.com/user-attachments/assets/a4fde32f-33e5-474d-911b-ce290e6cea14" />*
> *<img width="2840" height="1638" alt="cardB" src="https://github.com/user-attachments/assets/13bd56cd-a10a-4496-a748-0e403d65a44e" />*
> *<img width="2828" height="1654" alt="cardC" src="https://github.com/user-attachments/assets/862338fd-e70e-426b-8a29-0bd13cad9d85" />*
> *<img width="2844" height="1662" alt="cardD" src="https://github.com/user-attachments/assets/bf011958-af6b-413e-beb8-b6d3e8d9db49" />*

---


# 🇨🇳 AI-Powered French Flashcard App (AI 驱动的法语词卡学习系统)

![license](https://img.shields.io/badge/license-MIT-428f7e?style=flat-square) ![python](https://img.shields.io/badge/python-3.8+-3776ab?style=flat-square) ![flask](https://img.shields.io/badge/flask-latest-000000?style=flat-square) ![javascript](https://img.shields.io/badge/javascript-ES6+-f7df1e?style=flat-square) ![algorithm](https://img.shields.io/badge/algorithm-FSRS-f48041?style=flat-square)

这是一个全栈法语词卡学习应用。它结合了 Google **Gemini 多模态大模型**的自动化制卡能力，以及先进的 **FSRS (Free Spaced Repetition Scheduler)** 间隔重复算法，旨在为法语学习者提供从“生词捕获”到“永久记忆”的一站式解决方案。

---

## ✨ 核心特性

🧠 **1. AI 智能自动化制卡 (基于 Gemini 2.5 Flash)**
- **多模态输入**：支持上传法语教材截图或直接输入文本。
- **智能提取**：自动 OCR 并提取图片中的重点词汇、高亮表达或语境短语。
- **自动全维度解析**：自动生成纯法语释义、近义词、纯正简体中文翻译，并配上包含中法对照的真实语境例句 (EX1, EX2)。

📈 **2. 先进的 FSRS 记忆算法引擎**
- **原生模块驱动**：采用原生的 `fsrs.js` (WebAssembly) 模块，提供比传统 Anki (SM-2) 更高效、更精准的记忆调度。
- **动态评分系统**：支持 重来(Again)、困难(Hard)、良好(Good)、简单(Easy) 四种反馈，动态调整复习计划。

---

## 💡 技术栈与交互亮点

除了核心功能，本项目在技术实现与用户体验上也追求卓越：

**🔧 技术亮点 (Technical Highlights)**
- **前后端分离**：采用 Flask (Python) 作为后端 API，与现代前端框架（或原生 JS）分离，结构清晰，易于维护与扩展。
- **WebAssembly 性能**：核心记忆算法 `fsrs.js` 运行在 Wasm 环境，保证了复杂的计算在浏览器端也能拥有接近本机的执行效率。
- **模块化设计**：项目代码遵循模块化原则，无论是更换 AI 模型还是记忆算法，耦合度都较低。

**🎮 操作亮点 (User Experience)**
- **沉浸式阅读模式**：在阅读文章时可一键唤醒取词/制卡功能，实现“即读即记”，不打断学习流程。
- **交互式学习**：卡片翻转、反馈选择等核心操作均有流畅的动画与即时反馈，提升学习过程的参与感。
- **游戏化激励**：内置专注计时器与学习统计，将学习任务游戏化，通过正向激励帮助用户保持学习动力。

---

## ⚙️ 快速设置与 API 配置指南

⚠️ **重要提醒**：本项目的 AI 制卡功能依赖第三方 API。为了保护账户安全，代码中仅包含占位符。**拉取代码后，您必须配置个人的 Google Gemini API Key 才能正常使用。**

1.  **克隆项目到本地**

    ```bash
    git clone https://github.com/tiannxp/An-application-for-memorizing-the-French-Vocabulary-with-FSRS.git
    ```

2.  **配置 API 密钥**
    - 在项目文件夹中找到全局配置文件 (例如 `.env`, `config.py` 或主代码文件)。
    - 搜索 `YOUR_API_KEY_HERE` 或相关的 API 配置项。
    - 将其替换为您自己申请的真实 API 密钥。
    - **安全警告**：请勿将填入真实密钥的代码再次 Push 到任何公开的 GitHub 仓库中！

3.  **安装依赖并运行**
    - **后端 (Flask):**
      ```bash
      # 进入后端目录
      cd backend
      # 安装依赖
      pip install -r requirements.txt
      # 启动服务
      python app.py
      ```
    - **前端:**
      - 如果是纯静态文件，直接在浏览器中打开 `index.html`。
      - 如果使用 Node.js，请运行 `npm install` 和 `npm start`。

---

## 🚀 未来蓝图 (Roadmap)

本项目仍在积极迭代中，欢迎提出建议！后续计划开发以下功能：
- [ ] **多设备同步**：支持通过云服务在不同设备间同步学习进度与词库。
- [ ] **词库导入/导出**：支持 Anki、CSV 等多种格式的词库导入与导出。
- [ ] **学习统计可视化**：加入更丰富的图表，如遗忘曲线、每日学习量等，让进步一目了然。
- [ ] **离线模式**：允许在没有网络的情况下进行单词复习。

---

## 📸 界面预览

> 👇 **请在此处添加您的应用截图**
> *<img width="2848" height="1666" alt="cardA" src="https://github.com/user-attachments/assets/a4fde32f-33e5-474d-911b-ce290e6cea14" />*
> *<img width="2840" height="1638" alt="cardB" src="https://github.com/user-attachments/assets/13bd56cd-a10a-4496-a748-0e403d65a44e" />*
> *<img width="2828" height="1654" alt="cardC" src="https://github.com/user-attachments/assets/862338fd-e70e-426b-8a29-0bd13cad9d85" />*
> *<img width="2844" height="1662" alt="cardD" src="https://github.com/user-attachments/assets/bf011958-af6b-413e-beb8-b6d3e8d9db49" />
*
