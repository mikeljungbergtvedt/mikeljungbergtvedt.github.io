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
    if(diff<7)return diff+' dag'+(diff===1?'':'er')+' siden';
    if(diff<30){var w=Math.floor(diff/7);return w+' uke'+(w===1?'':'r')+' siden';}
    if(diff<365){var m=Math.floor(diff/30);return m+' m\u00e5ned'+(m===1?'':'er')+' siden';}
    var y=Math.floor(diff/365);return y+' \u00e5r siden';
  }
  function escHtml(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function stars(n,sz,gap){sz=sz||16;gap=gap||1;var full=Math.round(n),h='<div style="display:inline-flex;gap:'+gap+'px;align-items:center">';for(var i=0;i<full;i++)h+='<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.3L12 17.8 5.6 21.7l1.7-7.3L1.7 9.5l7.4-.6L12 2z"/></svg>';for(var j=full;j<5;j++)h+='<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="#e5e7eb"><path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.3L12 17.8 5.6 21.7l1.7-7.3L1.7 9.5l7.4-.6L12 2z"/></svg>';return h+'</div>';}
  function gLogo(sz){sz=sz||18;return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" style="vertical-align:middle;flex-shrink:0"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>';}
  function avatar(r){
    var name=r.authorAttribution.displayName||'?';
    var initial=name.charAt(0).toUpperCase();
    if(r.authorAttribution.photoUri)return '<img src="'+escHtml(r.authorAttribution.photoUri)+'" alt="" style="width:44px;height:44px;border-radius:999px;object-fit:cover;flex-shrink:0" referrerpolicy="no-referrer">';
    return '<div style="width:44px;height:44px;border-radius:999px;background:#fbbf24;color:#1f2937;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex-shrink:0">'+escHtml(initial)+'</div>';
  }
  function reviewCard(r){
    var t=r.text.text;
    if(t.length>240)t=t.slice(0,237).trim()+'\u2026';
    return '<article style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;display:flex;flex-direction:column;gap:18px;height:100%">'+
      stars(r.rating||5,18,2)+
      '<blockquote style="margin:0;font-size:16px;line-height:1.6;color:#1f2937;flex:1">'+escHtml(t)+'</blockquote>'+
      '<footer style="display:flex;align-items:center;gap:12px;border-top:1px solid #f3f4f6;padding-top:18px;margin:0">'+
        avatar(r)+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-weight:600;color:#1f2937;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escHtml(r.authorAttribution.displayName)+'</div>'+
          '<div style="font-size:13px;color:#9ca3af;display:flex;align-items:center;gap:6px;margin-top:2px">'+gLogo(13)+'<span>'+timeAgo(r.publishTime)+'</span></div>'+
        '</div>'+
      '</footer>'+
    '</article>';
  }
  function render(sec,reviews,rating,count){
    sec.innerHTML='';
    sec.style.cssText='padding:80px 20px;background:#faf6ec';
    var slice=reviews.slice(0,3);
    var wrap=document.createElement('div');
    wrap.style.cssText='max-width:1200px;margin:0 auto';
    wrap.innerHTML=
      '<header style="text-align:center;margin-bottom:48px">'+
        '<div style="display:inline-flex;align-items:center;gap:14px;background:#fff;padding:14px 24px;border-radius:999px;box-shadow:0 1px 3px rgba(0,0,0,0.06);margin-bottom:20px">'+
          gLogo(22)+
          '<span style="font-weight:600;color:#1f2937;font-size:15px">Anmeldelser p\u00e5 Google</span>'+
        '</div>'+
        '<h2 style="font-size:clamp(28px,4vw,42px);font-weight:700;color:#1f2937;margin:0 0 16px;letter-spacing:-0.02em">Tusenvis av norske bileiere har valgt Peasy</h2>'+
        '<div style="display:inline-flex;align-items:center;gap:12px;font-size:18px;color:#4b5563">'+
          stars(rating,22,2)+
          '<span><strong style="color:#1f2937">'+rating.toFixed(1).replace('.',',')+' av 5</strong> &middot; '+count+' anmeldelser</span>'+
        '</div>'+
      '</header>'+
      '<div id="prv-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-bottom:40px"></div>'+
      '<div style="text-align:center"><a href="'+GOOGLE_URL+'" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:10px;background:#1f2937;color:#fff;padding:16px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:16px;transition:background .15s" onmouseover="this.style.background=\'#000\'" onmouseout="this.style.background=\'#1f2937\'">Les alle '+count+' anmeldelser '+gLogo(18)+'</a></div>';
    sec.appendChild(wrap);
    var grid=wrap.querySelector('#prv-grid');
    grid.innerHTML=slice.map(reviewCard).join('');
    if(!document.getElementById('prv-style')){
      var s=document.createElement('style');
      s.id='prv-style';
      s.textContent='@media(max-width:900px){#hp_block_14 #prv-grid{grid-template-columns:1fr!important}}';
      document.head.appendChild(s);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
