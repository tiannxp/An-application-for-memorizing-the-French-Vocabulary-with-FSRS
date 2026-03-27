import io
import json
import logging
import os
import traceback
import uuid

from flask import Flask, abort, jsonify, request, send_file
from flask_cors import CORS

try:
    import google.generativeai as genai
except Exception:
    genai = None

from database_store import (
    batch_sync_progress,
    card_count,
    connect,
    export_excel,
    get_cards_due,
    get_review_summary,
    get_db_path,
    get_excel_path,
    get_review_today,
    import_excel_to_db,
    import_reader_db,
    init_db,
    insert_ai_card,
    load_env_file,
    now_iso,
    snapshot_json,
    update_card_review,
)


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
load_env_file()
init_db()

app = Flask(__name__)
CORS(app)


FLASHCARD_PATH = os.path.join(os.getcwd(), "flashcard.html")
READER_PATH = os.path.join(os.getcwd(), "reader.html")
UPLOAD_PAGE_PATH = os.path.join(os.getcwd(), "upload.html")
SCRIPT_PATH = os.path.join(os.getcwd(), "script.js")
UPLOAD_SCRIPT_PATH = os.path.join(os.getcwd(), "upload.js")
UPLOAD_STYLE_PATH = os.path.join(os.getcwd(), "upload.css")
NODE_MODULES_PATH = os.path.join(os.getcwd(), "node_modules")
UPLOAD_DIR = os.path.join(os.getcwd(), "uploaded_images")
EXPORT_DIR = os.path.join(os.getcwd(), "database", "exports")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)


API_KEY = os.environ.get("GEMINI_API_KEY")
if API_KEY and genai is not None:
    genai.configure(api_key=API_KEY)
elif not API_KEY:
    logging.warning("GEMINI_API_KEY is not configured; AI card creation endpoints are disabled.")
else:
    logging.warning("google.generativeai is not installed; AI card creation endpoints are disabled.")


MULTIMODAL_PROMPT = """
You are a meticulous French vocabulary extraction assistant.
Return only valid JSON.

For every important French expression in the input, return an object:
[
  {
    "expression": "string",
    "definition_fr": "string",
    "traduction_zh": "string",
    "type": "string",
    "synonymes": "string",
    "tags": "string",
    "context_sentence": "string",
    "usage_notes": "string",
    "EX1": "French sentence. (Chinese translation.)",
    "EX2": "French sentence. (Chinese translation.)"
  }
]

Rules:
- `definition_fr`, `synonymes`, `context_sentence`, `usage_notes` must be French only.
- `traduction_zh` must be simplified Chinese only.
- Keep expressions unique.
"""


SINGLE_EXPRESSION_PROMPT = """
You are a meticulous French vocabulary entry assistant.
Return only a single valid JSON object.

Target expression: {target_expression}
Optional context: {full_document_context}

Output:
{
  "expression": "string",
  "definition_fr": "string",
  "traduction_zh": "string",
  "type": "string",
  "synonymes": "string",
  "tags": "string",
  "context_sentence": "string",
  "usage_notes": "string",
  "EX1": "French sentence. (Chinese translation.)",
  "EX2": "French sentence. (Chinese translation.)"
}

Rules:
- `tags` must contain 2-5 semicolon-separated tags.
- Chinese fields must not contain pinyin.
"""


def json_error(message, status=400):
    return jsonify({"status": "error", "message": message}), status


def row_to_dict(row):
    return dict(row) if row is not None else None


def require_ai():
    if not API_KEY:
        return json_error("GEMINI_API_KEY is not configured", 400)
    if genai is None:
        return json_error("google.generativeai is not installed", 400)
    return None


def call_gemini(prompt_template, target_expression="", context_document="", image_path=None):
    prompt = (
        prompt_template.replace("{target_expression}", target_expression)
        .replace("{full_document_context}", context_document)
    )
    model = genai.GenerativeModel("gemini-2.5-flash")
    generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
    if image_path:
        with open(image_path, "rb") as handle:
            image_bytes = handle.read()
        content = [{"mime_type": "image/jpeg", "data": image_bytes}, {"text": prompt}]
    else:
        content = prompt
    response = model.generate_content(content, generation_config=generation_config)
    return json.loads(response.text)


def persist_ai_result(ai_result):
    payloads = ai_result if isinstance(ai_result, list) else [ai_result]
    cards = []
    for item in payloads:
        if isinstance(item, dict):
            cards.append(insert_ai_card(item))
    return cards


@app.route("/", methods=["GET"])
@app.route("/flashcards", methods=["GET"])
def flashcard_page():
    return send_file(FLASHCARD_PATH)


@app.route("/script.js", methods=["GET"])
def flashcard_script():
    return send_file(SCRIPT_PATH, mimetype="text/javascript")


@app.route("/upload", methods=["GET"])
@app.route("/upload.html", methods=["GET"])
def upload_page():
    return send_file(UPLOAD_PAGE_PATH)


@app.route("/upload.js", methods=["GET"])
def upload_script():
    return send_file(UPLOAD_SCRIPT_PATH, mimetype="text/javascript")


@app.route("/upload.css", methods=["GET"])
def upload_style():
    return send_file(UPLOAD_STYLE_PATH, mimetype="text/css")


@app.route("/node_modules/<path:asset_path>", methods=["GET"])
def node_modules_assets(asset_path):
    candidate = os.path.abspath(os.path.join(NODE_MODULES_PATH, asset_path))
    allowed_root = os.path.abspath(NODE_MODULES_PATH)
    if not candidate.startswith(allowed_root + os.sep) and candidate != allowed_root:
        abort(404)
    if not os.path.isfile(candidate):
        abort(404)
    return send_file(candidate)


@app.route("/reader", methods=["GET"])
def reader_page():
    return send_file(READER_PATH)


@app.route("/api/health", methods=["GET"])
def api_health():
    return jsonify({"status": "ok", "db_path": get_db_path(), "cards": card_count()})


@app.route("/api/cards/due", methods=["GET"])
def api_cards_due():
    limit = int(request.args.get("limit", 200))
    new_limit = int(request.args.get("new_limit", 60))
    return jsonify(get_cards_due(limit=limit, new_limit=new_limit))


@app.route("/api/cards/<card_id>/review", methods=["POST"])
def api_card_review(card_id):
    data = request.get_json() or {}
    fsrs_state = data.get("fsrs_state") or data.get("fsrsState")
    rating = data.get("rating")
    if fsrs_state is None:
        return json_error("fsrs_state is required")
    if rating is None:
        return json_error("rating is required")
    card = update_card_review(
        card_id=int(card_id),
        fsrs_state=fsrs_state,
        rating=int(rating),
        reviewed_at=data.get("reviewed_at"),
        elapsed_ms=data.get("elapsed_ms"),
    )
    if card is None:
        return json_error("card not found", 404)
    return jsonify({"card": card})


@app.route("/api/review/today", methods=["GET"])
def api_review_today():
    return jsonify({"cards": get_review_today()})


@app.route("/api/review/summary", methods=["GET"])
def api_review_summary():
    days = int(request.args.get("days", 7))
    return jsonify({"days": get_review_summary(days=days)})


@app.route("/api/articles", methods=["GET"])
def api_list_articles():
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT id, title, source_url, source, created_at, updated_at, version FROM articles ORDER BY updated_at DESC"
        ).fetchall()
        return jsonify({"articles": [dict(row) for row in rows]})
    finally:
        conn.close()


@app.route("/api/articles", methods=["POST"])
def api_create_article():
    data = request.get_json() or {}
    content_raw = (data.get("content_raw") or "").strip()
    content_html = (data.get("content_html") or "").strip()
    if not content_raw or not content_html:
        return json_error("content_raw/content_html required")
    article_id = uuid.uuid4().hex
    payload = (
        article_id,
        (data.get("title") or "").strip(),
        (data.get("source_url") or "").strip(),
        (data.get("source") or "paste").strip(),
        content_raw,
        content_html,
        1,
        now_iso(),
        now_iso(),
    )
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO articles (id, title, source_url, source, content_raw, content_html, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            payload,
        )
        conn.commit()
        row = conn.execute("SELECT * FROM articles WHERE id = ?", (article_id,)).fetchone()
        return jsonify({"article": row_to_dict(row)})
    finally:
        conn.close()


@app.route("/api/articles/<article_id>", methods=["GET"])
def api_get_article(article_id):
    conn = connect()
    try:
        article = conn.execute("SELECT * FROM articles WHERE id = ?", (article_id,)).fetchone()
        if article is None:
            return json_error("article not found", 404)
        highlights = conn.execute(
            "SELECT * FROM highlights WHERE article_id = ? ORDER BY created_at DESC",
            (article_id,),
        ).fetchall()
        return jsonify({"article": row_to_dict(article), "highlights": [dict(row) for row in highlights]})
    finally:
        conn.close()


@app.route("/api/articles/<article_id>", methods=["PATCH"])
def api_update_article(article_id):
    data = request.get_json() or {}
    set_parts = []
    params = []
    for key in ("title", "source_url", "source", "content_raw", "content_html"):
        if key in data and data.get(key) is not None:
            set_parts.append(f"{key} = ?")
            params.append(str(data.get(key)))
    if not set_parts:
        return json_error("nothing to update")
    set_parts.append("updated_at = ?")
    params.append(now_iso())
    set_parts.append("version = version + 1")
    params.append(article_id)
    conn = connect()
    try:
        cur = conn.execute(f"UPDATE articles SET {', '.join(set_parts)} WHERE id = ?", params)
        conn.commit()
        if cur.rowcount == 0:
            return json_error("article not found", 404)
        row = conn.execute("SELECT * FROM articles WHERE id = ?", (article_id,)).fetchone()
        return jsonify({"article": row_to_dict(row)})
    finally:
        conn.close()


@app.route("/api/articles/<article_id>", methods=["DELETE"])
def api_delete_article(article_id):
    conn = connect()
    try:
        cur = conn.execute("DELETE FROM articles WHERE id = ?", (article_id,))
        conn.commit()
        if cur.rowcount == 0:
            return json_error("article not found", 404)
        return jsonify({"status": "deleted"})
    finally:
        conn.close()


@app.route("/api/highlights", methods=["POST"])
def api_create_highlight():
    data = request.get_json() or {}
    article_id = (data.get("article_id") or "").strip()
    quote_text = (data.get("quote_text") or "").strip()
    start_path = data.get("start_path")
    end_path = data.get("end_path")
    if not article_id or not quote_text or start_path is None or end_path is None:
        return json_error("missing required fields")
    try:
        payload = (
            uuid.uuid4().hex,
            article_id,
            quote_text,
            str(start_path),
            int(data.get("start_offset")),
            str(end_path),
            int(data.get("end_offset")),
            (data.get("color") or "#fff3bf").strip(),
            (data.get("note") or "").strip(),
            now_iso(),
        )
    except Exception:
        return json_error("offsets must be integers")
    conn = connect()
    try:
        exists = conn.execute("SELECT 1 FROM articles WHERE id = ?", (article_id,)).fetchone()
        if not exists:
            return json_error("article not found", 404)
        conn.execute(
            """
            INSERT INTO highlights (
                id, article_id, quote_text, start_path, start_offset, end_path, end_offset, color, note, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            payload,
        )
        conn.commit()
        row = conn.execute("SELECT * FROM highlights WHERE id = ?", (payload[0],)).fetchone()
        return jsonify({"highlight": row_to_dict(row)})
    finally:
        conn.close()


@app.route("/api/highlights/<highlight_id>", methods=["PATCH"])
def api_update_highlight(highlight_id):
    data = request.get_json() or {}
    sets = []
    params = []
    if data.get("color") is not None:
        sets.append("color = ?")
        params.append(str(data.get("color")))
    if data.get("note") is not None:
        sets.append("note = ?")
        params.append(str(data.get("note")))
    if not sets:
        return json_error("nothing to update")
    params.append(highlight_id)
    conn = connect()
    try:
        cur = conn.execute(f"UPDATE highlights SET {', '.join(sets)} WHERE id = ?", params)
        conn.commit()
        if cur.rowcount == 0:
            return json_error("highlight not found", 404)
        row = conn.execute("SELECT * FROM highlights WHERE id = ?", (highlight_id,)).fetchone()
        return jsonify({"highlight": row_to_dict(row)})
    finally:
        conn.close()


@app.route("/api/highlights/<highlight_id>", methods=["DELETE"])
def api_delete_highlight(highlight_id):
    conn = connect()
    try:
        cur = conn.execute("DELETE FROM highlights WHERE id = ?", (highlight_id,))
        conn.commit()
        if cur.rowcount == 0:
            return json_error("highlight not found", 404)
        return jsonify({"status": "deleted"})
    finally:
        conn.close()


@app.route("/api/vocab-inbox", methods=["POST"])
def api_add_vocab_inbox():
    data = request.get_json() or {}
    article_id = (data.get("article_id") or "").strip()
    expression = (data.get("expression") or "").strip()
    if not article_id or not expression:
        return json_error("article_id/expression required")
    inbox_id = uuid.uuid4().hex
    conn = connect()
    try:
        exists = conn.execute("SELECT 1 FROM articles WHERE id = ?", (article_id,)).fetchone()
        if not exists:
            return json_error("article not found", 404)
        conn.execute(
            """
            INSERT INTO vocab_inbox (id, article_id, highlight_id, expression, context_sentence, user_note, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                inbox_id,
                article_id,
                (data.get("highlight_id") or "").strip() or None,
                expression,
                (data.get("context_sentence") or "").strip(),
                (data.get("user_note") or "").strip(),
                (data.get("status") or "draft").strip(),
                now_iso(),
            ),
        )
        conn.commit()
        return jsonify({"status": "created", "id": inbox_id})
    finally:
        conn.close()


@app.route("/sync_progress", methods=["POST"])
def sync_progress():
    archive_data = request.get_json()
    if not archive_data:
        return json_error("no progress payload received")
    updated = batch_sync_progress(archive_data)
    return jsonify({"status": "success", "updated": updated, "deprecated": True})


@app.route("/api/export/json", methods=["GET"])
def api_export_json():
    payload = json.dumps(snapshot_json(), ensure_ascii=False, indent=2)
    buffer = io.BytesIO(payload.encode("utf-8"))
    return send_file(
        buffer,
        mimetype="application/json",
        as_attachment=True,
        download_name="french_flashcards_snapshot.json",
    )


@app.route("/api/export/excel", methods=["GET"])
def api_export_excel():
    filename = f"french_flashcards_export_{now_iso().replace(':', '-').replace('Z', '')}.xlsx"
    path = os.path.join(EXPORT_DIR, filename)
    export_excel(path)
    return send_file(path, as_attachment=True, download_name=filename)


@app.route("/api/admin/import", methods=["POST"])
def api_admin_import():
    excel_path = request.get_json(silent=True) or {}
    imported_excel = import_excel_to_db(excel_path.get("excel_path") or get_excel_path())
    imported_reader = import_reader_db()
    return jsonify({"status": "success", "excel": imported_excel, "reader": imported_reader})


@app.route("/upload_image", methods=["POST"])
def upload_image():
    error = require_ai()
    if error is not None:
        return error
    if "image" not in request.files:
        return json_error("image file is required")
    image = request.files["image"]
    if not image.filename:
        return json_error("image filename is empty")
    save_path = os.path.join(UPLOAD_DIR, image.filename)
    image.save(save_path)
    try:
        ai_result = call_gemini(MULTIMODAL_PROMPT, image_path=save_path)
        cards = persist_ai_result(ai_result)
        return jsonify({"status": "success", "count": len(cards), "cards": cards})
    except Exception as exc:
        logging.error("upload_image failed: %s", exc)
        traceback.print_exc()
        return json_error(str(exc), 500)


@app.route("/create_from_text", methods=["POST"])
def create_from_text():
    error = require_ai()
    if error is not None:
        return error
    data = request.get_json() or {}
    expressions = [item.strip() for item in (data.get("expression") or "").split(";") if item.strip()]
    if not expressions:
        return json_error("expression is required")
    context = (data.get("context") or "").strip()
    created_cards = []
    try:
        for expression in expressions:
            ai_result = call_gemini(
                SINGLE_EXPRESSION_PROMPT,
                target_expression=expression,
                context_document=context,
            )
            created_cards.extend(persist_ai_result(ai_result))
        return jsonify({"status": "success", "count": len(created_cards), "cards": created_cards})
    except Exception as exc:
        logging.error("create_from_text failed: %s", exc)
        traceback.print_exc()
        return json_error(str(exc), 500)


if __name__ == "__main__":
    app.run(debug=os.environ.get("DEBUG", "true").lower() == "true", port=int(os.environ.get("PORT", "5000")))
