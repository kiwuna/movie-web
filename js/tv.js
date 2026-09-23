async function catalogPage(){
  const grid=document.querySelector('#catalog-grid');
  if(!grid)return;
  loading(grid,20);
  const search=document.querySelector('#catalog-search'),
        genre=document.querySelector('#genre-filter'),
        year=document.querySelector('#year-filter'),
        sort=document.querySelector('#sort-filter'),
        paginationEl=document.querySelector('#pagination'),
        countEl=document.querySelector('#result-count'),
        emptyEl=document.querySelector('#empty-state');
  let currentPage=1,totalPages=1;

  try{
    const data=await getTVGenres();
    data.genres.forEach(g=>genre.add(new Option(g.name,g.id)));
    genre.value=new URLSearchParams(location.search).get('genre')||'';
    const currentYear=new Date().getFullYear();
    for(let y=currentYear;y>=1950;y--)year.add(new Option(y,y));
    year.value=new URLSearchParams(location.search).get('year')||'';

    function buildPagination(){
      if(!paginationEl)return;
      if(totalPages<=1){paginationEl.hidden=true;return;}
      paginationEl.hidden=false;
      const p=currentPage,tp=totalPages;
      const pages=new Set([1,tp,p,p-1,p-2,p+1,p+2].filter(n=>n>=1&&n<=tp));
      const sorted=[...pages].sort((a,b)=>a-b);
      let html=`<button class="pg-btn pg-prev" ${p===1?'disabled':''} onclick="goPage(${p-1})">‹ Prev</button>`;
      let prev=0;
      for(const n of sorted){
        if(prev&&n-prev>1)html+=`<span class="pg-ellipsis">…</span>`;
        html+=`<button class="pg-btn ${n===p?'pg-active':''}" onclick="goPage(${n})">${n}</button>`;
        prev=n;
      }
      html+=`<button class="pg-btn pg-next" ${p===tp?'disabled':''} onclick="goPage(${p+1})">Next ›</button>`;
      paginationEl.innerHTML=html;
    }

    async function render(page=1){
      currentPage=page;
      loading(grid,20);
      if(paginationEl)paginationEl.hidden=true;
      window.scrollTo({top:0,behavior:'smooth'});
      const params={
        sort_by:sort.value==='rating'?'vote_average.desc':sort.value==='newest'?'first_air_date.desc':'popularity.desc',
        with_genres:genre.value,
        first_air_date_year:year.value,
        page:currentPage
      };
      try{
        const d=await(search.value.trim()
          ?searchTV(search.value,{page:currentPage})
          :discoverTV(params));
        totalPages=Math.min(d.total_pages||1,500);
        grid.innerHTML=d.results.map(x=>card(x,'tv')).join('');
        countEl.textContent=`${d.total_results?.toLocaleString()||d.results.length} shows found — page ${currentPage} of ${totalPages}`;
        emptyEl.hidden=!!d.results.length;
        buildPagination();
      }catch(e){showError(grid,e.message)}
    }

    window.goPage=function(n){if(n<1||n>totalPages)return;render(n)};

    [search,genre,year,sort].forEach(el=>el.addEventListener('change',()=>render(1)));
    search.addEventListener('input',()=>{clearTimeout(search.timer);search.timer=setTimeout(()=>render(1),350)});
    document.querySelector('#clear-filters').onclick=()=>{search.value=genre.value=year.value='';render(1)};
    render(1);
  }catch(e){showError(grid,e.message)}
}

catalogPage();
