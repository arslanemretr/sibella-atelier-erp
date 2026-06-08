import pandas as pd
from datetime import date, timedelta

STORE_MAP = {
    "2930952979":  ("store-c3df3986-50f4-4471-a24d-9852d71c96ae", 60),
    "4111174017":  ("store-70efd9cd-76ae-40a6-a5cb-55a2bed4cfdf", 25),
    "33361748410": ("store-70efd9cd-76ae-40a6-a5cb-55a2bed4cfdf", 25),
    "2580669398":  ("store-c2ef4b79-586a-47d9-a9c5-525ce92ab896", 25),
    "6221498219":  ("store-78c74bbd-32d4-463f-bed0-2ad87945976f", 45),
    "37969653008": ("store-5beb63c9-8683-4e20-bf91-fd97a075d9df", 15),
    "3840324976":  ("store-ac02633e-be62-4826-8515-32e6af5a888e", 45),
    "4740744226":  ("store-449963f4-dbec-4aaf-8b53-473c30c20723", 30),
    "21383215836": ("store-4ff8286d-b9de-4837-8f68-5fef2580975c", 15),
}

def calc_due_date(period_key, payment_due_days):
    year, month = map(int, period_key.split("-"))
    if month == 12:
        last_day = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        last_day = date(year, month + 1, 1) - timedelta(days=1)
    due = last_day + timedelta(days=payment_due_days)
    if due.weekday() == 5:
        due += timedelta(days=2)
    elif due.weekday() == 6:
        due += timedelta(days=1)
    return due.strftime("%Y-%m-%d")

def next_invoice_no(seq):
    return f"FAT-2026-{str(seq).zfill(4)}"

df = pd.read_excel(r"C:\Users\emrearslan\Desktop\Fatura Düzen leme.xlsx") if False else \
     pd.read_excel(r"C:\Users\emrearslan\Desktop\Fatura D\xfczenleme.xlsx") if False else None

import glob, os
candidates = glob.glob(r"C:\Users\emrearslan\Desktop\Fatura*.xlsx")
print("Bulunan dosyalar:", candidates)
df = pd.read_excel(candidates[0]) if candidates else None
if df is None:
    raise FileNotFoundError("Excel dosyasi bulunamadi")

# Kolon indexi ile at -- encoding sorununu atla
df.columns = ["fatura_no","vergi_no","tarih","toplam","kdv_oran","miktar","kdv_tutar","birim_tutar","hizmet_tutar","donem"]

print(f"Toplam satir: {len(df)}")
df_clean = df.dropna(subset=["fatura_no","tarih","toplam","miktar"])
print(f"Gecerli satir: {len(df_clean)}")

sql_lines = []
skipped = []
seq = 1

for _, row in df_clean.iterrows():
    try:
        tax_no = str(int(float(row["vergi_no"]))) if pd.notna(row["vergi_no"]) else ""
    except Exception:
        tax_no = str(row["vergi_no"]).strip()

    if tax_no not in STORE_MAP:
        skipped.append(f"Bilinmeyen vergi no: {tax_no}")
        continue

    store_id, due_days = STORE_MAP[tax_no]
    inv_date = pd.to_datetime(row["tarih"]).strftime("%Y-%m-%d")
    kdv_rate = round(float(row["kdv_oran"]) * 100)
    total_amount   = round(float(row["toplam"]), 2)
    kdv_amount     = round(float(row["kdv_tutar"]), 2)
    service_amount = round(float(row["hizmet_tutar"]), 2)
    quantity       = round(float(row["miktar"]), 4)
    unit_amount    = round(service_amount / quantity, 2) if quantity else 0
    period_key     = pd.to_datetime(row["donem"]).strftime("%Y-%m")
    due_date       = calc_due_date(period_key, due_days)
    ext_invoice_no = str(row["fatura_no"]).strip().replace("'", "''") if pd.notna(row["fatura_no"]) else ""
    invoice_no     = next_invoice_no(seq)
    seq += 1

    sql = (
        f"INSERT INTO store_invoices "
        f"(id,invoice_no,store_id,invoice_date,total_amount,kdv_rate,quantity,"
        f"kdv_amount,unit_amount,service_amount,period_key,due_date,description,ext_invoice_no,created_at,updated_at) "
        f"VALUES ("
        f"'sinv-import-{seq:04d}',"
        f"'{invoice_no}',"
        f"'{store_id}',"
        f"'{inv_date}'::date,"
        f"{total_amount},{kdv_rate},{quantity},"
        f"{kdv_amount},{unit_amount},{service_amount},"
        f"'{period_key}','{due_date}','',"
        f"'{ext_invoice_no}',NOW(),NOW());"
    )
    sql_lines.append(sql)

print(f"Aktarilacak: {len(sql_lines)}")
if skipped:
    print(f"Atlanan: {skipped}")

with open(r"D:\erpsibella_import.sql", "w", encoding="utf-8") as f:
    f.write("\n".join(sql_lines))
print("SQL dosyasi hazir: D:\\erpsibella_import.sql")
