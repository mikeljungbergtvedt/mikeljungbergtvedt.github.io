(function(){
  var URL='https://mikeljungbergtvedt.github.io/peasy-reviews.json';
  var ROTATE_MS=6000;
  function init(){
    var sec=document.getElementById('hp_block_14');
    if(!sec)return;
    fetch(URL+'?cb='+Date.now()).then(function(r){return r.json();}).then(function(data){
      var reviews=(data.reviews||[]).filter(function(r){return r.text&&r.text.text;});
      if(!reviews.length)return;
      var rating=data.rating||4.9;
      var count=data.userRatingCount||reviews.length;
      render(sec,reviews,rating,count);
    }).catch(function(e){console.warn('reviews fetch failed',e);});
  }
  function timeAgo(iso){
    if(!iso)return '';
    var d=new Date(iso);var now=new Date();var diff=Math.floor((now-d)/86400000);
    if(diff<7)return 'for '+diff+' dag'+(diff===1?'':'er')+' siden';
    if(diff<30)return 'for '+Math.floor(diff/7)+' uke'+(Math.floor(diff/7)===1?'':'r')+' siden';
    if(diff<365)return 'for '+Math.floor(diff/30)+' m\u00e5neder siden';
    return 'for '+Math.floor(diff/365)+' \u00e5r siden';
  }
  function escHtml(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function stars(n){var full=Math.floor(n);var html='';for(var i=0;i<full;i++)html+='<span style="color:#fbbf24">\u2605</span>';for(var j=full;j<5;j++)html+='<span style="color:#e5e7eb">\u2605</span>';return html;}
  function render(sec,reviews,rating,count){
    sec.innerHTML='';
    sec.style.padding='40px 20px';
    var wrap=document.createElement('div');
    wrap.style.cssText='max-width:1152px;margin:0 auto;background:#faf6ec;border-radius:24px;padding:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center';
    wrap.innerHTML=
      '<div><div style="font-size:14px;background:#e8f5e9;color:#1b5e20;padding:6px 16px;border-radius:999px;display:inline-block;margin-bottom:24px">Hva kundene v\u00e5re sier om Peasy</div>'+
      '<div style="font-size:28px;letter-spacing:2px;margin-bottom:32px">'+stars(rating)+'</div>'+
      '<div id="prv-quotes" style="min-height:280px;transition:opacity .4s"></div>'+
      '<div style="display:flex;align-items:center;gap:12px;margin-top:24px;padding-top:24px;border-top:1px solid #e5e7eb">'+
        '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>'+
        '<a href="https://www.google.com/maps/place/?q=place_id:ChIJTelCDZ_UdkYRT50OQBqRoB0" target="_blank" rel="noopener" style="color:#1f2937;font-weight:600;text-decoration:none">'+
          rating.toFixed(1).replace('.',',')+' / 5 p\u00e5 Google &middot; '+count+' anmeldelser'+
        '</a>'+
      '</div></div>'+
      '<div style="position:relative"><img src="/wp-content/uploads/2025/01/peasy-customer-2.jpg" alt="" style="width:100%;border-radius:16px;display:block" onerror="this.style.display=\'none\'"><div style="position:absolute;bottom:24px;right:24px;font-size:120px;line-height:1;color:#e5e7eb;opacity:.4;font-family:Georgia,serif">\u201D</div></div>';
    sec.appendChild(wrap);
    var box=wrap.querySelector('#prv-quotes');
    var idx=0;
    function show(){
      var slice=[];
      for(var i=0;i<3;i++)slice.push(reviews[(idx+i)%reviews.length]);
      box.style.opacity='0';
      setTimeout(function(){
        box.innerHTML=slice.map(function(r){
          var t=r.text.text;if(t.length>160)t=t.slice(0,157)+'\u2026';
          return '<div style="margin-bottom:18px"><div style="font-size:16px;line-height:1.5;color:#1f2937;margin-bottom:6px">\u201C'+escHtml(t)+'\u201D</div><div style="font-size:14px;color:#6b7280">\u2014 '+escHtml(r.authorAttribution.displayName)+' \u00b7 '+timeAgo(r.publishTime)+'</div></div>';
        }).join('');
        box.style.opacity='1';
      },400);
      idx=(idx+1)%reviews.length;
    }
    show();
    if(reviews.length>3)setInterval(show,ROTATE_MS);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
