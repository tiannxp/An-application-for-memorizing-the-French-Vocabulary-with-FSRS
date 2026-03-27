// prepare_frontend_data.js (v3.2 - 集成 last_review 字段同步)

const fs = require('fs/promises');
const path = require('path');
// const { spawn } = require('child_process'); // 不再需要

const structuredDbPath = './database_structured.json';
const frontendDataPath = './data_frontend.json';
// const pythonCleanerPath = './database/scriptsfordata/clean_json_data.py'; // 不再需要

// 已彻底移除 runDataCleaner 相关内容

async function buildAndClean() {
  console.log(`开始从 ${path.basename(structuredDbPath)} 构建前端数据...`);

  try {
    const dbContent = await fs.readFile(structuredDbPath, 'utf-8');
    const db = JSON.parse(dbContent);

    // 1. 提取 note_id -> last_review 映射
    const lastReviewMap = {};
    if (db.cards && Array.isArray(db.cards)) {
      for (const card of db.cards) {
        if (card.note_id && card.last_review) {
          lastReviewMap[card.note_id] = card.last_review;
        }
      }
    }

    const translationsMap = {};
    for (const t of db.note_translations) {
      if (!translationsMap[t.note_id]) {
        translationsMap[t.note_id] = {};
      }
      translationsMap[t.note_id][t.language_code] = String(t.definition || '').replace(/^[[["“\s]+|["”\s]+$/g, '');
    }

    const tagsNameMap = {};
    if (db.tags) {
      for (const tag of db.tags) {
        if (tag.tag_id != null && tag.name != null) {
            tagsNameMap[tag.tag_id] = String(tag.name).replace(/^[[["“\s]+|["”\s]+$/g, '');
        }
      }
    } else {
        console.warn("警告: 在数据库中未找到'tags'表。");
    }

    const noteToTagIdsMap = {};
    if (db.note_tags) {
      for (const nt of db.note_tags) {
        if (nt.note_id != null) {
          if (!noteToTagIdsMap[nt.note_id]) {
            noteToTagIdsMap[nt.note_id] = [];
          }
          noteToTagIdsMap[nt.note_id].push(nt.tag_id);
        }
      }
    } else {
        console.warn("警告: 在数据库中未找到'note_tags'表。");
    }

    const cardDataMap = {};
    for (const card of db.cards) {
      cardDataMap[card.note_id] = card;
    }

    const finalData = [];
    for (const note of db.notes) {
      const fieldsColumnName = 'fields (JSONB格式)';
      if (!note[fieldsColumnName]) {
        console.warn(`警告: note_id ${note.note_id} 缺少 '${fieldsColumnName}' 列，已跳过。`);
        continue;
      }
      const fields = JSON.parse(note[fieldsColumnName]);
      const translations = translationsMap[note.note_id] || {};
      const tagIds = noteToTagIdsMap[note.note_id] || [];
      const tagNames = tagIds
        .map(id => tagsNameMap[id])
        .filter(Boolean);
      const tagsString = tagNames.join('; ');
      const cardInfo = cardDataMap[note.note_id] || {};

      // 构建卡片对象，lapses 字段后插入 last_review
      const cardObject = {
        id: note.note_id,
        expression: fields.expression || '',
        contexte: fields.context_sentence || '',
        type: note.note_type || 'expression',
        definition_fr: translations['fr'] || '',
        synonymes: fields.synonymes || [],
        traduction_zh: translations['zh-CN'] || '',
        notes: fields.usage_notes || '',
        EX1: fields.EX1 || '',
        EX2: fields.EX2 || '',
        tags: tagsString,
        audio_path: fields.audio_path || '',
        due: cardInfo.due || null,
        stability: cardInfo.stability,
        difficulty: cardInfo.difficulty,
        reps: cardInfo.reps || 0,
        lapses: cardInfo.lapses || 0
      };
      // 插入 last_review 字段（如果有）
      if (lastReviewMap[note.note_id]) {
        cardObject.last_review = lastReviewMap[note.note_id];
      }
      finalData.push(cardObject);
    }

    await fs.writeFile(frontendDataPath, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log(`✅ 前端数据构建成功！共生成了 ${finalData.length} 张卡片。`);
    console.log('\n🚀 构建流程执行完毕！');

  } catch (error) {
    console.error('❌ 构建或清洗过程中发生严重错误:', error);
    process.exit(1);
  }
}

buildAndClean();