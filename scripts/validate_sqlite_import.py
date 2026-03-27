import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from database_store import get_db_path, get_excel_path, get_reader_db_path, load_env_file, validate_import


def main():
    load_env_file()
    payload = validate_import(
        excel_path=get_excel_path(),
        reader_db_path=get_reader_db_path(),
        db_path=get_db_path(),
    )
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
