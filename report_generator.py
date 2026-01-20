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
    <p class="subtitle trans" data-en="Snapshot date: {{ today.strftime('%Y-%m-%d') }} Last updated: {{ now }}" data-no="Snapshot dato: {{ today.strftime('%Y-%m-%d') }} Sist oppdatert: {{ now }}">Snapshot dato: {{ today.strftime('%Y-%m-%d') }} Sist oppdatert: {{ now }}</p>

    <h2 class="trans" data-en="Summary Table" data-no="Sammendragstabell">Sammendragstabell</h2>
    <table>
      <tr>
        <th class="trans" data-en="Period" data-no="Periode">Periode</th>
        <th class="trans" data-en="Valued" data-no="Priset">Priset</th>
        <th class="trans" data-en="Received" data-no="Mottatt">Mottatt</th>
        <th class="trans" data-en="Valued → Received" data-no="Priset → Mottatt">Priset → Mottatt</th>
        <th class="trans" data-en="Sold" data-no="Solgt">Solgt</th>
        <th class="trans" data-en="Valued → Sold" data-no="Priset → Solgt">Priset → Solgt</th>
        <th class="trans" data-en="Marketing cost per sold car" data-no="Markedsføringskostnad per solgt bil">Markedsføringskostnad per solgt bil</th>
        <th class="trans" data-en="Avg Value per sold car" data-no="Gj.sn. Verdi per solgt bil">Gj.sn. Verdi per solgt bil</th>
        <th class="trans" data-en="Avg Commission per sold car" data-no="Gj.sn. Avgift per solgt bil">Gj.sn. Avgift per solgt bil</th>
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
        <td>{{ row['avg_value'] | int | format_number }} NOK</td>
        <td>{{ row['avg_commission'] | int | format_number }} NOK</td>
      </tr>
      {% endfor %}
    </table>

    <h2 class="trans" data-en="Visual Overview" data-no="Visuell oversikt">Visuell oversikt</h2>
    <h3 class="trans" data-en="Valued, Received & Sold Counts" data-no="Priset, Mottatt & Solgt Antall">Priset, Mottatt & Solgt Antall</h3>
    <img src="{{ chart1 }}" alt="Antall">

    <h3 class="trans" data-en="Average Values per Sold Car" data-no="Gjennomsnitt per solgt bil">Gjennomsnitt per solgt bil</h3>
    <img src="{{ chart2 }}" alt="Gjennomsnitt">

    <h3 class="trans" data-en="Daily Trend (Priset, Received, Sold)" data-no="Daglig trend (Priset, Mottatt, Solgt)">Daglig trend (Priset, Mottatt, Solgt)</h3>
    <div id="dailyChartContainer">
      <label for="periodSelect" class="trans" data-en="Select period:" data-no="Velg periode:">Velg periode:</label>
      <select id="periodSelect">
        <option value="Siste 7 dager">Siste 7 dager</option>
        <option value="Siste 30 dager">Siste 30 dager</option>
        <option value="Siste 60 dager">Siste 60 dager</option>
        <option value="Totalt">Totalt</option>
      </select>
      <canvas id="dailyTrendChart"></canvas>
    </div>

    <footer>
      Generated automatically from report.xlsx
    </footer>
  </div>

  <script>
    const dailyData = {{ daily_json | safe }};
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
    // Interactive daily trend chart
    const ctx = document.getElementById('dailyTrendChart').getContext('2d');
    let dailyChart;
    function updateDailyChart(period) {
      let filteredData = dailyData;
      if (period !== 'Totalt') {
        const start = new Date();
        start.setDate(start.getDate() - parseInt(period.split(' ')[1]));
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
          scales: { x: { title: { display: true, text: 'Dato' } }, y: { title: { display: true, text: 'Antall' }, beginAtZero: true } }
        }
      });
    }
    document.getElementById('periodSelect').addEventListener('change', e => {
      updateDailyChart(e.target.value);
    });
    updateDailyChart('Siste 30 dager');
  </script>
</body>
</html>
"""
