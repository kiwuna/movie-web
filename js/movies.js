async function loadHome(){
  const hero=document.querySelector('#hero');
  if(!hero)return;
  ['trending','popular-movies','popular-tv','now-playing','upcoming'].forEach(id=>loading(document.querySelector(`#${id}`)));
  try{
    const [trending,topRated,tv,now,upcoming]=await Promise.all([getTrendingMovies(),getTopRatedMovies(),getPopularTV(),getNowPlayingMovies(),getUpcomingMovies()]);
    
    // Load continue watching section
    const continueSection = document.querySelector('#continue-section');
    const continueRow = document.querySelector('#continue-watching');
    if(continueSection && continueRow){
      const history = getHistory();
      if(history.length > 0){
        continueRow.innerHTML = history.slice(0,10).map(item => card(item, item.media_type === 'tv' ? 'tv' : 'movie')).join('');
      }else{
        continueSection.hidden = true;
      }
    }
    const featuredItems=(trending.results||[]).slice(0,5);
    if(featuredItems.length){
      hero.innerHTML=`
        <div class="hero-slider">
          ${featuredItems.map((item,idx)=>`
            <div class="hero-slide ${idx===0?'active':''}" style="background-image:url('${imageUrl(item.backdrop_path,'original')}');">
              <div class="hero-content">
                <p class="eyebrow">${idx===0?'Featured premiere':'Trending spotlight'}</p>
                <h1>${titleOf(item)}</h1>
                <div class="meta">
                  <span>${yearOf(item)}</span>
                  <span class="rating">★ ${(item.vote_average||0).toFixed(1)}</span>
                </div>
                <p class="hero-description">${(item.overview||'Discover what everyone is talking about.').slice(0,150)}${(item.overview?.length>150)?'...':''}</p>
                <div class="hero-actions">
                  <a class="button primary" href="/details?id=${item.id}&type=movie#preview">
                    <img src="assets/Logos/play-button.png" alt="Play" class="btn-play-icon"> Watch preview
                  </a>
                  <a class="button secondary" href="/details?id=${item.id}&type=movie">More info</a>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="hero-nav">
          <button class="hero-arrow" id="hero-prev" aria-label="Previous featured movie">‹</button>
          <div class="hero-dots">
            ${featuredItems.map((_,idx)=>`<button class="hero-dot ${idx===0?'active':''}" data-index="${idx}" aria-label="Slide ${idx+1}"></button>`).join('')}
          </div>
          <button class="hero-arrow" id="hero-next" aria-label="Next featured movie">›</button>
        </div>
      `;
      let currentIdx=0;
      const slides=hero.querySelectorAll('.hero-slide');
      const dots=hero.querySelectorAll('.hero-dot');
      function showSlide(idx){
        currentIdx=(idx+slides.length)%slides.length;
        slides.forEach((s,i)=>s.classList.toggle('active',i===currentIdx));
        dots.forEach((d,i)=>d.classList.toggle('active',i===currentIdx));
      }
      let autoTimer=setInterval(()=>showSlide(currentIdx+1),6000);
      function resetTimer(){
        clearInterval(autoTimer);
        autoTimer=setInterval(()=>showSlide(currentIdx+1),6000);
      }
      hero.querySelector('#hero-prev').onclick=()=>{showSlide(currentIdx-1);resetTimer()};
      hero.querySelector('#hero-next').onclick=()=>{showSlide(currentIdx+1);resetTimer()};
      dots.forEach(dot=>dot.onclick=()=>{showSlide(Number(dot.dataset.index));resetTimer()});
    }
    document.querySelector('#trending').innerHTML=trending.results.slice(0,10).map(x=>card(x,'movie')).join('');
    document.querySelector('#popular-movies').innerHTML=topRated.results.slice(0,10).map(x=>card(x,'movie')).join('');
    document.querySelector('#popular-tv').innerHTML=tv.results.slice(0,10).map(x=>card(x,'tv')).join('');
    document.querySelector('#now-playing').innerHTML=now.results.slice(0,10).map(x=>card(x,'movie')).join('');
    document.querySelector('#upcoming').innerHTML=upcoming.results.slice(0,10).map(x=>card(x,'movie')).join('');
    const genres=await getMovieGenres();
    document.querySelector('#genres').innerHTML=genres.genres.map(g=>`<a class="genre" href="/movies?genre=${g.id}">${g.name}</a>`).join('');
    const extraData = await getPopularMovies();
    document.querySelector('#extra').innerHTML = extraData.results.slice(0,10).map(x => card(x,'movie')).join('');
    // Ensure scroll buttons for the new section
    setupRowScrollButtons();
    // Initialize genre tilt effect
    initGenreTilt();
  }catch(error){showError(hero,error.message)}
}

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

function initGenreTilt() {
  const genres = document.querySelectorAll('.genre');
  const maxTilt = 8;

  genres.forEach(genre => {
    let rafId = null;

    const onMouseMove = (e) => {
      const rect = genre.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const normalX = (x / rect.width) * 2 - 1;
      const normalY = (y / rect.height) * 2 - 1;

      const rotateX = -normalY * maxTilt;
      const rotateY = normalX * maxTilt;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        genre.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.05, 1.05, 1.05)`;
        genre.style.boxShadow = `${rotateY * -2}px ${rotateX * 2 + 20}px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(185, 232, 234, 0.15), 0 0 0 1px rgba(185, 232, 234, 0.4)`;
        
        const px = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const py = Math.max(0, Math.min(100, (y / rect.height) * 100));
        genre.style.setProperty('--shine-x', `${px.toFixed(1)}%`);
        genre.style.setProperty('--shine-y', `${py.toFixed(1)}%`);
      });
    };

    const onMouseEnter = () => {
      genre.style.transition = 'transform 0.12s ease-out, box-shadow 0.3s ease';
    };

    const onMouseLeave = () => {
      if (rafId) cancelAnimationFrame(rafId);
      genre.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.5s ease';
      genre.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      genre.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)';
    };

    genre.addEventListener('mousemove', onMouseMove);
    genre.addEventListener('mouseenter', onMouseEnter);
    genre.addEventListener('mouseleave', onMouseLeave);
  });
}

loadHome();catalogPage('movie');
