(function(){
  var attempts=0;
  function init(){
    attempts++;
    var wrap=document.getElementById('peasy-faq-search-wrap');
    var faq=document.getElementById('faq');
    var items=faq?faq.querySelectorAll('.faq-item'):null;
    if(!wrap||!faq||!items||!items.length){
      if(attempts<60){setTimeout(init,300);return;}
      return;
    }
    if(wrap.dataset.inited)return;
    wrap.dataset.inited='1';
    wrap.innerHTML='<div id="peasy-faq-search"><svg class="pfs-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input type="search" id="pfs-input" placeholder="S\u00f8k i sp\u00f8rsm\u00e5l og svar..." autocomplete="off"><button class="pfs-clear" id="pfs-clear" aria-label="T\u00f8m s\u00f8k">&times;</button><div class="pfs-status" id="pfs-status"></div></div>';
    var faqList=faq.querySelector('[itemtype="https://schema.org/FAQPage"]');
    if(faqList&&faqList.parentElement)faqList.parentElement.insertBefore(wrap,faqList);
    var input=document.getElementById('pfs-input');
    var clearBtn=document.getElementById('pfs-clear');
    var status=document.getElementById('pfs-status');
    var data=[].map.call(items,function(item){
      var q=item.querySelector('[itemprop="name"]');
      var a=item.querySelector('[itemprop="text"]');
      var qOrig=q?q.innerHTML:'';
      var aOrig=a?a.innerHTML:'';
      var qText=q?q.textContent:'';
      var aText=a?a.textContent:'';
      return {item:item,q:q,a:a,qOrig:qOrig,aOrig:aOrig,search:(qText+' '+aText).toLowerCase()};
    });
    function escRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
    function highlight(html,terms){
      if(!terms.length)return html;
      var re=new RegExp('('+terms.map(escRe).join('|')+')','gi');
      var parts=html.split(/(<[^>]+>)/);
      for(var i=0;i<parts.length;i++){
        if(parts[i][0]!=='<')parts[i]=parts[i].replace(re,'<mark>$1</mark>');
      }
      return parts.join('');
    }
    function closeAll(){
      data.forEach(function(d){
        var head=d.item.querySelector('[data-accordion-head]');
        var body=d.item.querySelector('[data-accordion-body]');
        if(body&&!body.classList.contains('hidden')&&head)head.click();
      });
    }
    function reset(){
      data.forEach(function(d){
        d.item.classList.remove('pfs-hidden');
        if(d.q)d.q.innerHTML=d.qOrig;
        if(d.a)d.a.innerHTML=d.aOrig;
      });
      status.textContent='';
      clearBtn.style.display='none';
    }
    function search(query){
      query=query.trim();
      if(!query){reset();return;}
      clearBtn.style.display='block';
      var terms=query.toLowerCase().split(/\s+/).filter(function(t){return t.length>=2;});
      if(!terms.length){reset();return;}
      var matches=[];
      data.forEach(function(d){
        var hit=terms.every(function(t){return d.search.indexOf(t)!==-1;});
        if(hit){
          matches.push(d);
          d.item.classList.remove('pfs-hidden');
          if(d.q)d.q.innerHTML=highlight(d.qOrig,terms);
          if(d.a)d.a.innerHTML=highlight(d.aOrig,terms);
        }else{
          d.item.classList.add('pfs-hidden');
          if(d.q)d.q.innerHTML=d.qOrig;
          if(d.a)d.a.innerHTML=d.aOrig;
        }
      });
      if(matches.length===0){
        status.innerHTML='Ingen treff. Kontakt oss p\u00e5 <a href="mailto:post@peasy.no" style="color:#1f2937;font-weight:600;text-decoration:underline">post@peasy.no</a> s\u00e5 hjelper vi deg.';
      }else{
        status.textContent=matches.length+' treff';
        if(matches.length<=3){
          closeAll();
          setTimeout(function(){
            matches.forEach(function(m){
              var head=m.item.querySelector('[data-accordion-head]');
              if(head)head.click();
            });
          },50);
        }
      }
    }
    var t;
    input.addEventListener('input',function(e){
      clearTimeout(t);
      t=setTimeout(function(){search(e.target.value);},150);
    });
    clearBtn.addEventListener('click',function(){
      input.value='';reset();input.focus();
    });
    input.addEventListener('keydown',function(e){
      if(e.key==='Escape'){input.value='';reset();}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
