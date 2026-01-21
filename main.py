# main.py
import pandas as pd
import requests
import io
import json
from datetime import datetime
from pathlib import Path
import yaml
from jinja2 import Environment, FileSystemLoader
from dateutil.relativedelta import relativedelta

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

for col in [COL_MOTTATT, COL_PRISET, COL_SOLGT, COL_RETURNERT]:
    df[col] = pd.to_datetime(df[col].astype(str).str.strip().str[:10], format="%d.%m.%Y", errors="coerce")

df[COL_BUD] = pd.to_numeric(df[COL_BUD], errors="coerce").fillna(0)
df[COL_AVGIFT] = pd.to_numeric(df[COL_AVGIFT], errors="coerce").fillna(0)

MIN_DATE = pd.to_datetime("2025-11-01")
df = df[
    (df[COL_PRISET] >= MIN_DATE) |
    (df[COL_MOTTATT] >= MIN_DATE) |
    (df[COL_SOLGT] >= MIN_DATE) |
    (df[COL_RETURNERT] >= MIN_DATE)
].copy()

for col in [COL_PRISET, COL_MOTTATT, COL_SOLGT, COL_RETURNERT]:
    df[f'{col}_month'] = df[col].dt.strftime('%Y-%m')

all_months = pd.concat([
    df[f'{COL_PRISET}_month'],
    df[f'{COL_MOTTATT}_month'],
    df[f'{COL_SOLGT}_month'],
    df[f'{COL_RETURNERT}_month']
]).dropna().unique()
all_months = sorted(set(all_months))

today = datetime.now()
default_dt = today - relativedelta(months=2)
default_month = default_dt.strftime('%Y-%m')

if default_month not in all_months and all_months:
    default_month = all_months[-1]  # latest month with data

data_rows = df.to_dict(orient='records')

context = {
    "data_json": json.dumps(data_rows, default=str),
    "months": all_months,
    "default_month": default_month,
    "min_date_str": "November 2025"
}

env = Environment(loader=FileSystemLoader("."))
env.filters["tojson"] = lambda x: json.dumps(x, default=str)
template = env.get_template("template.html")
html = template.render(**context)

Path("Peasy_Exec_Report.html").write_text(html, encoding="utf-8")
print("Generated: Peasy_Exec_Report.html")
