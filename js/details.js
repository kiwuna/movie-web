const params = new URLSearchParams(location.search),
  id = params.get('id'),
  type = params.get('type') === 'tv' ? 'tv' : 'movie',
  root = document.querySelector('#details');

let currentMedia = null;
let currentSource = 'vidsrc'; // 'vidsrc' | 'vidapi' | 'trailer'
let currentSeason = 1;
let currentEpisode = 1;
let lastKnownProgress = null; // { key, value } — updated on every PLAYER_EVENT

function formatTime(seconds) {
  const s = Math.floor(parseFloat(seconds));
  if (s >= 3600) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function saveProgress(key, value) {
  try {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value); // sessionStorage as fast backup
  } catch (e) { /* storage full or blocked */ }
}

function getProgress(key) {
  // sessionStorage is faster/more reliable within the same tab
  return sessionStorage.getItem(key) || localStorage.getItem(key);
}

function saveTVState(mediaId, season, episode) {
  if (!mediaId) return;
  const state = JSON.stringify({ season: Number(season), episode: Number(episode) });
  saveProgress(`tv_state_${mediaId}`, state);
}

function getTVState(mediaId) {
  if (!mediaId) return null;
  const raw = getProgress(`tv_state_${mediaId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearMediaProgress(mediaId) {
  if (!mediaId) return;
  lastKnownProgress = null;
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(`progress_${mediaId}`) || k === `tv_state_${mediaId}`)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    localStorage.removeItem(`progress_${mediaId}`);
    localStorage.removeItem(`tv_state_${mediaId}`);
    sessionStorage.removeItem(`progress_${mediaId}`);
    sessionStorage.removeItem(`tv_state_${mediaId}`);
  } catch (e) {}
}

// Flush last known progress on page hide/unload (covers reloads & tab close)
function flushProgress() {
  if (lastKnownProgress) {
    saveProgress(lastKnownProgress.key, lastKnownProgress.value);
    // Also keep the generic key updated
    if (currentMedia) {
      saveProgress(`progress_${currentMedia.id}`, lastKnownProgress.value);
      if (type === 'tv') {
        saveTVState(currentMedia.id, currentSeason, currentEpisode);
      }
    }
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flushProgress(); });
window.addEventListener('beforeunload', flushProgress);
window.addEventListener('pagehide', flushProgress);

function castList(data) {
  return (data.credits?.cast || []).slice(0, 6).map(p => p.name).join(', ') || 'Not available';
}

function recommendations(data) {
  const items = (data.recommendations?.results || data.similar?.results || []).slice(0, 6);
  return items.length ? `<section class="content-section"><div class="section-heading"><h2>You may also like</h2></div><div class="card-row">${items.map(x => card(x, type)).join('')}</div></section>` : '';
}

function getVidSrcUrl(mediaId, mediaType, season = 1, episode = 1) {
  const progressKey = `progress_${mediaId}${mediaType === 'tv' ? `_s${season}_e${episode}` : ''}`;
  const saved = getProgress(progressKey) || getProgress(`progress_${mediaId}`);
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

  if (currentMedia && type === 'tv') {
    saveTVState(currentMedia.id, s, ep);
  }

  const playerSection = document.querySelector('#player-section');
  const playerIframe = document.querySelector('#media-player');
  const playerTitle = document.querySelector('#player-title');
  const sourceVidsrcBtn = document.querySelector('#source-vidsrc');
  const sourceVidapiBtn = document.querySelector('#source-vidapi');
  const sourceTrailerBtn = document.querySelector('#source-trailer');
  const sourcePanel = document.querySelector('.source-panel');
  const seasonsSection = document.querySelector('.seasons-section');

  if (!playerIframe || !currentMedia) return;

  // Reveal player section, source panel and seasons section when watch/episode/source is clicked
  if (playerSection) {
    playerSection.classList.remove('player-hidden');
  }
  if (sourcePanel) {
    sourcePanel.classList.remove('source-panel-hidden');
  }
  if (seasonsSection) {
    seasonsSection.classList.remove('seasons-hidden');
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

  // Update episode active class & season tabs if TV
  if (type === 'tv') {
    document.querySelectorAll('.season-pill').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === `Season ${s}`);
    });
    const dropdown = document.querySelector('#season-dropdown');
    if (dropdown && dropdown.value != s) dropdown.value = s;

    const episodesList = document.querySelector('#episodes-list');
    const activeEpInDom = document.querySelector(`#ep-${s}-${ep}`);
    if (!activeEpInDom && episodesList) {
      loadSeason(s);
    } else {
      document.querySelectorAll('.episode-card').forEach(el => el.classList.remove('active'));
      if (activeEpInDom) activeEpInDom.classList.add('active');
    }
  } else {
    document.querySelectorAll('.episode-card').forEach(el => el.classList.remove('active'));
    const activeEpEl = document.querySelector(`#ep-${s}-${ep}`);
    if (activeEpEl) activeEpEl.classList.add('active');
  }
}

function closePlayer() {
  const playerSection = document.querySelector('#player-section');
  const playerIframe = document.querySelector('#media-player');
  const sourcePanel = document.querySelector('.source-panel');
  const seasonsSection = document.querySelector('.seasons-section');
  if (playerIframe) {
    playerIframe.src = 'about:blank';
  }
  if (playerSection) {
    playerSection.classList.add('player-hidden');
  }
  if (sourcePanel) {
    sourcePanel.classList.add('source-panel-hidden');
  }
  if (seasonsSection) {
    seasonsSection.classList.add('seasons-hidden');
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
    const isTv = player_info.mediaType === 'tv' || type === 'tv';
    const s = player_info.season || currentSeason;
    const ep = player_info.episode || currentEpisode;
    const key = isTv && s && ep
      ? `progress_${id}_s${s}_e${ep}`
      : `progress_${id}`;
    if (player_progress > 5) {
      saveProgress(key, player_progress);
      saveProgress(`progress_${id}`, player_progress);
      if (isTv) {
        saveTVState(id, s, ep);
      }
      // Track latest so we can flush on unload even if the tab closes abruptly
      lastKnownProgress = { key, value: player_progress };
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

    if (type === 'tv') {
      const savedTv = getTVState(item.id);
      if (savedTv && savedTv.season) {
        currentSeason = Number(savedTv.season);
        if (savedTv.episode) currentEpisode = Number(savedTv.episode);
      }
    }

    const director = (item.credits?.crew || []).find(p => p.job === 'Director')?.name || 'Not available';
    const trailer = (item.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
      || (item.videos?.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer');

    const validSeasons = type === 'tv' ? (item.seasons || []).filter(s => s.season_number > 0) : [];
    const seasons = type === 'tv' && validSeasons.length ? `
      <aside class="seasons-section seasons-hidden">
        <div class="seasons-header">
          <div class="seasons-heading-left">
            <span class="fact-label">Episodes</span>
            <span class="ep-count-pill" id="ep-count-pill">Episodes</span>
          </div>
          <div class="seasons-controls">
            <input type="text" class="episodes-search-input" id="ep-search" placeholder="Search ep..." oninput="filterEpisodes(this.value)">
            <div class="season-select-wrapper">
              <select class="season-select" id="season-dropdown" onchange="switchSeason(Number(this.value))">
                ${validSeasons.map(s => `<option value="${s.season_number}" ${s.season_number === currentSeason ? 'selected' : ''}>S${s.season_number} (${s.episode_count || 0} eps)</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="episodes-scroll-wrapper">
          <div class="episodes-container" id="episodes-list">
            <div class="episodes-loader"><p class="result-count">Loading episodes…</p></div>
          </div>
        </div>
      </aside>
    ` : '';

    const playerHtml = `
      <section class="preview content-section player-hidden" id="player-section">
        <div class="player-header">
          <span class="player-title" id="player-title">${titleOf(item)} ${type === 'tv' ? `— Season ${currentSeason}, Episode ${currentEpisode}` : ''}</span>
          <div class="player-controls-right">
            <span class="player-status-badge">Stream Player</span>
            <button type="button" class="player-close-btn" onclick="closePlayer()" title="Close player">✕ Close</button>
          </div>
        </div>
        <div class="player-body">
          ${seasons}
          <div class="player-container">
            <iframe id="media-player" src="about:blank" title="${titleOf(item)} player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </div>
          <aside class="source-panel source-panel-hidden">
            <span class="fact-label">Video Sources</span>
            <div class="source-options">
              <button class="source-option active" id="source-vidsrc" type="button" onclick="updatePlayer('vidsrc'); scrollToPlayer();">
                <span> VIDSRC</span>
              </button>
              <button class="source-option" id="source-vidapi" type="button" onclick="updatePlayer('vidapi'); scrollToPlayer();">
                <span> VIDAPI</span>
              </button>
              ${trailer ? `
                <button class="source-option" id="source-trailer" type="button" onclick="updatePlayer('trailer'); scrollToPlayer();">
                  <span> Official Trailer</span>
                </button>
              ` : ''}
            </div>
            <p>Select your preferred streaming provider.</p>
          </aside>
        </div>
      </section>
    `;

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
          ${(() => {
            const specificProgressKey = type === 'tv'
              ? `progress_${item.id}_s${currentSeason}_e${currentEpisode}`
              : `progress_${item.id}`;
            const savedProgress = getProgress(specificProgressKey) || getProgress(`progress_${item.id}`);
            const hasSaved = savedProgress && parseFloat(savedProgress) > 10;
            const resumeLabel = type === 'tv'
              ? `↩ Resume S${currentSeason}E${currentEpisode} (${formatTime(savedProgress)})`
              : `↩ Resume from ${formatTime(savedProgress)}`;
            return hasSaved
              ? `<div class="watch-actions">
                   <button class="button primary" onclick="updatePlayer('vidsrc', ${currentSeason}, ${currentEpisode}); scrollToPlayer();">${resumeLabel}</button>
                   <button class="button secondary" onclick="clearMediaProgress('${item.id}'); location.reload();" title="Start over">▶ Watch from start</button>
                 </div>`
              : `<button class="button primary" onclick="updatePlayer('vidsrc', ${currentSeason}, ${currentEpisode}); scrollToPlayer();">▶ Watch now</button>`;
          })()}
        </div>
      </section>
      ${playerHtml}
      <section class="details-body">
        <div class="details-sidebar">
          <img class="detail-poster" src="${imageUrl(item.poster_path)}" alt="${titleOf(item)} poster">
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
      return `
        <div class="episode-card ${isCurrent ? 'active' : ''}" id="ep-${number}-${ep.episode_number}" onclick="playEpisode(${number}, ${ep.episode_number})">

          <div class="ep-info">
            <div class="ep-header">
              <span class="ep-badge">S${number}E${ep.episode_number}</span>
              <h4 class="ep-name">${ep.name || `Episode ${ep.episode_number}`}</h4>
              <span class="ep-meta">${ep.runtime ? `${ep.runtime} min` : ''} ${ep.air_date ? `· ${ep.air_date}` : ''}</span>
            </div>
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

