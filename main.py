import pandas as pd
import requests
import io
import json
from datetime import datetime
from pathlib import Path
import yaml
from jinja2 import Environment, FileSystemLoader
from dateutil.relativedelta import relativedelta

# Load config
with open("config.yaml", encoding="utf-8") as f:
    config = yaml.safe_load(f)

REPORT_URL = config["report"]["url"]
SHEET_NAME = config["report"]["sheet"]

COL_MOTTATT   = config["columns"]["mottatt"]
COL_PRISET    = config["columns"]["priset"]
COL_SOLGT     = config["columns"]["solgt"]
COL_RETURNERT = config["columns"]["returnert"]
COL_BUD       = config["columns"]["bud"]
COL_AVGIFT    = config["columns"]["avgift"]

print("Downloading report...")
response = requests.get(REPORT_URL)
response.raise_for_status()

df = pd.read_excel(io.BytesIO(response.content), sheet_name=SHEET_NAME)

# Parse dates - take first 10 chars to handle timestamps
for col in [COL_MOTTATT, COL_PRISET, COL_SOLGT, COL_RETURNERT]:
    df[col] = pd.to_datetime(
        df[col].astype(str).str.strip().str[:10],
        format="%d.%m.%Y",
        errors="coerce"
    )

df[COL_BUD]    = pd.to_numeric(df[COL_BUD],    errors="coerce").fillna(0)
df[COL_AVGIFT] = pd.to_numeric(df[COL_AVGIFT], errors="coerce").fillna(0)

MIN_DATE = pd.to_datetime("2025-11-01")

# 1. All cars for priset count (no completed filter)
df_all = df[
    (df[COL_PRISET] >= MIN_DATE) |
    (df[COL_MOTTATT] >= MIN_DATE) |
    (df[COL_SOLGT]    >= MIN_DATE) |
    (df[COL_RETURNERT]>= MIN_DATE)
].copy()

# 2. Only completed cars (have solgt or returnert date)
df_completed = df[df[COL_SOLGT].notna() | df[COL_RETURNERT].notna()].copy()
df_completed = df_completed[
    (df_completed[COL_PRISET]    >= MIN_DATE) |
    (df_completed[COL_MOTTATT]   >= MIN_DATE) |
    (df_completed[COL_SOLGT]     >= MIN_DATE) |
    (df_completed[COL_RETURNERT] >= MIN_DATE)
].copy()

# Debug prints for accuracy
print("Total rows after download:", len(df))
print("Priced non-null count (all):", df_all[COL_PRISET].notna().sum())
print("Completed rows:", len(df_completed))
print("Mottatt non-null in completed:", df_completed[COL_MOTTATT].notna().sum())
print("Solgt non-null in completed:", df_completed[COL_SOLGT].notna().sum())
print("Returnert non-null in completed:", df_completed[COL_RETURNERT].notna().sum())

# Add month columns
for col, df_subset in [(COL_PRISET, df_all), (COL_MOTTATT, df_completed),
                       (COL_SOLGT, df_completed), (COL_RETURNERT, df_completed)]:
    df_subset[f'{col}_month'] = df_subset[col].dt.strftime('%Y-%m')

# Unique months from all relevant dates
all_months = pd.concat([
    df_all[f'{COL_PRISET}_month'],
    df_completed[f'{COL_MOTTATT}_month'],
    df_completed[f'{COL_SOLGT}_month'],
    df_completed[f'{COL_RETURNERT}_month']
]).dropna().unique()
all_months = sorted(set(all_months))

today = datetime.now()
default_dt = today - relativedelta(months=2)
default_month = default_dt.strftime('%Y-%m')

if default_month not in all_months and all_months:
    default_month = all_months[-1]

# Convert to list of dicts and clean NaN/NaT for safe JSON
data_all_list = df_all.to_dict(orient='records')
data_completed_list = df_completed.to_dict(orient='records')

for row in data_all_list + data_completed_list:
    for k, v in row.items():
        if pd.isna(v):
            row[k] = None

# Prepare data for template
context = {
    "data_all_json":        json.dumps(data_all_list, default=str),
    "data_completed_json":  json.dumps(data_completed_list, default=str),
    "months":               all_months,
    "default_month":        default_month,
    "min_date_str":         "November 2025",
    "now_year":             today.strftime('%Y'),
    "now_month":            today.strftime('%m')
}

env = Environment(loader=FileSystemLoader("."))
env.filters["tojson"] = lambda x: json.dumps(x, default=str)
template = env.get_template("template.html")
html = template.render(**context)

Path("Peasy_Exec_Report.html").write_text(html, encoding="utf-8")
print("Generated: Peasy_Exec_Report.html")
