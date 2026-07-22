import openpyxl
wb = openpyxl.load_workbook("/app/import_data.xlsx", read_only=True, data_only=True)
ws = wb["Feb - June Tracker (Cleaned)"]
for i, row in enumerate(ws.iter_rows(values_only=True)):
    print(f"Row {i}: cols={len(row)}, pid={repr(str(row[0])[:40] if row[0] else None)}, name={repr(str(row[21])[:40] if len(row)>21 and row[21] else None)}")
    if i > 3:
        break