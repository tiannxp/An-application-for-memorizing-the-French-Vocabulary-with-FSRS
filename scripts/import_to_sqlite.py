import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from database_store import (
    get_db_path,
    get_excel_path,
    get_reader_db_path,
    import_excel_to_db,
    import_reader_db,
    init_db,
    load_env_file,
    validate_import,
)


def main():
    load_env_file()
    init_db()
    excel_path = get_excel_path()
    reader_path = get_reader_db_path()
    db_path = get_db_path()

    excel_result = import_excel_to_db(excel_path=excel_path, db_path=db_path)
    reader_result = import_reader_db(reader_db_path=reader_path, db_path=db_path)
    validation = validate_import(excel_path=excel_path, reader_db_path=reader_path, db_path=db_path)

    print("Import completed.")
    print(json.dumps({"excel": excel_result, "reader": reader_result, "validation": validation}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
