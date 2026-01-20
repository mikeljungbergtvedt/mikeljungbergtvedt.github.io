# report_generator.py
# Requirements: pip install pandas openpyxl matplotlib jinja2 requests

import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
from pathlib import Path
import base64
from io import BytesIO
import jinja2
import json
import requests
import io

# CONFIG
REPORT_URL = "https://api.biladministrasjon.no/public/reports/peasy/dhqui7Hkl54?output=xlsx"
SHEET_NAME = "Sheet1"

TODAY = datetime.now()
YESTERDAY = TODAY - timedelta(days=1)
YESTERDAY_END = YESTERDAY.replace(hour=23, minute=59, second=59, microsecond=999999)

print(f"Today (run time): {TODAY.strftime('%Y-%m-%d %H:%M:%S CET')}")
print(f"Data included up to: {YESTERDAY.strftime('%Y-%m-%d')} (end of day)")

# Column names
COL_VALUED     = "SD mottatt på"    # priced/valued date
COL_RECEIVED   = "Mottatt"          # received date
COL_SOLD       = "Solgt på"         # sold date
COL_VALUE      = "Bud"              # value/bid
COL_COMMISSION = "Avgift"           # commission/fee

DATE_COLS = [COL_VALUED, COL_RECEIVED, COL_SOLD]
VALUE_COLS = [COL_VALUE, COL_COMMISSION]

PERIODS = {
    "Siste 7 dager":  YESTERDAY_END - timedelta(days=6),
    "Siste 30 dager": YESTERDAY_END - timedelta(days=29),
    "Siste 60 dager": YESTERDAY_END - timedelta(days=59),
    "Totalt": None
}

MARKETING_DAILY = 1000
MARKETING_START = datetime(2025, 11, 1)

# Download the latest Excel
print(f"Downloading report from: {REPORT_URL}")
response = requests.get(REPORT_URL)
response.raise_for_status()

# Load from memory
df = pd.read_excel(io.BytesIO(response.content), sheet_name=SHEET_NAME)
print("Columns in Excel:", df.columns.tolist())
print("\nFirst few rows (raw):\n", df.head(10).to_string())

# Parse dates - robust for DD.MM.YYYY (with or without HH:MM)
for col in DATE_COLS:
    df[col] = df[col].astype(str).str.strip()
    
    # Try full format with time first
    parsed = pd.to_datetime(df[col], format="%d.%m.%Y %H:%M", errors="coerce")
    
    # Fallback: date-only for failed rows
    mask_failed = parsed.isna()
    if mask_failed.any():
        parsed[mask_failed] = pd.to_datetime(
            df.loc[mask_failed, col].str[:10],
            format="%d.%m.%Y",
            errors="coerce"
        )
    
    # Log success rate
    valid_count = parsed.notna().sum()
    print(f"Parsed dates for {col}: {valid_count} / {len(df)} successful ({valid_count/len(df)*100:.1f}%)")
    
    df[col] = parsed

# Debug parsed dates
print("\nSample parsed dates (first 10 rows):")
print(df[DATE_COLS].head(10))

print("\nNumber of valid dates per column:")
for col in DATE_COLS:
    print(f"{col}: {df[col].notna().sum()} valid entries")

print("\nUnique sold dates (after parsing):")
print(sorted(df[COL_SOLD].dt.date.dropna().unique()))

# Parse numeric columns
for col in VALUE_COLS:
    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

# Exclude anything from today onwards (all date columns)
df = df[
    ((df[COL_VALUED].isna()) | (df[COL_VALUED] <= YESTERDAY_END)) &
    ((df[COL_RECEIVED].isna()) | (df[COL_RECEIVED] <= YESTERDAY_END)) &
    ((df[COL_SOLD].isna()) | (df[COL_SOLD] <= YESTERDAY_END))
]

print(f"\nRows after excluding today+: {len(df)}")

# Daily aggregation - count events per day
daily_valued = (
    df[df[COL_VALUED].notna()]
    .groupby(df[COL_VALUED].dt.date)
    .size()
    .rename('priset')
)

daily_received = (
    df[df[COL_RECEIVED].notna()]
    .groupby(df[COL_RECEIVED].dt.date)
    .size()
    .rename('mottatt')
)

daily_sold = (
    df[df[COL_SOLD].notna()]
    .groupby(df[COL_SOLD].dt.date)
    .size()
    .rename('solgt')
)

daily = pd.concat([daily_valued, daily_received, daily_sold], axis=1).fillna(0)
daily = daily.reset_index(names='date')
daily['date'] = daily['date'].astype(str)
daily_json = daily.to_json(orient='records')

# Period summaries - count cars where the event date is within period
results = []
for period_name, start_date in PERIODS.items():
    row = {"Period": period_name}
    
    if start_date is None:
        # Totalt: all rows with the event
        priset_count = df[COL_VALUED].notna().sum()
        mottatt_count = df[COL_RECEIVED].notna().sum()
        solgt_count = df[COL_SOLD].notna().sum()
    else:
        # Period: event date >= start and <= yesterday
        priset_count = ((df[COL_VALUED] >= start_date) & (df[COL_VALUED] <= YESTERDAY_END)).sum()
        mottatt_count = ((df[COL_RECEIVED] >= start_date) & (df[COL_RECEIVED] <= YESTERDAY_END)).sum()
        solgt_count = ((df[COL_SOLD] >= start_date) & (df[COL_SOLD] <= YESTERDAY_END)).sum()
    
    row["priset_count"] = priset_count
    row["mottatt_count"] = mottatt_count
    row["solgt_count"] = solgt_count
    row["priset_to_mottatt_pct"] = round(mottatt_count / priset_count * 100, 1) if priset_count > 0 else 0
    row["priset_to_solgt_pct"]   = round(solgt_count / priset_count * 100, 1) if priset_count > 0 else 0
    
    # Marketing cost
    if start_date is None:
        min_date = df[COL_VALUED].min()
        marketing_start_date = max(MARKETING_START.date(), min_date.date() if pd.notna(min_date) else YESTERDAY.date())
    else:
        marketing_start_date = max(MARKETING_START.date(), start_date.date())
    
    days = (YESTERDAY.date() - marketing_start_date).days + 1
    total_marketing = days * MARKETING_DAILY if days > 0 else 0
    row["marketing_per_solgt"] = round(total_marketing / solgt_count) if solgt_count > 0 else 0
    
    # Averages
    if start_date is None:
        sold_mask = df[COL_SOLD].notna()
    else:
        sold_mask = (df[COL_SOLD] >= start_date) & (df[COL_SOLD] <= YESTERDAY_END)
    
    sold = df[sold_mask]
    row["avg_value"] = sold[COL_VALUE].mean() if not sold.empty else 0
    row["avg_commission"] = sold[COL_COMMISSION].mean() if not sold.empty else 0
    
    results.append(row)

summary_df = pd.DataFrame(results)
summary_df[["avg_value", "avg_commission", "marketing_per_solgt"]] = \
    summary_df[["avg_value", "avg_commission", "marketing_per_solgt"]].round(0).astype(int)

# === Static Charts ===
def fig_to_base64(fig):
    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    buf.seek(0)
    return "data:image/png;base64," + base64.b64encode(buf.read()).decode("utf-8")

plt.style.use("ggplot")

# Chart 1: Counts per period
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

# Chart 2: Averages per sold car
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

# === HTML Template with updated JS ===
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
      canvas { height: 300px !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="lang-toggle">
      <a href="#" class="lang-link" data-lang="en">English</a> |
      <a href="#" class="lang-link active" data-lang="no">Norsk</a>
    </div>
    <h1 class="trans" data-en="Peasy Report" data-no="Peasy Rapport">Peasy Rapport</h1>
    <p class="subtitle trans" data-en="Snapshot date: {{ snapshot_date.strftime('%Y-%m-%d') }} (data up to yesterday)" data-no="Snapshot dato: {{ snapshot_date.strftime('%Y-%m-%d') }} (data opp til i går)">Snapshot dato: {{ snapshot_date.strftime('%Y-%m-%d') }} (data opp til i går)</p>

    <h2 class="trans" data-en="Summary Table" data-no="Sammendragstabell">Sammendragstabell</h2>
    <table>
      <tr>
        <th class="trans" data-en="Period" data-no="Periode">Periode</th>
        <th class="trans" data-en="Priset" data-no="Priset">Priset</th>
        <th class="trans" data-en="Mottatt" data-no="Mottatt">Mottatt</th>
        <th class="trans" data-en="Priset → Mottatt" data-no="Priset → Mottatt">Priset → Mottatt</th>
        <th class="trans" data-en="Solgt" data-no="Solgt">Solgt</th>
        <th class="trans" data-en="Priset → Solgt" data-no="Priset → Solgt">Priset → Solgt</th>
        <th class="trans" data-en="Marketing cost per sold car" data-no="Markedsføringskostnad per solgt bil">Markedsføringskostnad per solgt bil</th>
        <th class="trans" data-en="Avg Value per sold car" data-no="Gj.sn. Verdi per solgt bil">Gj.sn. Verdi per solgt bil</th>
        <th class="trans" data-en="Avg Commission per sold car" data-no="Gj.sn. Avgift per solgt bil">Gj.sn. Avgift per solgt bil</th>
      </tr>
      {% for row in summary %}
      <tr>
        <td>{{ row.Period }}</td>
        <td>{{ row.priset_count }}</td>
        <td>{{ row.mottatt_count }}</td>
        <td>{{ row.priset_to_mottatt_pct }} %</td>
        <td>{{ row.solgt_count }}</td>
        <td>{{ row.priset_to_solgt_pct }} %</td>
        <td>{{ row.marketing_per_solgt | int | format_number }} NOK</td>
        <td>{{ row.avg_value | int | format_number }} NOK</td>
        <td>{{ row.avg_commission | int | format_number }} NOK</td>
      </tr>
      {% endfor %}
    </table>

    <h2 class="trans" data-en="Visual Overview" data-no="Visuell oversikt">Visuell oversikt</h2>
    <h3 class="trans" data-en="Priset, Mottatt & Solgt Antall" data-no="Priset, Mottatt & Solgt Antall">Priset, Mottatt & Solgt Antall</h3>
    <img src="{{ chart1 }}" alt="Antall">
    <h3 class="trans" data-en="Gjennomsnitt per solgt bil" data-no="Gjennomsnitt per solgt bil">Gjennomsnitt per solgt bil</h3>
    <img src="{{ chart2 }}" alt="Gjennomsnitt">
    <h3 class="trans" data-en="Daily Trend (Priset, Mottatt, Solgt)" data-no="Daglig trend (Priset, Mottatt, Solgt)">Daglig trend (Priset, Mottatt, Solgt)</h3>
    <div id="dailyChartContainer">
      <label for="periodSelect" class="trans" data-en="Select period:" data-no="Velg periode:">Velg periode:</label>
      <select id="periodSelect">
        <option value="Totalt">Totalt</option>
        <option value="Siste 7 dager">Siste 7 dager</option>
        <option value="Siste 30 dager">Siste 30 dager</option>
        <option value="Siste 60 dager">Siste 60 dager</option>
      </select>
      <canvas id="dailyTrendChart"></canvas>
    </div>
    <footer>
      Generated automatically from report.xlsx (data up to yesterday)
      <p style="font-size:0.8em; color:#999; text-align:center;">Generated at {{ now }} (data up to yesterday)</p>
    </footer>
  </div>

  <script>
    const dailyData = {{ daily_json | safe }};
    const trans = document.querySelectorAll('.trans');

    // Language toggle
    document.querySelectorAll('.lang-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const lang = e.target.dataset.lang;
        localStorage.setItem('lang', lang);
        setLanguage(lang);
      });
    });

    function setLanguage(lang) {
      trans.forEach(el => {
        el.textContent = el.dataset[lang] || el.dataset.no;
      });
      document.querySelectorAll('.lang-link').forEach(a => a.classList.remove('active'));
      document.querySelector(`[data-lang="${lang}"]`).classList.add('active');
    }

    const savedLang = localStorage.getItem('lang') || 'no';
    setLanguage(savedLang);

    // Chart logic
    const ctx = document.getElementById('dailyTrendChart').getContext('2d');
    let dailyChart;

    function updateDailyChart(period) {
      let filteredData = dailyData;
      if (period !== 'Totalt') {
        const daysBack = parseInt(period.split(' ')[1]);
        const start = new Date();
        start.setDate(start.getDate() - daysBack);
        filteredData = dailyData.filter(d => new Date(d.date) >= start);
      }
      const labels = filteredData.map(d => d.date);
      const priset = filteredData.map(d => d.priset);
      const mottatt = filteredData.map(d => d.mottatt);
      const solgt = filteredData.map(d => d.solgt);

      if (dailyChart) dailyChart.destroy();
      dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            { label: 'Priset', data: priset, borderColor: '#004225', fill: false, tension: 0.1, borderWidth: 2 },
            { label: 'Mottatt', data: mottatt, borderColor: '#8fcbbc', fill: false, tension: 0.1, borderWidth: 2 },
            { label: 'Solgt', data: solgt, borderColor: '#ffcc33', fill: false, tension: 0.1, borderWidth: 2 }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'top' } },
          scales: { 
            x: { title: { display: true, text: 'Dato' } }, 
            y: { title: { display: true, text: 'Antall' }, beginAtZero: true } 
          }
        }
      });
    }

    // Period persistence: default to 'Totalt' on first visit, remember choice otherwise
    const periodSelect = document.getElementById('periodSelect');
    const savedPeriod = localStorage.getItem('period') || 'Totalt';
    periodSelect.value = savedPeriod;  // Set dropdown to saved/default value

    // Initialize chart with the loaded/saved period
    updateDailyChart(savedPeriod);

    // Save new choice on change
    periodSelect.addEventListener('change', e => {
      const selected = e.target.value;
      localStorage.setItem('period', selected);
      updateDailyChart(selected);
    });
  </script>
</body>
</html>
"""

env = jinja2.Environment()
env.filters["format_number"] = lambda x: f"{x:,}".replace(',', ' ')
template = env.from_string(template_str)

html_content = template.render(
    snapshot_date=YESTERDAY,
    now=datetime.now().strftime("%Y-%m-%d %H:%M:%S CET"),
    summary=summary_df.to_dict("records"),
    chart1=chart1_b64,
    chart2=chart2_b64,
    daily_json=daily_json
)

Path("test.html").write_text(html_content, encoding="utf-8")
print("Report saved as test.html")
print("Done.")
