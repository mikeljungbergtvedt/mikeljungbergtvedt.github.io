# report_generator.py
# Requirements: pip install pandas openpyxl matplotlib jinja2

import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
from pathlib import Path
import base64
from io import BytesIO
import jinja2

# ────────────────────────────────────────────────
# CONFIG
# ────────────────────────────────────────────────

FILE_PATH = "report.xlsx"
SHEET_NAME = "Sheet1"

TODAY = datetime.now()

# Exact column names from Excel
COL_PRISET = "SD mottatt på"      # display as "Priset"
COL_MOTTATT = "Mottatt"
COL_SOLGT = "Solgt på"
COL_BUD = "Bud"
COL_AVGIFT = "Avgift"

DATE_COLS = [COL_PRISET, COL_MOTTATT, COL_SOLGT]
VALUE_COLS = [COL_BUD, COL_AVGIFT]

PERIODS = {
    "Last 30 days": TODAY - timedelta(days=30),
    "Last 60 days": TODAY - timedelta(days=60),
    "Total": None
}

MARKETING_DAILY = 1000
MARKETING_START = datetime(2025, 11, 1)

# ────────────────────────────────────────────────
# 1. Load & parse
# ────────────────────────────────────────────────

df = pd.read_excel(FILE_PATH, sheet_name=SHEET_NAME)

print("Columns:", df.columns.tolist())

for col in DATE_COLS:
    df[col] = df[col].astype(str).str.strip()
    parsed = pd.to_datetime(df[col], format="%d.%m.%Y %H:%M", errors="coerce")
    mask = parsed.isna()
    if mask.any():
        parsed[mask] = pd.to_datetime(df.loc[mask, col].str[:10], format="%d.%m.%Y", errors="coerce")
    df[col] = parsed

for col in VALUE_COLS:
    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

# ────────────────────────────────────────────────
# 2. Calculate metrics
# ────────────────────────────────────────────────

results = []

for period_name, start_date in PERIODS.items():
    row = {"Period": period_name}
    
    # Counts
    priset_count = df[COL_PRISET].notna().sum() if start_date is None else df[(df[COL_PRISET] >= start_date) & df[COL_PRISET].notna()].shape[0]
    mottatt_count = df[COL_MOTTATT].notna().sum() if start_date is None else df[(df[COL_MOTTATT] >= start_date) & df[COL_MOTTATT].notna()].shape[0]
    solgt_count = df[COL_SOLGT].notna().sum() if start_date is None else df[(df[COL_SOLGT] >= start_date) & df[COL_SOLGT].notna()].shape[0]
    
    row["priset_count"] = priset_count
    row["mottatt_count"] = mottatt_count
    row["solgt_count"] = solgt_count
    
    # Conversion %
    row["priset_to_mottatt_pct"] = round(mottatt_count / priset_count * 100, 1) if priset_count > 0 else 0
    row["priset_to_solgt_pct"] = round(solgt_count / priset_count * 100, 1) if priset_count > 0 else 0
    
    # Marketing cost - fixed date comparison
    if start_date is None:
        priset_min = df[COL_PRISET].min()
        if pd.isna(priset_min):
            priset_min = TODAY
        marketing_start = max(MARKETING_START.date(), priset_min.date())
        marketing_end = TODAY.date()
    else:
        marketing_start = max(MARKETING_START.date(), start_date.date())
        marketing_end = TODAY.date()
    
    days = (marketing_end - marketing_start).days + 1
    total_marketing = days * MARKETING_DAILY if days > 0 else 0
    row["marketing_per_solgt"] = round(total_marketing / solgt_count) if solgt_count > 0 else 0
    
    # Averages
    sold_mask = df[COL_SOLGT].notna()
    if start_date is not None:
        sold_mask &= (df[COL_SOLGT] >= start_date)
    sold = df[sold_mask]
    
    row["avg_bud"] = sold[COL_BUD].mean() if not sold.empty else 0
    row["avg_avgift"] = sold[COL_AVGIFT].mean() if not sold.empty else 0
    
    results.append(row)

summary_df = pd.DataFrame(results)
summary_df[["avg_bud", "avg_avgift", "marketing_per_solgt"]] = summary_df[["avg_bud", "avg_avgift", "marketing_per_solgt"]].round(0).astype(int)

# ────────────────────────────────────────────────
# 3. Charts
# ────────────────────────────────────────────────

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
ax1.bar([p + width for p in positions], summary_df["solgt_count"], width, label="Sold")

# Data labels on bars
for i, v in enumerate(summary_df["priset_count"]):
    ax1.text(i - width, v + 5, str(v), ha='center', va='bottom', fontsize=9)
for i, v in enumerate(summary_df["mottatt_count"]):
    ax1.text(i, v + 5, str(v), ha='center', va='bottom', fontsize=9)
for i, v in enumerate(summary_df["solgt_count"]):
    ax1.text(i + width, v + 5, str(v), ha='center', va='bottom', fontsize=9)

ax1.set_xticks(positions)
ax1.set_xticklabels(summary_df["Period"], rotation=15, ha='center')
ax1.set_title("Counts by Period")
ax1.set_ylabel("Number of cars")
ax1.legend()
chart1_b64 = fig_to_base64(fig1)
plt.close(fig1)

# Chart 2: Averages bar
fig2, ax2 = plt.subplots(figsize=(10, 6))
positions = range(len(summary_df))
width = 0.35

ax2.bar([p - width/2 for p in positions], summary_df["avg_bud"], width, label="Avg Bud", color="skyblue")
ax2.bar([p + width/2 for p in positions], summary_df["avg_avgift"], width, label="Avg Commission", color="orange")

# Data labels
for i, v in enumerate(summary_df["avg_bud"]):
    ax2.text(i - width/2, v + 1000, f"{v:,}", ha='center', va='bottom', fontsize=10)
for i, v in enumerate(summary_df["avg_avgift"]):
    ax2.text(i + width/2, v + 1000, f"{v:,}", ha='center', va='bottom', fontsize=10)

ax2.set_xticks(positions)
ax2.set_xticklabels(summary_df["Period"], rotation=15, ha='center')
ax2.set_title("Average Values per Sold Car")
ax2.set_ylabel("NOK")
ax2.legend()
chart2_b64 = fig_to_base64(fig2)
plt.close(fig2)

# ────────────────────────────────────────────────
# 4. HTML
# ────────────────────────────────────────────────

template_str = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Peasy / Driveno Daily Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f8f9fa; }
    h1, h2 { color: #2c3e50; text-align: center; }
    table { border-collapse: collapse; width: 100%; max-width: 1200px; margin: 20px auto; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    th, td { padding: 12px 15px; text-align: right; border-bottom: 1px solid #ddd; }
    th { background: #34495e; color: white; }
    tr:nth-child(even) { background: #f2f2f2; }
    img { max-width: 100%; height: auto; margin: 30px auto; display: block; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  </style>
</head>
<body>

  <h1>Peasy / Driveno Report</h1>
  <p style="text-align:center;">Snapshot date: {{ today.strftime('%Y-%m-%d') }}<br>Last updated: {{ now }}</p>

  <h2>Summary Table</h2>
  <table>
    <tr>
      <th>Period</th>
      <th>Priset</th>
      <th>Mottatt</th>
      <th>Priset → Mottatt</th>
      <th>Sold</th>
      <th>Priset → Solgt</th>
      <th>Markedsføringskostnad per solgt bil</th>
      <th>Avg Bud per sold car</th>
      <th>Avg Commission per sold car</th>
    </tr>
    {% for row in summary %}
    <tr>
      <td>{{ row.Period }}</td>
      <td>{{ row['priset_count'] }}</td>
      <td>{{ row['mottatt_count'] }}</td>
      <td>{{ row['priset_to_mottatt_pct'] }} %</td>
      <td>{{ row['solgt_count'] }}</td>
      <td>{{ row['priset_to_solgt_pct'] }} %</td>
      <td>{{ row['marketing_per_solgt'] | int | format_number }} NOK</td>
      <td>{{ row['avg_bud'] | int | format_number }} NOK</td>
      <td>{{ row['avg_avgift'] | int | format_number }} NOK</td>
    </tr>
    {% endfor %}
  </table>

  <h2>Visual Overview</h2>
  <h3>Counts by Period</h3>
  <img src="{{ chart1 }}" alt="Counts">

  <h3>Average Values per Sold Car</h3>
  <img src="{{ chart2 }}" alt="Averages">

  <footer style="margin-top:40px; text-align:center; color:#777; font-size:0.9em;">
    Generated automatically from report.xlsx
  </footer>

</body>
</html>
"""

env = jinja2.Environment()
env.filters["format_number"] = lambda x: f"{x:,}"

template = env.from_string(template_str)

html_content = template.render(
    today=TODAY,
    now=datetime.now().strftime("%Y-%m-%d %H:%M"),
    summary=summary_df.to_dict("records"),
    chart1=chart1_b64,
    chart2=chart2_b64
)

# Force commit every run
html_content = html_content.replace(
    '</footer>',
    f'<p style="font-size:0.8em; color:#999; text-align:center;">Generated at {datetime.now().strftime("%Y-%m-%d %H:%M:%S CET")}</p></footer>'
)

Path("test.html").write_text(html_content, encoding="utf-8")

print("Report saved as test.html")
