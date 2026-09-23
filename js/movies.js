async function loadHome(){const hero=document.querySelector('#hero');if(!hero)return;['trending','popular-movies','popular-tv','now-playing','upcoming'].forEach(id=>loading(document.querySelector(`#${id}`)));try{const [trending,popular,tv,now,upcoming]=await Promise.all([getTrendingMovies(),getPopularMovies(),getPopularTV(),getNowPlayingMovies(),getUpcomingMovies()]);const featured=trending.results[0];hero.style.backgroundImage=`url('${imageUrl(featured.backdrop_path,'original')}')`;hero.innerHTML=`<div class="hero-content"><p class="eyebrow">Featured premiere</p><h1>${titleOf(featured)}</h1><div class="meta"><span>${yearOf(featured)}</span><span class="rating">★ ${featured.vote_average.toFixed(1)}</span></div><p class="hero-description">${featured.overview||'Discover what everyone is talking about.'}</p><div class="hero-actions"><a class="button primary" href="details.html?id=${featured.id}&type=movie#preview"><img src="assets/Logos/play-button.png" alt="Play" class="btn-play-icon"> Watch preview</a><a class="button secondary" href="details.html?id=${featured.id}&type=movie">More info</a></div></div>`;document.querySelector('#trending').innerHTML=trending.results.slice(0,10).map(x=>card(x,'movie')).join('');document.querySelector('#popular-movies').innerHTML=popular.results.slice(0,10).map(x=>card(x,'movie')).join('');document.querySelector('#popular-tv').innerHTML=tv.results.slice(0,10).map(x=>card(x,'tv')).join('');document.querySelector('#now-playing').innerHTML=now.results.slice(0,10).map(x=>card(x,'movie')).join('');document.querySelector('#upcoming').innerHTML=upcoming.results.slice(0,10).map(x=>card(x,'movie')).join('');const genres=await getMovieGenres();document.querySelector('#genres').innerHTML=genres.genres.map(g=>`<a class="genre" href="movies.html?genre=${g.id}">${g.name}</a>`).join('')}catch(error){showError(hero,error.message)}}

async function catalogPage(type){
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
  const genreId=new URLSearchParams(location.search).get('genre')||'';
  let currentPage=1,totalPages=1;

  try{
    const genreData=await(type==='movie'?getMovieGenres():getTVGenres());
    genreData.genres.forEach(g=>genre.add(new Option(g.name,g.id)));
    genre.value=genreId;
    const currentYear=new Date().getFullYear();
    for(let y=currentYear;y>=1950;y--)year.add(new Option(y,y));
    year.value=new URLSearchParams(location.search).get('year')||'';

    function buildPagination(){
      if(totalPages<=1){paginationEl.hidden=true;return;}
      paginationEl.hidden=false;
      const p=currentPage,tp=totalPages;
      // show up to 7 page slots: always first, last, current±2, with ellipsis
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
      paginationEl.hidden=true;
      window.scrollTo({top:0,behavior:'smooth'});
      const params={
        sort_by:sort.value==='rating'?'vote_average.desc':sort.value==='newest'?(type==='movie'?'primary_release_date.desc':'first_air_date.desc'):'popularity.desc',
        with_genres:genre.value,
        year:year.value,
        page:currentPage
      };
      try{
        const data=await(search.value.trim()
          ?(type==='movie'?searchMovies(search.value,{page:currentPage}):searchTV(search.value,{page:currentPage}))
          :(type==='movie'?discoverMovies(params):discoverTV(params)));
        totalPages=Math.min(data.total_pages||1,500);
        grid.innerHTML=data.results.map(x=>card(x,type)).join('');
        countEl.textContent=`${data.total_results?.toLocaleString()||data.results.length} ${type==='movie'?'movies':'shows'} found — page ${currentPage} of ${totalPages}`;
        emptyEl.hidden=!!data.results.length;
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

loadHome();catalogPage('movie');
