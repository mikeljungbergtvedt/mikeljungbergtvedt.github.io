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

FILE_PATH = "report.xlsx"               # change if needed
SHEET_NAME = "Sheet1"

TODAY = datetime(2026, 1, 19)           # fixed for your data snapshot

DATE_COLUMNS = ["SD mottatt på", "Mottatt", "Solgt på"]
VALUE_COLUMNS = ["Bud", "Avgift"]

PERIODS = {
    "Last 30 days": TODAY - timedelta(days=30),
    "Last 60 days": TODAY - timedelta(days=60),
    "Total":        None                    # means no filter
}

# ────────────────────────────────────────────────
# 1. Load and prepare data
# ────────────────────────────────────────────────

df = pd.read_excel(FILE_PATH, sheet_name=SHEET_NAME)

# Parse Norwegian date format (with or without time)
for col in DATE_COLUMNS:
    df[col] = pd.to_datetime(
        df[col],
        format="%d.%m.%Y %H:%M",
        errors="coerce"
    )
    # fallback without time
    mask = df[col].isna()
    df.loc[mask, col] = pd.to_datetime(
        df.loc[mask, col].astype(str).str[:10],
        format="%d.%m.%Y",
        errors="coerce"
    )

# Clean numeric columns
for col in VALUE_COLUMNS:
    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

# ────────────────────────────────────────────────
# 2. Calculate metrics per period
# ────────────────────────────────────────────────

results = []

for period_name, start_date in PERIODS.items():
    if start_date is None:
        period_df = df
    else:
        period_df = df[df["Solgt på"] >= start_date]   # example: filter on sold date
        # You can change filter column here ↑ (e.g. "Mottatt", "SD mottatt på")

    row = {
        "Period": period_name,
        "SD mottatt count": df[col].notna().sum() if period_name == "Total" else period_df["SD mottatt på"].notna().sum(),
        "Mottatt count":    df["Mottatt"].notna().sum() if period_name == "Total" else period_df["Mottatt"].notna().sum(),
        "Sold count":       df["Solgt på"].notna().sum() if period_name == "Total" else period_df["Solgt på"].notna().sum(),
    }

    sold = period_df[period_df["Solgt på"].notna()]
    if not sold.empty:
        row["Avg Bud per sold car"]    = sold["Bud"].mean()
        row["Avg Avgift per sold car"] = sold["Avgift"].mean()
    else:
        row["Avg Bud per sold car"]    = 0
        row["Avg Avgift per sold car"] = 0

    results.append(row)

summary_df = pd.DataFrame(results)

# Round averages for nicer display
summary_df["Avg Bud per sold car"]    = summary_df["Avg Bud per sold car"].round(0).astype(int)
summary_df["Avg Avgift per sold car"] = summary_df["Avg Avgift per sold car"].round(0).astype(int)

# ────────────────────────────────────────────────
# 3. Create charts → base64 for embedding in HTML
# ────────────────────────────────────────────────

def fig_to_base64(fig):
    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    buf.seek(0)
    return "data:image/png;base64," + base64.b64encode(buf.read()).decode("utf-8")

plt.style.use("ggplot")

# Chart 1: Counts bar chart
fig1, ax1 = plt.subplots(figsize=(9, 5))
x = summary_df["Period"]
width = 0.25
ax1.bar(x, summary_df["SD mottatt count"], width, label="SD mottatt")
ax1.bar(x + width/3*1, summary_df["Mottatt count"],    width, label="Mottatt")
ax1.bar(x + width/3*2, summary_df["Sold count"],       width, label="Sold")
ax1.set_title("Counts by Period")
ax1.set_ylabel("Number of cars")
ax1.legend()
plt.xticks(rotation=15)
chart1_b64 = fig_to_base64(fig1)
plt.close(fig1)

# Chart 2: Average values line chart
fig2, ax2 = plt.subplots(figsize=(9, 5))
ax2.plot(summary_df["Period"], summary_df["Avg Bud per sold car"],    marker="o", label="Avg Bud")
ax2.plot(summary_df["Period"], summary_df["Avg Avgift per sold car"], marker="s", label="Avg Commission")
ax2.set_title("Average Values per Sold Car")
ax2.set_ylabel("NOK")
ax2.legend()
plt.xticks(rotation=15)
chart2_b64 = fig_to_base64(fig2)
plt.close(fig2)

# ────────────────────────────────────────────────
# 4. HTML template with Jinja2
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
    h1, h2 { color: #2c3e50; }
    table {
      border-collapse: collapse;
      width: 100%;
      max-width: 1100px;
      margin: 20px 0;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    th, td { padding: 12px 15px; text-align: right; border-bottom: 1px solid #ddd; }
    th { background: #34495e; color: white; }
    tr:nth-child(even) { background: #f2f2f2; }
    .center { text-align: center; }
    img { max-width: 100%; height: auto; margin: 20px 0; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  </style>
</head>
<body>

  <h1>Peasy / Driveno Report</h1>
  <p class="center">Snapshot date: {{ today.strftime('%Y-%m-%d') }}<br>
  Last updated: {{ now }}</p>

  <h2>Summary Table</h2>
  <table>
    <tr>
      <th>Period</th>
      <th>SD mottatt</th>
      <th>Mottatt</th>
      <th>Sold</th>
      <th>Avg Bud per sold car</th>
      <th>Avg Commission per sold car</th>
    </tr>
    {% for row in summary %}
    <tr>
      <td>{{ row.Period }}</td>
      <td>{{ row['SD mottatt count'] }}</td>
      <td>{{ row['Mottatt count'] }}</td>
      <td>{{ row['Sold count'] }}</td>
      <td>{{ row['Avg Bud per sold car'] | int | format_number }} NOK</td>
      <td>{{ row['Avg Avgift per sold car'] | int | format_number }} NOK</td>
    </tr>
    {% endfor %}
  </table>

  <h2>Visual Overview</h2>
  <h3>Counts by Period</h3>
  <img src="{{ chart1 }}" alt="Counts chart">

  <h3>Average Values per Sold Car</h3>
  <img src="{{ chart2 }}" alt="Averages chart">

  <footer style="margin-top:40px; text-align:center; color:#777; font-size:0.9em;">
    Generated automatically • Data from report.xlsx
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

# Save to file
Path("report.html").write_text(html_content, encoding="utf-8")

print("Report saved as report.html")
print("Open the file in a browser to view table + charts.")
