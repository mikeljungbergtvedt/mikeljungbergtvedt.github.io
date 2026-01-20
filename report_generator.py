# report_generator.py
# Requirements: pip install pandas openpyxl matplotlib jinja2 requests

import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
from pathlib import Path
import base64
from io import BytesIO
import jinja2
import requests
import io
import json

# CONFIG
REPORT_URL = "https://api.biladministrasjon.no/public/reports/peasy/dhqui7Hkl54?output=xlsx"
SHEET_NAME = "Sheet1"

TODAY = datetime.now()
YESTERDAY = TODAY - timedelta(days=1)
YESTERDAY = YESTERDAY.replace(hour=23, minute=59, second=59, microsecond=999999)  # end of yesterday

# Column names
COL_VALUED = "SD mottatt på"      # Priset
COL_RECEIVED = "Mottatt"
COL_SOLD = "Solgt på"
COL_VALUE = "Bud"                 # Value
COL_COMMISSION = "Avgift"         # Commission

DATE_COLS = [COL_VALUED, COL_RECEIVED, COL_SOLD]
VALUE_COLS = [COL_VALUE, COL_COMMISSION]

PERIODS = {
    "Siste 7 dager": YESTERDAY - timedelta(days=6),   # yesterday + 6 days back
    "Siste 30 dager": YESTERDAY - timedelta(days=29),
    "Siste 60 dager": YESTERDAY - timedelta(days=59),
    "Totalt": None
}

MARKETING_DAILY = 1000
MARKETING_START = datetime(2025, 11, 1)

# Download the latest Excel from URL
print(f"Downloading report from: {REPORT_URL}")
response = requests.get(REPORT_URL)
response.raise_for_status()  # raise error if download fails

# Load from memory
df = pd.read_excel(io.BytesIO(response.content), sheet_name=SHEET_NAME)

print("Columns:", df.columns.tolist())

# Parse dates
for col in DATE_COLS:
    df[col] = df[col].astype(str).str.strip()
    parsed = pd.to_datetime(df[col], format="%d.%m.%Y %H:%M", errors="coerce")
    mask = parsed.isna()
    if mask.any():
        parsed[mask] = pd.to_datetime(df.loc[mask, col].str[:10], format="%d.%m.%Y", errors="coerce")
    df[col] = parsed

for col in VALUE_COLS:
    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

# Exclude today's data
df = df[df[COL_VALUED] <= YESTERDAY]

# Daily aggregation for interactive chart
df_daily = df.copy()
df_daily['date'] = df_daily[COL_VALUED].dt.date
daily = df_daily.groupby('date').agg({
    COL_VALUED: 'count',
    COL_RECEIVED: 'count',
    COL_SOLD: 'count'
}).rename(columns={COL_VALUED: 'priset', COL_RECEIVED: 'mottatt', COL_SOLGT: 'solgt'}).reset_index()
daily['date'] = daily['date'].astype(str)
daily_json = daily.to_json(orient='records')

# Standard calculations
results = []

for period_name, start_date in PERIODS.items():
    row = {"Period": period_name}
    
    priset_count = df[COL_VALUED].notna().sum() if start_date is None else df[(df[COL_VALUED] >= start_date) & df[COL_VALUED].notna()].shape[0]
    mottatt_count = df[COL_RECEIVED].notna().sum() if start_date is None else df[(df[COL_RECEIVED] >= start_date) & df[COL_RECEIVED].notna()].shape[0]
    solgt_count = df[COL_SOLGT].notna().sum() if start_date is None else df[(df[COL_SOLGT] >= start_date) & df[COL_SOLGT].notna()].shape[0]
    
    row["priset_count"] = priset_count
    row["mottatt_count"] = mottatt_count
    row["solgt_count"] = solgt_count
    
    row["priset_to_mottatt_pct"] = round(mottatt_count / priset_count * 100, 1) if priset_count > 0 else 0
    row["priset_to_solgt_pct"] = round(solgt_count / priset_count * 100, 1) if priset_count > 0 else 0
    
    # Marketing cost
    if start_date is None:
        priset_min = df[COL_VALUED].min()
        if pd.isna(priset_min):
            priset_min = YESTERDAY
        marketing_start = max(MARKETING_START.date(), priset_min.date())
        marketing_end = YESTERDAY.date()
    else:
        marketing_start = max(MARKETING_START.date(), start_date.date())
        marketing_end = YESTERDAY.date()
    
    days = (marketing_end - marketing_start).days + 1
    total_marketing = days * MARKETING_DAILY if days > 0 else 0
    row["marketing_per_solgt"] = round(total_marketing / solgt_count) if solgt_count > 0 else 0
    
    # Averages
    sold_mask = df[COL_SOLGT].notna()
    if start_date is not None:
        sold_mask &= (df[COL_SOLGT] >= start_date)
    sold = df[sold_mask]
    
    row["avg_value"] = sold[COL_VALUE].mean() if not sold.empty else 0
    row["avg_commission"] = sold[COL_COMMISSION].mean() if not sold.empty else 0
    
    results.append(row)

summary_df = pd.DataFrame(results)
summary_df[["avg_value", "avg_commission", "marketing_per_solgt"]] = summary_df[["avg_value", "avg_commission", "marketing_per_solgt"]].round(0).astype(int)

# Static Charts
def fig_to_base64(fig):
    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    buf.seek(0)
    return "data:image/png;base64," + base64.b64encode(buf.read()).decode("utf-8")

plt.style.use("ggplot")

# Chart 1: Counts bar
fig1, ax1 = plt.subplots(figsize=(10, 6))
positions = range(len(summary_df))
width = 0.25

ax1.bar([p - width for p in positions], summary_df["priset_count"], width, label="Priset")
ax1.bar(positions, summary_df["mottatt_count"], width, label="Mottatt")
ax1.bar([p + width for p in positions], summary_df["solgt_count"], width, label="Solgt")

for i, v in enumerate(summary_df["priset_count"]):
    ax1.text(i - width, v + 5, str(v), ha='center', va='bottom', fontsize=9)
for i, v in enumerate(summary_df["mottatt_count"]):
    ax1.text(i, v + 5, str(v), ha='center', va='bottom', fontsize=9)
for i, v in enumerate(summary_df["solgt_count"]):
    ax1.text(i + width, v + 5, str(v), ha='center', va='bottom', fontsize=9)

ax1.set_xticks(positions)
ax1.set_xticklabels(summary_df["Period"], rotation=15, ha='center')
ax1.set_title("Antall per periode")
ax1.set_ylabel("Antall biler")
ax1.legend()
chart1_b64 = fig_to_base64(fig1)
plt.close(fig1)

# Chart 2: Average Values per Sold Car bar
fig2, ax2 = plt.subplots(figsize=(10, 6))
positions = range(len(summary_df))
width = 0.35

ax2.bar([p - width/2 for p in positions], summary_df["avg_value"], width, label="Gj.sn. Verdi")
ax2.bar([p + width/2 for p in positions], summary_df["avg_commission"], width, label="Gj.sn. Avgift")

for i, v in enumerate(summary_df["avg_value"]):
    ax2.text(i - width/2, v + 1000, f"{v:,}", ha='center', va='bottom', fontsize=10)
for i, v in enumerate(summary_df["avg_commission"]):
    ax2.text(i + width/2, v + 1000, f"{v:,}", ha='center', va='bottom', fontsize=10)

ax2.set_xticks(positions)
ax2.set_xticklabels(summary_df["Period"], rotation=15, ha='center')
ax2.set_title("Gjennomsnitt per solgt bil")
ax2.set_ylabel("NOK")
ax2.legend()
chart2_b64 = fig_to_base64(fig2)
plt.close(fig2)

# HTML template with interactive trend chart + bilingual toggle
template_str = """
<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title class="trans" data-en="Peasy Report" data-no="Peasy Rapport">Peasy Rapport</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #e0e9e5; color: #004225; }
    .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.08); }
    h1 { text-align: center; color: #004225; font-size: 2rem; margin-bottom: 10px; }
    .subtitle { text-align: center; font-size: 1.3rem; margin-bottom: 20px; color: #004225; }
    .lang-toggle { text-align: center; margin-bottom: 15px; font-size: 1.1rem; }
    .lang-toggle a { margin: 0 8px; text-decoration: none; color: #004225; }
    .lang-toggle a.active { color: #ffcc33; border-bottom: 2px solid #ffcc33; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; font-size: 0.95rem; }
    th, td { padding: 8px 12px; text-align: right; border: 1px solid #ddd; }
    th { background: #f5f9f6; color: #004225; font-weight: bold; }
    td { background: white; }
    tr.total-row td { background: #e8f5e9; font-weight: bold; }
    img { max-width: 100%; height: auto; margin: 20px 0; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    #dailyChartContainer { margin: 40px 0; }
    canvas { max-width: 100%; height: 400px; }
    footer { margin-top: 40px; text-align: center; color: #777; font-size: 0.9em; }
    @media (max-width: 768px) {
      table { font-size: 0.85rem; overflow-x: auto; display: block; }
      th, td { padding: 6px 8px; }
      canvas { height: 300px !
