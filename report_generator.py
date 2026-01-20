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
    let labels = [];

    if (period !== 'Totalt') {
      const daysBack = parseInt(period.split(' ')[1]);
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysBack);
      const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1); // yesterday
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      filteredData = dailyData.filter(d => d.date >= startStr && d.date <= endStr);

      // Force all dates in range (even 0) so axis always shows full period
      const allDates = [];
      let current = new Date(startDate);
      while (current <= endDate) {
        allDates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      // Merge with data, fill 0 for missing days
      const dataMap = new Map(filteredData.map(d => [d.date, d]));
      labels = allDates;
      const priset = allDates.map(date => dataMap.get(date)?.priset || 0);
      const mottatt = allDates.map(date => dataMap.get(date)?.mottatt || 0);
      const solgt = allDates.map(date => dataMap.get(date)?.solgt || 0);

      filteredData = allDates.map(date => ({ date, priset: dataMap.get(date)?.priset || 0, mottatt: dataMap.get(date)?.mottatt || 0, solgt: dataMap.get(date)?.solgt || 0 }));
    } else {
      labels = filteredData.map(d => d.date);
      const priset = filteredData.map(d => d.priset);
      const mottatt = filteredData.map(d => d.mottatt);
      const solgt = filteredData.map(d => d.solgt);
    }

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

  // Period persistence: default to 'Totalt' on first visit, remember last choice
  const periodSelect = document.getElementById('periodSelect');
  const savedPeriod = localStorage.getItem('period') || 'Totalt';
  periodSelect.value = savedPeriod;
  updateDailyChart(savedPeriod);

  // Save on change
  periodSelect.addEventListener('change', e => {
    const selected = e.target.value;
    localStorage.setItem('period', selected);
    updateDailyChart(selected);
  });
</script>
