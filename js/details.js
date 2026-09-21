const params = new URLSearchParams(location.search),
  id = params.get('id'),
  type = params.get('type') === 'tv' ? 'tv' : 'movie',
  root = document.querySelector('#details');

let currentMedia = null;
let currentSource = 'vidsrc'; // 'vidsrc' | 'vidapi' | 'trailer'
let currentSeason = 1;
let currentEpisode = 1;

function castList(data) {
  return (data.credits?.cast || []).slice(0, 6).map(p => p.name).join(', ') || 'Not available';
}

function recommendations(data) {
  const items = (data.recommendations?.results || data.similar?.results || []).slice(0, 6);
  return items.length ? `<section class="content-section"><div class="section-heading"><h2>You may also like</h2></div><div class="card-row">${items.map(x => card(x, type)).join('')}</div></section>` : '';
}

function getVidSrcUrl(mediaId, mediaType, season = 1, episode = 1) {
  const progressKey = `progress_${mediaId}${mediaType === 'tv' ? `_s${season}_e${episode}` : ''}`;
  const saved = localStorage.getItem(progressKey) || localStorage.getItem(`progress_${mediaId}`);
  const startParam = saved && parseFloat(saved) > 10 ? `&startAt=${Math.floor(parseFloat(saved))}` : '';

  if (mediaType === 'tv') {
    return `https://vidsrc.sh/embed/tv/${mediaId}/${season}/${episode}?autoplay=1&autonext=1${startParam}`;
  }
  return `https://vidsrc.sh/embed/movie/${mediaId}?autoplay=1${startParam}`;
}

function getVidApiUrl(mediaId, mediaType, season = 1, episode = 1) {
  if (mediaType === 'tv') {
    return `https://vaplayer.ru/embed/tv/${mediaId}/${season}/${episode}`;
  }
  return `https://vaplayer.ru/embed/movie/${mediaId}`;
}

function updatePlayer(source, s = currentSeason, ep = currentEpisode) {
  currentSource = source;
  currentSeason = s;
  currentEpisode = ep;

  const playerSection = document.querySelector('#player-section');
  const playerIframe = document.querySelector('#media-player');
  const playerTitle = document.querySelector('#player-title');
  const sourceVidsrcBtn = document.querySelector('#source-vidsrc');
  const sourceVidapiBtn = document.querySelector('#source-vidapi');
  const sourceTrailerBtn = document.querySelector('#source-trailer');

  if (!playerIframe || !currentMedia) return;

  // Reveal player section when watch/episode/source is clicked
  if (playerSection) {
    playerSection.classList.remove('player-hidden');
  }

  const trailer = (currentMedia.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
    || (currentMedia.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer');

  // Reset active classes on source buttons
  if (sourceVidsrcBtn) sourceVidsrcBtn.classList.remove('active');
  if (sourceVidapiBtn) sourceVidapiBtn.classList.remove('active');
  if (sourceTrailerBtn) sourceTrailerBtn.classList.remove('active');

  if (source === 'vidsrc') {
    playerIframe.src = getVidSrcUrl(currentMedia.id, type, s, ep);
    if (playerTitle) {
      playerTitle.textContent = type === 'tv'
        ? `${titleOf(currentMedia)} — Season ${s}, Episode ${ep} (VidSrc)`
        : `${titleOf(currentMedia)} (VidSrc Server)`;
    }
    if (sourceVidsrcBtn) sourceVidsrcBtn.classList.add('active');
  } else if (source === 'vidapi') {
    playerIframe.src = getVidApiUrl(currentMedia.id, type, s, ep);
    if (playerTitle) {
      playerTitle.textContent = type === 'tv'
        ? `${titleOf(currentMedia)} — Season ${s}, Episode ${ep} (VidApi)`
        : `${titleOf(currentMedia)} (VidApi Server)`;
    }
    if (sourceVidapiBtn) sourceVidapiBtn.classList.add('active');
  } else if (source === 'trailer' && trailer) {
    playerIframe.src = `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1`;
    if (playerTitle) playerTitle.textContent = `${titleOf(currentMedia)} (Official Trailer)`;
    if (sourceTrailerBtn) sourceTrailerBtn.classList.add('active');
  }

  // Update episode active class
  document.querySelectorAll('.episode-card').forEach(el => el.classList.remove('active'));
  const activeEpEl = document.querySelector(`#ep-${s}-${ep}`);
  if (activeEpEl) activeEpEl.classList.add('active');
}

function closePlayer() {
  const playerSection = document.querySelector('#player-section');
  const playerIframe = document.querySelector('#media-player');
  if (playerIframe) {
    playerIframe.src = 'about:blank';
  }
  if (playerSection) {
    playerSection.classList.add('player-hidden');
  }
}

function scrollToPlayer() {
  const playerSection = document.querySelector('#player-section');
  if (playerSection) {
    playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function playEpisode(seasonNumber, episodeNumber) {
  const targetSource = currentSource === 'trailer' ? 'vidsrc' : currentSource;
  updatePlayer(targetSource, seasonNumber, episodeNumber);
  scrollToPlayer();
  toast(`Playing Season ${seasonNumber}, Episode ${episodeNumber}`);
}

// VidSrc event listener for saving progress and auto-resume
window.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'PLAYER_EVENT') return;
  const { player_info, player_status, player_progress } = event.data.data || {};
  if (!player_info) return;

  const id = player_info.tmdb || player_info.imdb || (currentMedia && currentMedia.id);
  if (!id) return;

  if (player_status === 'playing' || player_status === 'paused') {
    const key = player_info.mediaType === 'tv' && player_info.season && player_info.episode
      ? `progress_${id}_s${player_info.season}_e${player_info.episode}`
      : `progress_${id}`;
    if (player_progress > 5) {
      localStorage.setItem(key, player_progress);
      localStorage.setItem(`progress_${id}`, player_progress);
    }
  }

  // Auto-next episode handling when completed
  if (player_status === 'completed' && player_info.mediaType === 'tv') {
    const nextEp = parseInt(player_info.episode || currentEpisode) + 1;
    const season = parseInt(player_info.season || currentSeason);
    toast(`Episode completed. Up next: Episode ${nextEp}`);
    updatePlayer('vidsrc', season, nextEp);
  }
});

async function loadDetails() {
  if (!id) {
    showError(root, 'Choose a movie or show from the catalog.');
    return;
  }
  root.innerHTML = '<section class="detail-hero"><div class="detail-content"><p class="eyebrow">Loading title…</p></div></section>';
  try {
    const item = await (type === 'tv' ? getTVDetails(id) : getMovieDetails(id));
    currentMedia = item;
    const director = (item.credits?.crew || []).find(p => p.job === 'Director')?.name || 'Not available';
    const trailer = (item.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
      || (item.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer');

    const playerHtml = `
      <section class="preview content-section player-hidden" id="player-section">
        <div class="player-header">
          <span class="player-title" id="player-title">${titleOf(item)} ${type === 'tv' ? '— Season 1, Episode 1' : ''}</span>
          <div class="player-controls-right">
            <span class="player-status-badge">Stream Player</span>
            <button type="button" class="player-close-btn" onclick="closePlayer()" title="Close player">✕ Close</button>
          </div>
        </div>
        <div class="player-container">
          <iframe id="media-player" src="about:blank" title="${titleOf(item)} player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
      </section>
    `;

    const validSeasons = type === 'tv' ? (item.seasons || []).filter(s => s.season_number > 0) : [];
    const seasons = type === 'tv' && validSeasons.length ? `
      <section class="seasons-section">
        <div class="seasons-header">
          <div class="seasons-heading-left">
            <h2>Seasons & Episodes</h2>
            <span class="ep-count-pill" id="ep-count-pill">Episodes</span>
          </div>
          <div class="seasons-controls">
            <input type="text" class="episodes-search-input" id="ep-search" placeholder="Search episode name or #" oninput="filterEpisodes(this.value)">
            <div class="season-select-wrapper">
              <select class="season-select" id="season-dropdown" onchange="switchSeason(Number(this.value))">
                ${validSeasons.map(s => `<option value="${s.season_number}" ${s.season_number === currentSeason ? 'selected' : ''}>Season ${s.season_number} (${s.episode_count || 0} eps)</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="season-tabs" id="season-tabs">
          ${validSeasons.map(s => `
            <button type="button" class="season-pill ${s.season_number === currentSeason ? 'active' : ''}" onclick="switchSeason(${s.season_number})">
              Season ${s.season_number}
            </button>
          `).join('')}
        </div>

        <div class="episodes-scroll-wrapper">
          <div class="episodes-container" id="episodes-list">
            <div class="episodes-loader"><p class="result-count">Loading episodes…</p></div>
          </div>
        </div>
      </section>
    ` : '';

    root.innerHTML = `
      <section class="detail-hero" style="background-image:url('${imageUrl(item.backdrop_path, 'original')}')">
        <div class="detail-content">
          <p class="eyebrow">${type === 'tv' ? 'TV series' : 'Feature film'}</p>
          <h1>${titleOf(item)}</h1>
          <div class="meta">
            <span>${yearOf(item)}</span>
            <span class="rating">★ ${(item.vote_average || 0).toFixed(1)}</span>
            <span>${(item.genres || []).map(g => g.name).join(' · ')}</span>
          </div>
          <button class="button primary" onclick="updatePlayer('vidsrc'); scrollToPlayer();">▶ Watch now</button>
        </div>
      </section>
      ${playerHtml}
      <section class="details-body">
        <div class="details-sidebar">
          <img class="detail-poster" src="${imageUrl(item.poster_path)}" alt="${titleOf(item)} poster">
          <aside class="source-panel">
            <span class="fact-label">Video Sources</span>
            <div class="source-options">
              <button class="source-option active" id="source-vidsrc" type="button" onclick="updatePlayer('vidsrc'); scrollToPlayer();">
                <span>⚡ VidSrc Server</span>
              </button>
              <button class="source-option" id="source-vidapi" type="button" onclick="updatePlayer('vidapi'); scrollToPlayer();">
                <span>⚡ VidApi (vaplayer)</span>
              </button>
              ${trailer ? `
                <button class="source-option" id="source-trailer" type="button" onclick="updatePlayer('trailer'); scrollToPlayer();">
                  <span>▶ Official Trailer</span>
                </button>
              ` : ''}
            </div>
            <p>Select your preferred streaming provider or trailer preview.</p>
          </aside>
        </div>
        <div class="details-main">
          <p class="detail-description">${item.overview || 'No overview is available.'}</p>
          <div class="facts">
            <div>
              <span class="fact-label">${type === 'tv' ? 'First aired' : 'Release date'}</span>
              <span class="fact-value">${item.first_air_date || item.release_date || 'Not available'}</span>
            </div>
            <div>
              <span class="fact-label">${type === 'tv' ? 'Seasons' : 'Runtime'}</span>
              <span class="fact-value">${type === 'tv' ? item.number_of_seasons : `${item.runtime || '—'} min`}</span>
            </div>
            <div>
              <span class="fact-label">Cast</span>
              <span class="fact-value">${castList(item)}</span>
            </div>
            ${type === 'movie' ? `
              <div>
                <span class="fact-label">Director</span>
                <span class="fact-value">${director}</span>
              </div>
            ` : ''}
          </div>
          ${seasons}
        </div>
      </section>
      ${recommendations(item)}
    `;

    if (type === 'tv' && validSeasons.length) {
      if (!validSeasons.some(s => s.season_number === currentSeason)) {
        currentSeason = validSeasons[0].season_number;
      }
      loadSeason(currentSeason);
    }
  } catch (e) {
    console.error('Details loading error:', e);
    showError(root, e.message);
  }
}

function switchSeason(number) {
  currentSeason = number;
  document.querySelectorAll('.season-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === `Season ${number}`);
  });
  const dropdown = document.querySelector('#season-dropdown');
  if (dropdown) dropdown.value = number;
  const searchInput = document.querySelector('#ep-search');
  if (searchInput) searchInput.value = '';
  loadSeason(number);
}

function filterEpisodes(query) {
  const q = query.trim().toLowerCase();
  const cards = document.querySelectorAll('.episode-card');
  let matched = 0;
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    const epId = card.id.toLowerCase();
    const matches = !q || text.includes(q) || epId.includes(q);
    card.style.display = matches ? 'flex' : 'none';
    if (matches) matched++;
  });
  const countBadge = document.querySelector('#ep-count-pill');
  if (countBadge) {
    countBadge.textContent = q ? `${matched} matching` : `${cards.length} Episodes`;
  }
}

async function loadSeason(number) {
  const target = document.querySelector('#episodes-list');
  const countBadge = document.querySelector('#ep-count-pill');
  if (!target) return;
  target.innerHTML = '<div class="episodes-loader"><p class="result-count">Loading season episodes…</p></div>';
  try {
    const data = await getTVSeason(id, number);
    if (!data.episodes || !data.episodes.length) {
      target.innerHTML = '<p class="result-count">No episodes found for this season.</p>';
      if (countBadge) countBadge.textContent = '0 Episodes';
      return;
    }
    if (countBadge) countBadge.textContent = `${data.episodes.length} Episodes`;
    target.innerHTML = data.episodes.map(ep => {
      const isCurrent = currentSeason === number && currentEpisode === ep.episode_number;
      const thumb = ep.still_path ? imageUrl(ep.still_path, 'w300') : '';
      return `
        <div class="episode-card ${isCurrent ? 'active' : ''}" id="ep-${number}-${ep.episode_number}" onclick="playEpisode(${number}, ${ep.episode_number})">
          <div class="ep-thumb-wrapper">
            ${thumb ? `<img src="${thumb}" alt="${ep.name}" loading="lazy" class="ep-thumb">` : `<div class="ep-thumb-empty"><span>EP ${ep.episode_number}</span></div>`}
            <span class="ep-num-tag">E${ep.episode_number}</span>
            <div class="ep-play-overlay">▶</div>
          </div>
          <div class="ep-info">
            <div class="ep-header">
              <span class="ep-badge">${number}x${ep.episode_number}</span>
              <h4 class="ep-name">${ep.name || `Episode ${ep.episode_number}`}</h4>
              <span class="ep-meta">${ep.runtime ? `${ep.runtime} min` : ''} ${ep.air_date ? `· ${ep.air_date}` : ''}</span>
            </div>
            <p class="ep-overview">${ep.overview || 'No description available for this episode.'}</p>
          </div>
          <button type="button" class="ep-play-btn" onclick="event.stopPropagation(); playEpisode(${number}, ${ep.episode_number})" aria-label="Play episode">
            ${isCurrent ? 'Playing' : 'Play'}
          </button>
        </div>
      `;
    }).join('');
  } catch (e) {
    target.innerHTML = `<p class="result-count">${e.message}</p>`;
  }
}

loadDetails();

