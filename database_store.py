import json
import json
import os
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import pandas as pd
except Exception:
    pd = None


DEFAULT_USER_ID = "test01"
DEFAULT_DECK_ID = "t1"
DEFAULT_SOURCE_ID = "1"
DEFAULT_TEMPLATE_NAME = "Fr"
DEFAULT_DB_PATH = os.path.join("database", "app.sqlite3")
DEFAULT_READER_DB_PATH = os.path.join("database", "reader.sqlite3")
DEFAULT_EXCEL_PATH = "french_app_data.xlsx"


def load_env_file(env_path=".env"):
    path = Path(env_path)
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def local_day_start_utc_iso(days_back=0):
    local_now = datetime.now().astimezone()
    local_day_start = (local_now - timedelta(days=days_back)).replace(hour=0, minute=0, second=0, microsecond=0)
    utc_day_start = local_day_start.astimezone(timezone.utc)
    return utc_day_start.replace(tzinfo=None, microsecond=0).isoformat() + "Z"


def parse_iso(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue
    return None


def to_iso(value):
    dt = parse_iso(value)
    if dt is None:
        return None
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def ensure_parent_dir(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)


def get_db_path():
    return os.environ.get("DB_PATH") or DEFAULT_DB_PATH


def get_reader_db_path():
    return os.environ.get("READER_DB_PATH") or DEFAULT_READER_DB_PATH


def get_excel_path():
    return os.environ.get("EXCEL_FILE_PATH") or DEFAULT_EXCEL_PATH


def connect(db_path=None):
    target = db_path or get_db_path()
    ensure_parent_dir(target)
    conn = sqlite3.connect(target)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path=None):
    conn = connect(db_path)
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT 'test01',
                deck_id TEXT NOT NULL DEFAULT 't1',
                source_id TEXT NOT NULL DEFAULT '1',
                legacy_card_id TEXT,
                template_name TEXT NOT NULL DEFAULT 'Fr',
                expression TEXT NOT NULL,
                contexte TEXT,
                type TEXT,
                definition_fr TEXT,
                synonymes TEXT NOT NULL DEFAULT '[]',
                traduction_zh TEXT,
                notes TEXT,
                ex1 TEXT,
                ex2 TEXT,
                tags TEXT NOT NULL DEFAULT '',
                audio_path TEXT,
                source_article_id TEXT,
                source_highlight_id TEXT,
                due TEXT,
                stability REAL,
                difficulty REAL,
                reps INTEGER NOT NULL DEFAULT 0,
                lapses INTEGER NOT NULL DEFAULT 0,
                last_review TEXT,
                state INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
            CREATE INDEX IF NOT EXISTS idx_cards_expression ON cards(expression);
            CREATE INDEX IF NOT EXISTS idx_cards_last_review ON cards(last_review);

            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS card_tags (
                card_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (card_id, tag_id),
                FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE,
                FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS review_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL,
                rating INTEGER NOT NULL,
                reviewed_at TEXT NOT NULL,
                elapsed_ms INTEGER,
                prev_due TEXT,
                new_due TEXT,
                FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_review_logs_card_id ON review_logs(card_id);
            CREATE INDEX IF NOT EXISTS idx_review_logs_reviewed_at ON review_logs(reviewed_at);

            CREATE TABLE IF NOT EXISTS articles (
                id TEXT PRIMARY KEY,
                title TEXT,
                source_url TEXT,
                source TEXT NOT NULL DEFAULT 'paste',
                content_raw TEXT NOT NULL,
                content_html TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS highlights (
                id TEXT PRIMARY KEY,
                article_id TEXT NOT NULL,
                quote_text TEXT NOT NULL,
                start_path TEXT NOT NULL,
                start_offset INTEGER NOT NULL,
                end_path TEXT NOT NULL,
                end_offset INTEGER NOT NULL,
                color TEXT NOT NULL,
                note TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_highlights_article_id ON highlights(article_id);

            CREATE TABLE IF NOT EXISTS vocab_inbox (
                id TEXT PRIMARY KEY,
                article_id TEXT NOT NULL,
                highlight_id TEXT,
                expression TEXT NOT NULL,
                context_sentence TEXT,
                user_note TEXT,
                status TEXT NOT NULL DEFAULT 'draft',
                created_at TEXT NOT NULL,
                FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE,
                FOREIGN KEY(highlight_id) REFERENCES highlights(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_vocab_inbox_article_id ON vocab_inbox(article_id);

            CREATE TABLE IF NOT EXISTS ink_strokes (
                id TEXT PRIMARY KEY,
                article_id TEXT NOT NULL,
                article_version INTEGER NOT NULL,
                points_json TEXT NOT NULL,
                color TEXT,
                width REAL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
            );
            """
        )
        conn.commit()
    finally:
        conn.close()


def _json_loads_safe(value, fallback):
    if value in (None, ""):
        return fallback
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return fallback


def _normalize_synonymes(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        parsed = _json_loads_safe(value, None)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
        return [part.strip() for part in re.split(r"[;,]", value) if part.strip()]
    return []


def serialize_card_row(row):
    if row is None:
        return None
    card = dict(row)
    card["synonymes"] = _normalize_synonymes(card.get("synonymes"))
    card["fsrsState"] = {
        "due": card.get("due"),
        "stability": card.get("stability"),
        "difficulty": card.get("difficulty"),
        "reps": card.get("reps") or 0,
        "lapses": card.get("lapses") or 0,
        "last_review": card.get("last_review"),
        "state": card.get("state") if card.get("state") is not None else 0,
    }
    return card


def get_cards_due(limit=200, new_limit=60, db_path=None):
    conn = connect(db_path)
    try:
        now = now_iso()
        review_rows = conn.execute(
            """
            SELECT * FROM cards
            WHERE state != 0 AND due IS NOT NULL AND due <= ?
            ORDER BY due ASC, updated_at ASC
            LIMIT ?
            """,
            (now, int(limit)),
        ).fetchall()
        new_rows = conn.execute(
            """
            SELECT * FROM cards
            WHERE state = 0
            ORDER BY created_at ASC, id ASC
            LIMIT ?
            """,
            (int(new_limit),),
        ).fetchall()
        return {
            "cards": [serialize_card_row(row) for row in review_rows] + [serialize_card_row(row) for row in new_rows],
            "counts": {"review": len(review_rows), "new": len(new_rows)},
        }
    finally:
        conn.close()


def update_card_review(card_id, fsrs_state, rating, reviewed_at=None, elapsed_ms=None, db_path=None):
    conn = connect(db_path)
    try:
        row = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
        if row is None:
            return None
        reviewed_at_iso = to_iso(reviewed_at) or now_iso()
        due = to_iso(fsrs_state.get("due"))
        last_review = to_iso(fsrs_state.get("last_review")) or reviewed_at_iso
        prev_due = row["due"]
        conn.execute(
            """
            UPDATE cards
            SET due = ?, stability = ?, difficulty = ?, reps = ?, lapses = ?, last_review = ?, state = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                due,
                fsrs_state.get("stability"),
                fsrs_state.get("difficulty"),
                int(fsrs_state.get("reps") or 0),
                int(fsrs_state.get("lapses") or 0),
                last_review,
                int(fsrs_state.get("state") or 0),
                now_iso(),
                card_id,
            ),
        )
        conn.execute(
            """
            INSERT INTO review_logs (card_id, rating, reviewed_at, elapsed_ms, prev_due, new_due)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (card_id, int(rating), reviewed_at_iso, elapsed_ms, prev_due, due),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
        return serialize_card_row(updated)
    finally:
        conn.close()


def batch_sync_progress(progress_payload, db_path=None):
    conn = connect(db_path)
    updated = 0
    try:
        for item in progress_payload or []:
            card_id = item.get("id")
            fsrs_state = item.get("fsrsState") or {}
            if card_id is None or not fsrs_state:
                continue
            exists = conn.execute("SELECT id FROM cards WHERE id = ?", (card_id,)).fetchone()
            if not exists:
                continue
            conn.execute(
                """
                UPDATE cards
                SET due = ?, stability = ?, difficulty = ?, reps = ?, lapses = ?, last_review = ?, state = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    to_iso(fsrs_state.get("due")),
                    fsrs_state.get("stability"),
                    fsrs_state.get("difficulty"),
                    int(fsrs_state.get("reps") or 0),
                    int(fsrs_state.get("lapses") or 0),
                    to_iso(fsrs_state.get("last_review")),
                    int(fsrs_state.get("state") or 0),
                    now_iso(),
                    card_id,
                ),
            )
            updated += 1
        conn.commit()
        return updated
    finally:
        conn.close()


def get_review_today(db_path=None):
    conn = connect(db_path)
    try:
        start = local_day_start_utc_iso()
        rows = conn.execute(
            """
            SELECT cards.*, review_logs.rating, review_logs.reviewed_at, review_logs.elapsed_ms
            FROM review_logs
            JOIN cards ON cards.id = review_logs.card_id
            WHERE review_logs.reviewed_at >= ?
            ORDER BY review_logs.reviewed_at DESC
            """,
            (start,),
        ).fetchall()
        return [serialize_card_row(row) for row in rows]
    finally:
        conn.close()


def get_review_summary(days=7, db_path=None):
    total_days = max(1, int(days or 7))
    conn = connect(db_path)
    try:
        start = local_day_start_utc_iso(total_days - 1)
        rows = conn.execute(
            """
            SELECT
                date(reviewed_at, 'localtime') AS day,
                COUNT(*) AS review_count,
                COUNT(DISTINCT card_id) AS unique_cards,
                COALESCE(SUM(elapsed_ms), 0) AS elapsed_ms
            FROM review_logs
            WHERE reviewed_at >= ?
            GROUP BY date(reviewed_at, 'localtime')
            ORDER BY day ASC
            """,
            (start,),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def snapshot_json(db_path=None):
    conn = connect(db_path)
    try:
        tables = ["cards", "tags", "card_tags", "review_logs", "articles", "highlights", "vocab_inbox", "ink_strokes"]
        snapshot = {}
        for table in tables:
            rows = conn.execute(f"SELECT * FROM {table}").fetchall()
            records = [dict(row) for row in rows]
            if table == "cards":
                for record in records:
                    record["synonymes"] = _normalize_synonymes(record.get("synonymes"))
            snapshot[table] = records
        return snapshot
    finally:
        conn.close()


def export_excel(export_path, db_path=None):
    if pd is None:
        raise RuntimeError("pandas is required to export Excel files")

    snapshot = snapshot_json(db_path)
    note_tags = {}
    for item in snapshot["card_tags"]:
        note_tags.setdefault(item["card_id"], []).append(item["tag_id"])

    notes_rows = []
    translations_rows = []
    cards_rows = []
    note_tags_rows = []
    for card in snapshot["cards"]:
        note_id = card["id"]
        fields_json = {
            "expression": card.get("expression") or "",
            "context_sentence": card.get("contexte") or "",
            "synonymes": _normalize_synonymes(card.get("synonymes")),
            "usage_notes": card.get("notes") or "",
            "EX1": card.get("ex1") or "",
            "EX2": card.get("ex2") or "",
            "audio_path": card.get("audio_path") or "",
        }
        notes_rows.append(
            {
                "note_id": note_id,
                "user_id": card.get("user_id") or DEFAULT_USER_ID,
                "deck_id": card.get("deck_id") or DEFAULT_DECK_ID,
                "source_id": card.get("source_id") or DEFAULT_SOURCE_ID,
                "note_type": card.get("type") or "expression",
                "fields (JSONB格式)": json.dumps(fields_json, ensure_ascii=False),
            }
        )
        translations_rows.append({"note_id": note_id, "language_code": "fr", "definition": card.get("definition_fr") or ""})
        translations_rows.append({"note_id": note_id, "language_code": "zh-CN", "definition": card.get("traduction_zh") or ""})
        cards_rows.append(
            {
                "card_id": card.get("legacy_card_id") or f"A{int(note_id):03d}",
                "note_id": note_id,
                "user_id": card.get("user_id") or DEFAULT_USER_ID,
                "template_name": card.get("template_name") or DEFAULT_TEMPLATE_NAME,
                "created_time": (parse_iso(card.get("created_at")) or datetime.utcnow()).strftime("%Y-%m-%d"),
                "due": card.get("due"),
                "stability": card.get("stability"),
                "difficulty": card.get("difficulty"),
                "reps": card.get("reps") or 0,
                "lapses": card.get("lapses") or 0,
                "last_review": card.get("last_review"),
                "state": card.get("state") if card.get("state") is not None else 0,
            }
        )
        for tag_id in note_tags.get(note_id, []):
            note_tags_rows.append({"note_id": note_id, "tag_id": tag_id})

    tags_rows = [{"tag_id": item["id"], "name": item["name"]} for item in snapshot["tags"]]
    ensure_parent_dir(export_path)
    with pd.ExcelWriter(export_path, engine="openpyxl") as writer:
        pd.DataFrame(notes_rows).to_excel(writer, sheet_name="notes", index=False)
        pd.DataFrame(translations_rows).to_excel(writer, sheet_name="note_translations", index=False)
        pd.DataFrame(cards_rows).to_excel(writer, sheet_name="cards", index=False)
        pd.DataFrame(tags_rows).to_excel(writer, sheet_name="tags", index=False)
        pd.DataFrame(note_tags_rows).to_excel(writer, sheet_name="note_tags", index=False)
    return export_path


def card_count(db_path=None):
    conn = connect(db_path)
    try:
        return conn.execute("SELECT COUNT(*) FROM cards").fetchone()[0]
    finally:
        conn.close()


def _clean_field_french(text):
    if not isinstance(text, str):
        return ""
    text = re.sub(r"[\(\uff08][^\)\uff09]*[\)\uff09]", "", text)
    text = re.sub(r"[\u4e00-\u9fff]", "", text)
    text = re.sub(r"[\\(\\)\uff08\uff09。，“”、；：]", "", text)
    text = re.sub(r"[,;]+", ",", text)
    return text.strip().strip(",").strip(";")


def _clean_field_chinese(text):
    if not isinstance(text, str):
        return ""
    text = re.sub(r"\([a-zA-Z\s;:'-]+\)", "", text)
    chinese_only = "".join(re.findall(r"[\u4e00-\u9fff；，。！？、（）《》“”‘’：]+", text))
    return re.sub(r"[\(\uff08][\s　]*[\)\uff09]", "", chinese_only).strip()


def _clean_mixed_example(text):
    if not isinstance(text, str):
        return ""
    match = re.match(r"^(.*?)\s*[\(\uff08](.*?)[\)\uff09]\.?$", text.strip())
    if not match:
        return text.strip()
    french_part = _clean_field_french(match.group(1))
    chinese_part = _clean_field_chinese(match.group(2))
    if french_part and chinese_part:
        return f"{french_part}. ({chinese_part})"
    return text.strip()


def _clean_tags(tags_str):
    if not isinstance(tags_str, str):
        return ""
    return ";".join(tag.strip() for tag in re.split(r"[;,]", tags_str) if tag.strip())


def _normalize_note_type(note_type):
    if not note_type:
        return "expression"
    lowered = str(note_type).lower()
    if "nom" in lowered:
        if "fém" in lowered or "femi" in lowered:
            return "nom féminin"
        return "nom masculin"
    if "adj" in lowered:
        return "adjectif"
    if "adv" in lowered:
        return "adverbe"
    if "verb" in lowered:
        return "verbe"
    if "préposition" in lowered or "preposition" in lowered:
        return "préposition"
    if "conjonction" in lowered or "conj" in lowered:
        return "conjonction"
    if "pronom" in lowered:
        return "pronom"
    if "déterminant" in lowered:
        return "déterminant"
    return "expression"


def _ensure_tag(conn, tag_name):
    existing = conn.execute("SELECT id FROM tags WHERE name = ?", (tag_name,)).fetchone()
    if existing:
        return existing["id"]
    cur = conn.execute("INSERT INTO tags (name) VALUES (?)", (tag_name,))
    return cur.lastrowid


def insert_ai_card(ai_data, source_article_id=None, source_highlight_id=None, db_path=None):
    expression = _clean_field_french(ai_data.get("expression", ""))
    if not expression:
        raise ValueError("expression is required")
    context_sentence = _clean_field_french(ai_data.get("context_sentence", ""))
    usage_notes = _clean_field_french(ai_data.get("usage_notes", ""))
    synonymes = _normalize_synonymes(ai_data.get("synonymes", ""))
    fr_def = _clean_field_french(ai_data.get("definition_fr", ""))
    zh_def = _clean_field_chinese(ai_data.get("traduction_zh", ""))
    tags = _clean_tags(ai_data.get("tags", ""))
    ex1 = _clean_mixed_example(ai_data.get("EX1", "")) if ai_data.get("EX1") else ""
    ex2 = _clean_mixed_example(ai_data.get("EX2", "")) if ai_data.get("EX2") else ""

    conn = connect(db_path)
    try:
        created_at = now_iso()
        cur = conn.execute(
            """
            INSERT INTO cards (
                user_id, deck_id, source_id, template_name, expression, contexte, type, definition_fr,
                synonymes, traduction_zh, notes, ex1, ex2, tags, audio_path,
                source_article_id, source_highlight_id, due, stability, difficulty, reps, lapses, last_review, state,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                DEFAULT_USER_ID,
                DEFAULT_DECK_ID,
                DEFAULT_SOURCE_ID,
                DEFAULT_TEMPLATE_NAME,
                expression,
                context_sentence,
                _normalize_note_type(ai_data.get("type")),
                fr_def,
                json.dumps(synonymes, ensure_ascii=False),
                zh_def,
                usage_notes,
                ex1,
                ex2,
                tags,
                "",
                source_article_id,
                source_highlight_id,
                None,
                None,
                None,
                0,
                0,
                None,
                0,
                created_at,
                created_at,
            ),
        )
        card_id = cur.lastrowid
        conn.execute("UPDATE cards SET legacy_card_id = ? WHERE id = ?", (f"A{int(card_id):03d}", card_id))
        for tag_name in [tag.strip() for tag in tags.split(";") if tag.strip()][:4]:
            tag_id = _ensure_tag(conn, tag_name)
            conn.execute("INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)", (card_id, tag_id))
        conn.commit()
        row = conn.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
        return serialize_card_row(row)
    finally:
        conn.close()


def import_excel_to_db(excel_path=None, db_path=None):
    if pd is None:
        raise RuntimeError("pandas is required to import Excel files")
    path = excel_path or get_excel_path()
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    init_db(db_path)
    conn = connect(db_path)
    try:
        sheets = pd.read_excel(path, sheet_name=None, dtype=object)
        notes_df = sheets.get("notes", pd.DataFrame())
        translations_df = sheets.get("note_translations", pd.DataFrame())
        cards_df = sheets.get("cards", pd.DataFrame())
        tags_df = sheets.get("tags", pd.DataFrame())
        note_tags_df = sheets.get("note_tags", pd.DataFrame())
        field_column = "fields (JSONB格式)" if "fields (JSONB格式)" in notes_df.columns else "fields"

        translations_map = {}
        for _, row in translations_df.iterrows():
            note_id = row.get("note_id")
            if note_id is None:
                continue
            translations_map.setdefault(int(note_id), {})[str(row.get("language_code") or "")] = str(row.get("definition") or "")

        cards_map = {}
        for _, row in cards_df.iterrows():
            note_id = row.get("note_id")
            if note_id is None:
                continue
            cards_map[int(note_id)] = row.to_dict()

        for _, row in tags_df.iterrows():
            tag_id = row.get("tag_id")
            name = str(row.get("name") or "").strip()
            if tag_id is None or not name:
                continue
            conn.execute("INSERT OR REPLACE INTO tags (id, name) VALUES (?, ?)", (int(tag_id), name))

        for _, row in notes_df.iterrows():
            note_id = row.get("note_id")
            if note_id is None:
                continue
            note_id = int(note_id)
            raw_fields = row.get(field_column) if field_column in row else None
            fields = _json_loads_safe(raw_fields, {}) if raw_fields is not None else {}
            if not isinstance(fields, dict):
                fields = {}
            card_sheet = cards_map.get(note_id, {})
            translations = translations_map.get(note_id, {})
            created_at = to_iso(card_sheet.get("created_time")) or now_iso()
            conn.execute(
                """
                INSERT OR REPLACE INTO cards (
                    id, user_id, deck_id, source_id, legacy_card_id, template_name, expression, contexte, type,
                    definition_fr, synonymes, traduction_zh, notes, ex1, ex2, tags, audio_path,
                    due, stability, difficulty, reps, lapses, last_review, state, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    note_id,
                    str(row.get("user_id") or DEFAULT_USER_ID),
                    str(row.get("deck_id") or DEFAULT_DECK_ID),
                    str(row.get("source_id") or DEFAULT_SOURCE_ID),
                    str(card_sheet.get("card_id") or f"A{note_id:03d}"),
                    str(card_sheet.get("template_name") or DEFAULT_TEMPLATE_NAME),
                    str(fields.get("expression") or ""),
                    str(fields.get("context_sentence") or ""),
                    str(row.get("note_type") or "expression"),
                    str(translations.get("fr") or ""),
                    json.dumps(_normalize_synonymes(fields.get("synonymes")), ensure_ascii=False),
                    str(translations.get("zh-CN") or ""),
                    str(fields.get("usage_notes") or ""),
                    str(fields.get("EX1") or ""),
                    str(fields.get("EX2") or ""),
                    "",
                    str(fields.get("audio_path") or ""),
                    to_iso(card_sheet.get("due")),
                    card_sheet.get("stability"),
                    card_sheet.get("difficulty"),
                    int(card_sheet.get("reps") or 0),
                    int(card_sheet.get("lapses") or 0),
                    to_iso(card_sheet.get("last_review")),
                    int(card_sheet.get("state") or 0),
                    created_at,
                    now_iso(),
                ),
            )

        conn.execute("DELETE FROM card_tags")
        for _, row in note_tags_df.iterrows():
            note_id = row.get("note_id")
            tag_id = row.get("tag_id")
            if note_id is None or tag_id is None:
                continue
            conn.execute("INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?, ?)", (int(note_id), int(tag_id)))

        rows = conn.execute(
            """
            SELECT cards.id, GROUP_CONCAT(tags.name, '; ') AS tag_names
            FROM cards
            LEFT JOIN card_tags ON card_tags.card_id = cards.id
            LEFT JOIN tags ON tags.id = card_tags.tag_id
            GROUP BY cards.id
            """
        ).fetchall()
        for item in rows:
            conn.execute("UPDATE cards SET tags = ? WHERE id = ?", (item["tag_names"] or "", item["id"]))

        conn.commit()
        return {"cards": len(notes_df.index), "tags": len(tags_df.index), "card_tags": len(note_tags_df.index)}
    finally:
        conn.close()


def import_reader_db(reader_db_path=None, db_path=None):
    legacy_path = reader_db_path or get_reader_db_path()
    if not os.path.exists(legacy_path):
        return {"articles": 0, "highlights": 0, "vocab_inbox": 0}
    init_db(db_path)
    legacy = sqlite3.connect(legacy_path)
    legacy.row_factory = sqlite3.Row
    conn = connect(db_path)
    try:
        articles = legacy.execute("SELECT * FROM articles").fetchall()
        highlights = legacy.execute("SELECT * FROM highlights").fetchall()
        inbox = legacy.execute("SELECT * FROM vocab_inbox").fetchall()

        for row in articles:
            payload = dict(row)
            conn.execute(
                """
                INSERT OR REPLACE INTO articles (id, title, source_url, source, content_raw, content_html, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["id"],
                    payload.get("title"),
                    payload.get("source_url"),
                    payload.get("source") or "paste",
                    payload["content_raw"],
                    payload["content_html"],
                    int(payload.get("version") or 1),
                    payload.get("created_at") or now_iso(),
                    payload.get("updated_at") or now_iso(),
                ),
            )

        for row in highlights:
            payload = dict(row)
            conn.execute(
                """
                INSERT OR REPLACE INTO highlights (
                    id, article_id, quote_text, start_path, start_offset, end_path, end_offset, color, note, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["id"],
                    payload["article_id"],
                    payload["quote_text"],
                    payload["start_path"],
                    int(payload["start_offset"]),
                    payload["end_path"],
                    int(payload["end_offset"]),
                    payload["color"],
                    payload.get("note"),
                    payload.get("created_at") or now_iso(),
                ),
            )

        for row in inbox:
            payload = dict(row)
            conn.execute(
                """
                INSERT OR REPLACE INTO vocab_inbox (
                    id, article_id, highlight_id, expression, context_sentence, user_note, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["id"],
                    payload["article_id"],
                    payload.get("highlight_id"),
                    payload["expression"],
                    payload.get("context_sentence"),
                    payload.get("user_note"),
                    payload.get("status") or "draft",
                    payload.get("created_at") or now_iso(),
                ),
            )

        conn.commit()
        return {"articles": len(articles), "highlights": len(highlights), "vocab_inbox": len(inbox)}
    finally:
        legacy.close()
        conn.close()


def validate_import(excel_path=None, reader_db_path=None, db_path=None):
    results = {"excel": {}, "reader": {}, "db": {}}
    if pd is not None and excel_path and os.path.exists(excel_path):
        sheets = pd.read_excel(excel_path, sheet_name=None, dtype=object)
        results["excel"]["notes"] = len(sheets.get("notes", pd.DataFrame()).index)
        results["excel"]["tags"] = len(sheets.get("tags", pd.DataFrame()).index)
        results["excel"]["note_tags"] = len(sheets.get("note_tags", pd.DataFrame()).index)
    if reader_db_path and os.path.exists(reader_db_path):
        legacy = sqlite3.connect(reader_db_path)
        try:
            for table in ("articles", "highlights", "vocab_inbox"):
                results["reader"][table] = legacy.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        finally:
            legacy.close()

    conn = connect(db_path)
    try:
        for table in ("cards", "tags", "card_tags", "articles", "highlights", "vocab_inbox"):
            results["db"][table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        sample_rows = conn.execute(
            """
            SELECT id, expression, definition_fr, tags, ex1, ex2, due, stability, difficulty, reps, lapses, last_review, state
            FROM cards
            ORDER BY id ASC
            LIMIT 5
            """
        ).fetchall()
        results["db"]["sample_cards"] = [dict(row) for row in sample_rows]
        return results
    finally:
        conn.close()
