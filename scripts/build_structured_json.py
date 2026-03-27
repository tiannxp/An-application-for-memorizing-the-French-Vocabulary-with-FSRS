import pandas as pd
import json
import os
from datetime import datetime # 引入datetime库来处理时间对象

# --- 配置区 ---
EXCEL_FILE_PATH = 'french_app_data.xlsx'
JSON_OUTPUT_PATH = 'database_structured.json'

print("--- 诊断信息 ---")
print(f"当前工作目录: {os.getcwd()}")
print(f"正在查找文件: '{EXCEL_FILE_PATH}'")

if not os.path.exists(EXCEL_FILE_PATH):
    print(f"\n错误：关键文件未找到！")
    exit()
else:
    print(f"文件 '{EXCEL_FILE_PATH}' 已找到。\n")

print(f"--- 开始转换 '{EXCEL_FILE_PATH}' ---")

try:
    all_sheets_dict = pd.read_excel(EXCEL_FILE_PATH, sheet_name=None)
    print(f"成功读取到以下Sheets: {list(all_sheets_dict.keys())}")
except Exception as e:
    print(f"\n错误：在读取Excel文件时发生问题！")
    print(f"具体错误信息: {e}")
    exit()

database_json = {}

for sheet_name, df in all_sheets_dict.items():
    print(f"正在处理 Sheet: '{sheet_name}'...")
    
    # 这一步非常重要，它确保了所有非字符串的列都被正确处理
    df = df.astype(object).where(pd.notna(df), None)
    
    records = df.to_dict(orient='records')
    
    if sheet_name == 'notes' and 'fields' in df.columns:
        print(" -> 正在解析 'fields' 字段...")
        for i, record in enumerate(records):
            if record.get('fields') and isinstance(record['fields'], str):
                try:
                    record['fields'] = json.loads(record['fields'])
                except json.JSONDecodeError:
                    print(f"   警告：在 'notes' Sheet 的第 {i+2} 行，note_id={record.get('note_id')}，其'fields'列的内容不是一个有效的JSON字符串。")
    
    database_json[sheet_name] = records

# ================= 解决方案 v3 ==================
# 自定义一个函数，用于处理JSON序列化时遇到的特殊类型
def json_serializer(obj):
    # 如果对象是Timestamp或datetime类型，就将其格式化为ISO 8601字符串
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.isoformat()
    # 如果遇到其他无法序列化的类型，抛出错误
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")
# ================================================

try:
    print("\n--- 准备写入JSON文件 ---")
    with open(JSON_OUTPUT_PATH, 'w', encoding='utf-8') as f:
        # 在json.dump中，使用`default`参数来指定我们的自定义序列化函数
        json.dump(database_json, f, ensure_ascii=False, indent=2, default=json_serializer)
        
    print("-" * 40)
    print(f"🎉🎉🎉 转换成功! 数据库已被保存到 '{JSON_OUTPUT_PATH}'。🎉🎉🎉")
    print("-" * 40)
except Exception as e:
    print(f"\n错误：写入JSON文件时发生问题！")
    print(f"具体错误信息: {e}")