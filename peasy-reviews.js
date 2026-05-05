(function(){
  var URL='https://mikeljungbergtvedt.github.io/peasy-reviews.json';
  var GOOGLE_URL='https://www.google.com/maps/place/?q=place_id:ChIJTelCDZ_UdkYRT50OQBqRoB0';
  function init(){
    var sec=document.getElementById('hp_block_14');
    if(!sec)return;
    fetch(URL+'?cb='+Date.now()).then(function(r){return r.json();}).then(function(data){
      var reviews=(data.reviews||[]).filter(function(r){return r.text&&r.text.text;});
      if(!reviews.length)return;
      render(sec,reviews,data.rating||4.9,data.userRatingCount||reviews.length);
    }).catch(function(e){console.warn('reviews fetch failed',e);});
  }
  function timeAgo(iso){
    if(!iso)return '';
    var d=new Date(iso),diff=Math.floor((new Date()-d)/86400000);
    if(diff<7)return 'for '+diff+' dag'+(diff===1?'':'er')+' siden';
    if(diff<30)return 'for '+Math.floor(diff/7)+' uke'+(Math.floor(diff/7)===1?'':'r')+' siden';
    if(diff<365)return 'for '+Math.floor(diff/30)+' m\u00e5neder siden';
    return 'for '+Math.floor(diff/365)+' \u00e5r siden';
  }
  function escHtml(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function stars(n,sz){sz=sz||16;var full=Math.floor(n),html='';for(var i=0;i<full;i++)html+='<span style="color:#fbbf24;font-size:'+sz+'px">\u2605</span>';for(var j=full;j<5;j++)html+='<span style="color:#e5e7eb;font-size:'+sz+'px">\u2605</span>';return html;}
  function gLogo(){return '<svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align:middle"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>';}
  function reviewCard(r){
    var t=r.text.text;
    return '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:12px">'+
      '<div style="display:flex;align-items:center;gap:12px">'+
        (r.authorAttribution.photoUri?'<img src="'+escHtml(r.authorAttribution.photoUri)+'" alt="" style="width:40px;height:40px;border-radius:999px;object-fit:cover" referrerpolicy="no-referrer">':'<div style="width:40px;height:40px;border-radius:999px;background:#fbbf24;color:#1f2937;display:flex;align-items:center;justify-content:center;font-weight:700">'+escHtml((r.authorAttribution.displayName||'?').charAt(0))+'</div>')+
        '<div style="flex:1;min-width:0"><div style="font-weight:600;color:#1f2937">'+escHtml(r.authorAttribution.displayName)+'</div><div style="font-size:13px;color:#6b7280">'+timeAgo(r.publishTime)+'</div></div>'+
        '<div style="margin-left:auto">'+gLogo()+'</div>'+
      '</div>'+
      '<div>'+stars(r.rating||5,14)+'</div>'+
      '<div style="font-size:15px;line-height:1.55;color:#374151;flex:1">'+escHtml(t)+'</div>'+
    '</div>';
  }
  function render(sec,reviews,rating,count){
    sec.innerHTML='';
    sec.style.padding='60px 20px';
    var slice=reviews.slice(0,5);
    var wrap=document.createElement('div');
    wrap.style.cssText='max-width:1152px;margin:0 auto';
    wrap.innerHTML=
      '<div style="text-align:center;margin-bottom:40px">'+
        '<div style="font-size:14px;background:#e8f5e9;color:#1b5e20;padding:8px 20px;border-radius:999px;display:inline-block;margin-bottom:20px;font-weight:500">Hva kundene v\u00e5re sier om Peasy</div>'+
        '<div style="display:inline-flex;align-items:center;gap:16px;background:#faf6ec;padding:16px 28px;border-radius:999px;margin-top:8px">'+
          '<div style="font-size:42px;font-weight:700;color:#1f2937;line-height:1">'+rating.toFixed(1).replace('.',',')+'</div>'+
          '<div style="text-align:left">'+
            '<div style="line-height:1">'+stars(rating,20)+'</div>'+
            '<div style="font-size:14px;color:#6b7280;margin-top:4px">'+gLogo()+' '+count+' anmeldelser p\u00e5 Google</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div id="prv-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-bottom:32px"></div>'+
      '<div style="text-align:center"><a href="'+GOOGLE_URL+'" target="_blank" rel="noopener" style="display:inline-block;background:#fbbf24;color:#1f2937;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:16px">Les alle '+count+' anmeldelser p\u00e5 Google \u2192</a></div>';
    sec.appendChild(wrap);
    var grid=wrap.querySelector('#prv-grid');
    grid.innerHTML=slice.map(reviewCard).join('');
    var s=document.createElement('style');
    s.textContent='@media(max-width:900px){#hp_block_14 #prv-grid{grid-template-columns:1fr!important}}';
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
