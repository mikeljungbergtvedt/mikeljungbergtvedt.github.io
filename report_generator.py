# report_generator.py
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
from pathlib import Path
import base64
from io import BytesIO
import jinja2

# CONFIG
FILE_PATH = "report.xlsx"
SHEET_NAME = "Sheet1"

TODAY = datetime.now()

COL_PRISET = "SD mottatt på"
COL_MOTTATT = "Mottatt"
COL_SOLGT = "Solgt på"
COL_BUD = "Bud"
COL_AVGIFT = "Avgift"
COL_MERKE = "Merke"

DATE_COLS = [COL_PRISET, COL_MOTTATT, COL_SOLGT]
VALUE_COLS = [COL_BUD, COL_AVGIFT]

PERIODS = {
    "Last 30 days": TODAY - timedelta(days=30),
    "Last 60 days": TODAY - timedelta(days=60),
    "Total": None
}

MARKETING_DAILY = 1000
MARKETING_START = datetime(2025, 11, 1)
DAILY_TARGET = 10

df = pd.read_excel(FILE_PATH, sheet_name=SHEET_NAME)

for col in DATE_COLS:
    df[col] = df[col].astype(str).str.strip()
    parsed = pd.to_datetime(df[col], format="%d.%m.%Y %H:%M", errors="coerce")
    mask = parsed.isna()
    if mask.any():
        parsed[mask] = pd.to_datetime(df.loc[mask, col].str[:10], format="%d.%m.%Y", errors="coerce")
    df[col] = parsed

for col in VALUE_COLS:
    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

results = []

for period_name, start_date in PERIODS.items():
    row = {"Period": period_name}
    
    priset_count = df[COL_PRISET].notna().sum() if start_date is None else df[(df[COL_PRISET] >= start_date) & df[COL_PRISET].notna()].shape[0]
    mottatt_count = df[COL_MOTTATT].notna().sum() if start_date is None else df[(df[COL_MOTTATT] >= start_date) & df[COL_MOTTATT].notna()].shape[0]
    solgt_count = df[COL_SOLGT].notna().sum() if start_date is None else df[(df[COL_SOLGT] >= start_date) & df[COL_SOLGT].notna()].shape[0]
    
    row["priset_count"] = priset_count
    row["mottatt_count"] = mottatt_count
    row["solgt_count"] = solgt_count
    
    row["priset_to_mottatt_pct"] = round(mottatt_count / priset_count * 100, 1) if priset_count > 0 else 0
    row["priset_to_solgt_pct"] = round(solgt_count / priset_count * 100, 1) if priset_count > 0 else 0
    
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
    
    sold_mask = df[COL_SOLGT].notna()
    if start_date is not None:
        sold_mask &= (df[COL_SOLGT] >= start_date)
    sold = df[sold_mask]
    
    row["avg_bud"] = sold[COL_BUD].mean() if not sold.empty else 0
    row["avg_avgift"] = sold[COL_AVGIFT].mean() if not sold.empty else 0
    
    if start_date is None:
        period_days = (TODAY.date() - df[COL_PRISET].min().date()).days + 1
    else:
        period_days = (TODAY.date() - start_date.date()).days + 1
    row["avg_daily_priset"] = round(priset_count / period_days, 1) if period_days > 0 else 0
    
    results.append(row)

summary_df = pd.DataFrame(results)
summary_df[["avg_bud", "avg_avgift", "marketing_per_solgt"]] = summary_df[["avg_bud", "avg_avgift", "marketing_per_solgt"]].round(0).astype(int)

# Previous avg for highlight
previous_avg = summary_df.loc[summary_df['Period'] == "Last 60 days", 'avg_daily_priset'].values[0] if len(summary_df) > 1 else 0
last30_avg = summary_df.loc[summary_df['Period'] == "Last 30 days", 'avg_daily_priset'].values[0]

# Daily Priset→Solgt % last 7 days for sparkline
last7_start = TODAY - timedelta(days=6)
daily_priset = df[(df[COL_PRISET] >= last7_start) & df[COL_PRISET].notna()].groupby(df[COL_PRISET].dt.date).size()
daily_solgt = df[(df[COL_SOLGT] >= last7_start) & df[COL_SOLGT].notna()].groupby(df[COL_SOLGT].dt.date).size()
daily_dates = pd.date_range(last7_start.date(), TODAY.date())
daily_priset = daily_priset.reindex(daily_dates.date, fill_value=0)
daily_solgt = daily_solgt.reindex(daily_dates.date, fill_value=0)
daily_conversion = [round(s / p * 100, 1) if p > 0 else 0 for p, s in zip(daily_priset, daily_solgt)]

# Bottleneck Alert
last30_priset = summary_df.loc[summary_df['Period'] == "Last 30 days", 'priset_count'].values[0]
last30_mottatt = summary_df.loc[summary_df['Period'] == "Last 30 days", 'mottatt_count'].values[0]
bottleneck_alert = "Lav konvertering til lager – sjekk prosess!" if last30_mottatt < 0.5 * last30_priset else ""

# Sold Velocity
sold_velocity_mask = df[COL_PRISET].notna() & df[COL_SOLGT].notna()
velocity_days = (df.loc[sold_velocity_mask, COL_SOLGT] - df.loc[sold_velocity_mask, COL_PRISET]).dt.days.mean()
sold_velocity = round(velocity_days, 1) if not pd.isna(velocity_days) else 0

# Top Brands Sold
top_brands = df[df[COL_SOLGT].notna()]['Merke'].value_counts().head(5).to_dict()

# Target % 
target_pct = round(last30_avg / DAILY_TARGET * 100, 1)

# Charts
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

for i, v in enumerate(summary_df["priset_count"]):
    ax1.text(i - width, v + 5, str(v), ha='center', va='bottom', fontsize=9)
for i, v in enumerate(summary_df["mottatt_count"]):
    ax1.text(i, v + 5, str(v), ha='center', va='bottom', fontsize=9)
for i, v in enumerate(summary_df["solgt_count"]):
    ax1.text(i + width, v + 5, str(v), ha='center', va='bottom', fontsize=9)

ax1.set_xticks(positions)
ax1.set_xticklabels(summary_df["Period"], rotation=15, ha='center')
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

for i, v in enumerate(summary_df["avg_bud"]):
    ax2.text(i - width/2, v + 1000, f"{v:,}", ha='center', va='bottom', fontsize=10)
for i, v in enumerate(summary_df["avg_avgift"]):
    ax2.text(i + width/2, v + 1000, f"{v:,}", ha='center', va='bottom', fontsize=10)

ax2.set_xticks(positions)
ax2.set_xticklabels(summary_df["Period"], rotation=15, ha='center')
ax2.set_ylabel("NOK")
ax2.legend()
chart2_b64 = fig_to_base64(fig2)
plt.close(fig2)

# Sparkline for last 7 days conversion
fig_spark, ax_spark = plt.subplots(figsize=(4, 1))
ax_spark.plot(daily_conversion, color='#ffcc33', linewidth=2.5)
ax_spark.axis('off')
spark_b64 = fig_to_base64(fig_spark)
plt.close(fig_spark)

# Pie chart for top brands
fig_pie, ax_pie = plt.subplots(figsize=(8, 5))
counts = list(top_brands.values())
labels = list(top_brands.keys())
ax_pie.pie(counts, labels=labels, autopct='%1.0f%%', startangle=90, colors=['#004225', '#ffcc33', '#8fcbbc', '#d4edda', '#f5f9f6'])
ax_pie.set_title("Top 5 solgte merker (total)")
pie_b64 = fig_to_base64(fig_pie)
plt.close(fig_pie)

# HTML template
template_str = """
<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Peasy Rapport</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #e0e9e5; color: #004225; }
    .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.08); }
    h1 { text-align: center; color: #004225; font-size: 2rem; margin-bottom: 10px; }
    .subtitle { text-align: center; font-size: 1.3rem; margin-bottom: 20px; color: #004225; }
    .lang-toggle { text-align: center; margin-bottom: 15px; font-size: 1.1rem; }
    .lang-toggle a { margin: 0 8px; text-decoration: none; color: #004225; }
    .lang-toggle a.active { color: #ffcc33; border-bottom: 2px solid #ffcc33; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { padding: 10px; text-align: right; border: 1px solid #ddd; font-weight: bold; }
    th { background: #004225; color: #ffcc33; }
    td { background: white; }
    tr.total-row td { background: #e8f5e9; font-weight: bold; }
    .highlight-green { background: #d4edda !important; }
    .highlight-red { background: #f8d7da !important; }
    .alert { text-align: center; color: red; font-weight: bold; margin: 20px 0; font-size: 1.2rem; }
    img { max-width: 100%; height: auto; margin: 20px 0; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .sparkline { height: 50px; vertical-align: middle; }
    .info-line { text-align: center; font-weight: bold; margin: 15px 0; font-size: 1.1rem; }
    @media (max-width: 768px) {
      h1 { font-size: 1.6rem; }
      .subtitle { font-size: 1.1rem; }
      table { font-size: 0.9rem; overflow-x: auto; display: block; }
      .info-line { font-size: 1rem; }
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
    <p class="subtitle trans" data-en="Snapshot date: {{ today.strftime('%Y-%m-%d') }} Last updated: {{ now }}" data-no="Snapshot dato: {{ today.strftime('%Y-%m-%d') }} Sist oppdatert: {{ now }}">Snapshot dato: {{ today.strftime('%Y-%m-%d') }} Sist oppdatert: {{ now }}</p>

    {% if bottleneck_alert %}
    <div class="alert">{{ bottleneck_alert }}</div>
    {% endif %}

    <h2 class="trans" data-en="Summary Table" data-no="Sammendragstabell">Sammendragstabell</h2>
    <table>
      <tr>
        <th class="trans" data-en="Period" data-no="Periode">Periode</th>
        <th class="trans" data-en="Priset" data-no="Priset">Priset</th>
        <th class="trans" data-en="Mottatt" data-no="Mottatt">Mottatt</th>
        <th class="trans" data-en="Priset → Mottatt" data-no="Priset → Mottatt">Priset → Mottatt</th>
        <th class="trans" data-en="Sold" data-no="Solgt">Solgt</th>
        <th class="trans" data-en="Priset → Solgt" data-no="Priset → Solgt">Priset → Solgt</th>
        <th class="trans" data-en="Marketing cost per sold car" data-no="Markedsføringskostnad per solgt bil">Markedsføringskostnad per solgt bil</th>
        <th class="trans" data-en="Avg Bud per sold car" data-no="Gj.sn. Bud per solgt bil">Gj.sn. Bud per solgt bil</th>
        <th class="trans" data-en="Avg Commission per sold car" data-no="Gj.sn. Avgift per solgt bil">Gj.sn. Avgift per solgt bil</th>
        <th class="trans" data-en="Avg daily Priset" data-no="Gj.sn. daglig Priset">Gj.sn. daglig Priset</th>
      </tr>
      {% for row in summary %}
      <tr {% if row.Period == "Last 30 days" %}class="{% if row.avg_daily_priset > previous_avg %}highlight-green{% else %}highlight-red{% endif %}"{% endif %}>
        <td>{{ row.Period }}</td>
        <td>{{ row['priset_count'] }}</td>
        <td>{{ row['mottatt_count'] }}</td>
        <td>{{ row['priset_to_mottatt_pct'] }} %</td>
        <td>{{ row['solgt_count'] }}</td>
        <td>{{ row['priset_to_solgt_pct'] }} %</td>
        <td>{{ row['marketing_per_solgt'] | int | format_number }} NOK</td>
        <td>{{ row['avg_bud'] | int | format_number }} NOK</td>
        <td>{{ row['avg_avgift'] | int | format_number }} NOK</td>
        <td>{{ row['avg_daily_priset'] }}</td>
      </tr>
      {% endfor %}
    </table>

    <div class="info-line">
      <span class="trans" data-en="Last 7 days Priset→Solgt conversion:" data-no="Siste 7 dager Priset→Solgt konvertering:">Siste 7 dager Priset→Solgt konvertering:</span>
      <img class="sparkline" src="{{ spark }}" alt="Sparkline">
    </div>

    <div class="info-line">
      <span class="trans" data-en="Average days from Priset to Sold:" data-no="Gjennomsnittlige dager fra Priset til Solgt:">Gjennomsnittlige dager fra Priset til Solgt:</span> {{ sold_velocity }} dager
    </div>

    <div class="info-line">
      <span class="trans" data-en="Last 30 days target achievement (10/day):" data-no="Siste 30 dager måloppnåelse (10/dag):">Siste 30 dager måloppnåelse (10/dag):</span> {{ target_pct }} %
    </div>

    <h2 class="trans" data-en="Visual Overview" data-no="Visuell oversikt">Visuell oversikt</h2>
    <h3 class="trans" data-en="Counts by Period" data-no="Antall per periode">Antall per periode</h3>
    <img src="{{ chart1 }}" alt="Counts">

    <h3 class="trans" data-en="Average Values per Sold Car" data-no="Gjennomsnitt per solgt bil">Gjennomsnitt per solgt bil</h3>
    <img src="{{ chart2 }}" alt="Averages">

    <h3 class="trans" data-en="Top 5 Sold Brands (Total)" data-no="Top 5 solgte merker (total)">Top 5 solgte merker (total)</h3>
    <img src="{{ pie }}" alt="Top brands">

    <footer>
      Generated automatically from report.xlsx
    </footer>
  </div>

  <script>
    const trans = document.querySelectorAll('.trans');
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
  </script>
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
    chart2=chart2_b64,
    spark=spark_b64,
    pie=pie_b64,
    bottleneck_alert=bottleneck_alert,
    sold_velocity=sold_velocity,
    target_pct=target_pct,
    previous_avg=previous_avg
)

# Force commit every time
html_content = html_content.replace(
    '</footer>',
    f'<p style="font-size:0.8em; color:#999; text-align:center;">Generated at {datetime.now().strftime("%Y-%m-%d %H:%M:%S CET")}</p></footer>'
)

Path("test.html").write_text(html_content, encoding="utf-8")

print("Report saved as test.html")
