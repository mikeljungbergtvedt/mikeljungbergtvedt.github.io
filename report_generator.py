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

  // Period persistence
  const periodSelect = document.getElementById('periodSelect');

  // Load saved period (or default to 'Totalt' on first visit)
  const savedPeriod = localStorage.getItem('period') || 'Totalt';
  periodSelect.value = savedPeriod;  // Set dropdown to saved value

  // Initialize chart with the loaded/saved period
  updateDailyChart(savedPeriod);

  // Save new choice on change
  periodSelect.addEventListener('change', e => {
    const selected = e.target.value;
    localStorage.setItem('period', selected);
    updateDailyChart(selected);
  });
</script>
