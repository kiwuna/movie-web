const params = new URLSearchParams(location.search),
  id = params.get('id'),
  type = params.get('type') === 'tv' ? 'tv' : 'movie',
  root = document.querySelector('#details');

let currentMedia = null;
let currentSource = getDefaultPlayer(); // Load from localStorage or default to 'vidsrc'
let currentSeason = 1;
let currentEpisode = 1;

// Restore season/episode from URL hash if present (format: #sXeY)
if (type === 'tv' && location.hash) {
  const hashMatch = location.hash.match(/#s(\d+)e(\d+)/i);
  if (hashMatch) {
    currentSeason = Number(hashMatch[1]);
    currentEpisode = Number(hashMatch[2]);
  }
}
let playerLoadedAt = 0; // Timestamp when player episode was loaded, prevents stale iframe events
let lastKnownProgress = null; // { key, value } — updated on every PLAYER_EVENT
let pipWindow = null; // Document Picture-in-Picture window
let mainPlayerSrcBeforePiP = null; // Store main player URL before PiP

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

function saveDefaultPlayer(source) {
  try {
    localStorage.setItem('default_player', source);
  } catch (e) { /* storage full or blocked */ }
}

function getDefaultPlayer() {
  try {
    const saved = localStorage.getItem('default_player') || 'vidsrc';
    return saved === 'zxcprime' ? 'viduki' : saved;
  } catch (e) {
    return 'vidsrc';
  }
}

function setDefaultPlayer(source) {
  saveDefaultPlayer(source);
  currentSource = source;
  toast(`Default player set to ${source.charAt(0).toUpperCase() + source.slice(1)}`);
}

function syncDefaultPlayerDropdown() {
  const dropdown = document.querySelector('#default-player-select');
  if (dropdown) {
    dropdown.value = currentSource;
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
  const cast = (data.credits?.cast || []).slice(0, 6);
  if (!cast.length) return 'Not available';
  
  return cast.map(person => {
    const profileImage = person.profile_path 
      ? imageUrl(person.profile_path, 'w185')
      : 'https://placehold.co/185x278/161a23/a7abb6?text=No+Image';
    return `
      <div class="cast-item">
        <img class="cast-image" src="${profileImage}" alt="${person.name}" loading="lazy">
        <span class="cast-name">${person.name}</span>
      </div>
    `;
  }).join('');
}

function recommendations(data) {
  const items = (data.recommendations?.results || data.similar?.results || []).slice(0, 6);
  return items.length ? `<section class="content-section"><div class="section-heading"><h2>You may also like</h2></div><div class="card-row">${items.map(x => card(x, type)).join('')}</div></section>` : '';
}

function getVidSrcUrl(mediaId, mediaType, season = 1, episode = 1) {
  let saved;
  if (mediaType === 'tv') {
    // For TV, ONLY use the per-episode key — never fall back to the shared generic
    // key, which would bleed the previous episode's timestamp into the new one.
    const episodeKey = `progress_${mediaId}_s${season}_e${episode}`;
    saved = getProgress(episodeKey);
  } else {
    saved = getProgress(`progress_${mediaId}`);
  }
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

function getVidFastUrl(mediaId, mediaType, season = 1, episode = 1) {
  if (mediaType === 'tv') {
    return `https://vidfast.vc/tv/${mediaId}/${season}/${episode}?autoPlay=true`;
  }
  return `https://vidfast.vc/movie/${mediaId}?autoPlay=true`;
}

function getVidUpUrl(mediaId, mediaType, season = 1, episode = 1) {
  if (mediaType === 'tv') {
    return `https://vidup.to/tv/${mediaId}/${season}/${episode}`;
  }
  return `https://vidup.to/movie/${mediaId}?autoPlay=true`;
}

function getVidRockUrl(mediaId, mediaType, season = 1, episode = 1) {
  if (mediaType === 'tv') {
    return `https://vidrock.to/tv/${mediaId}/${season}/${episode}`;
  }
  return `https://vidrock.to/movie/${mediaId}`;
}

let vidukiApiIndex = 1;
function getVidukiUrl(mediaId, mediaType, season = 1, episode = 1, api = vidukiApiIndex) {
  const base = `https://www.viduki.net/${api}/${mediaType === 'tv' ? 'tv' : 'movie'}/${mediaId}`;
  return mediaType === 'tv' ? `${base}/${season}/${episode}` : base;
}

function getVidStuckUrl(mediaId, mediaType, season = 1, episode = 1) {
  let saved;
  if (mediaType === 'tv') {
    saved = getProgress(`progress_${mediaId}_s${season}_e${episode}`);
  } else {
    saved = getProgress(`progress_${mediaId}`);
  }
  const params = ['subtitle=english'];
  if (saved && parseFloat(saved) > 10) params.push(`progress=${Math.floor(parseFloat(saved))}`);
  const path = mediaType === 'tv' ? `tv/${mediaId}/${season}/${episode}` : `movie/${mediaId}`;
  return `https://vidstuck.cc/embed/${path}?${params.join('&')}`;
}

function getVidNestUrl(mediaId, mediaType, season = 1, episode = 1) {
  if (mediaType === 'tv') {
    return `https://vidnest.fun/tv/${mediaId}/${season}/${episode}`;
  }
  return `https://vidnest.fun/movie/${mediaId}`;
}

function updatePlayer(source, s = currentSeason, ep = currentEpisode) {
  currentSource = source;
  currentSeason = s;
  currentEpisode = ep;
  playerLoadedAt = Date.now();
  if (source === 'viduki') vidukiApiIndex = 1;

  if (currentMedia && type === 'tv') {
    saveTVState(currentMedia.id, s, ep);
    // Update URL hash to persist season/episode across reloads
    history.replaceState(null, '', `#s${s}e${ep}`);
  }

  // Add to history when user starts watching (not when switching to trailer)
  if (currentMedia && source !== 'trailer') {
    if (typeof addToHistory === 'function') {
      addToHistory({
        ...currentMedia,
        media_type: type
      });
    }
    // Save as default player when user manually switches sources
    saveDefaultPlayer(source);
  }

  const playerSection = document.querySelector('#player-section');
  const playerIframe = document.querySelector('#media-player');
  const playerTitle = document.querySelector('#player-title');
  const sourceVidsrcBtn = document.querySelector('#source-vidsrc');
  const sourceVidfastBtn = document.querySelector('#source-vidfast');
  const sourceVidupBtn = document.querySelector('#source-vidup');
  const sourceVidrockBtn = document.querySelector('#source-vidrock');
  const sourceVidukiBtn = document.querySelector('#source-viduki');
  const sourceVidstuckBtn = document.querySelector('#source-vidstuck');
  const sourceVidnestBtn = document.querySelector('#source-vidnest');
  const sourceVidapiBtn = document.querySelector('#source-vidapi');
  const sourceTrailerBtn = document.querySelector('#source-trailer');
  const sourcePanel = document.querySelector('.source-panel');
  const seasonsSection = document.querySelector('.seasons-section');

  if (!currentMedia) return;

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
  if (sourceVidfastBtn) sourceVidfastBtn.classList.remove('active');
  if (sourceVidupBtn) sourceVidupBtn.classList.remove('active');
  if (sourceVidrockBtn) sourceVidrockBtn.classList.remove('active');
  if (sourceVidukiBtn) sourceVidukiBtn.classList.remove('active');
  if (sourceVidstuckBtn) sourceVidstuckBtn.classList.remove('active');
  if (sourceVidnestBtn) sourceVidnestBtn.classList.remove('active');
  if (sourceVidapiBtn) sourceVidapiBtn.classList.remove('active');
  if (sourceTrailerBtn) sourceTrailerBtn.classList.remove('active');

  if (source === 'vidup') {
    if (playerIframe) playerIframe.src = getVidUpUrl(currentMedia.id, type, s, ep);
    if (playerTitle) {
      playerTitle.textContent = type === 'tv'
        ? `${titleOf(currentMedia)} — Season ${s}, Episode ${ep} (VidUp)`
        : `${titleOf(currentMedia)} (VidUp Server)`;
    }
    if (sourceVidupBtn) sourceVidupBtn.classList.add('active');
  } else if (source === 'vidsrc') {
    if (playerIframe) playerIframe.src = getVidSrcUrl(currentMedia.id, type, s, ep);
    if (playerTitle) {
      playerTitle.textContent = type === 'tv'
        ? `${titleOf(currentMedia)} — Season ${s}, Episode ${ep} (VidSrc)`
        : `${titleOf(currentMedia)} (VidSrc Server)`;
    }
    if (sourceVidsrcBtn) sourceVidsrcBtn.classList.add('active');
  } else if (source === 'viduki') {
    if (playerIframe) playerIframe.src = getVidukiUrl(currentMedia.id, type, s, ep);
    if (playerTitle) {
      playerTitle.textContent = type === 'tv'
        ? `${titleOf(currentMedia)} — Season ${s}, Episode ${ep} (Viduki)`
        : `${titleOf(currentMedia)} (Viduki Server)`;
    }
    if (sourceVidukiBtn) sourceVidukiBtn.classList.add('active');
  } else if (source === 'vidstuck') {
    if (playerIframe) playerIframe.src = getVidStuckUrl(currentMedia.id, type, s, ep);
    if (playerTitle) {
      playerTitle.textContent = type === 'tv'
        ? `${titleOf(currentMedia)} — Season ${s}, Episode ${ep} (VidStuck)`
        : `${titleOf(currentMedia)} (VidStuck Server)`;
    }
    if (sourceVidstuckBtn) sourceVidstuckBtn.classList.add('active');
  } else if (source === 'vidrock') {
    if (playerIframe) playerIframe.src = getVidRockUrl(currentMedia.id, type, s, ep);
    if (playerTitle) {
      playerTitle.textContent = type === 'tv'
        ? `${titleOf(currentMedia)} — Season ${s}, Episode ${ep} (VidRock)`
        : `${titleOf(currentMedia)} (VidRock Server)`;
    }
    if (sourceVidrockBtn) sourceVidrockBtn.classList.add('active');
  } else if (source === 'vidfast') {
    if (playerIframe) playerIframe.src = getVidFastUrl(currentMedia.id, type, s, ep);
    if (playerTitle) {
      playerTitle.textContent = type === 'tv'
        ? `${titleOf(currentMedia)} — Season ${s}, Episode ${ep} (VidFast)`
        : `${titleOf(currentMedia)} (VidFast Server)`;
    }
    if (sourceVidfastBtn) sourceVidfastBtn.classList.add('active');
  } else if (source === 'vidnest') {
    if (playerIframe) playerIframe.src = getVidNestUrl(currentMedia.id, type, s, ep);
    if (playerTitle) {
      playerTitle.textContent = type === 'tv'
        ? `${titleOf(currentMedia)} — Season ${s}, Episode ${ep} (VidNest)`
        : `${titleOf(currentMedia)} (VidNest Server)`;
    }
    if (sourceVidnestBtn) sourceVidnestBtn.classList.add('active');
  } else if (source === 'vidapi') {
    if (playerIframe) playerIframe.src = getVidApiUrl(currentMedia.id, type, s, ep);
    if (playerTitle) {
      playerTitle.textContent = type === 'tv'
        ? `${titleOf(currentMedia)} — Season ${s}, Episode ${ep} (VidApi)`
        : `${titleOf(currentMedia)} (VidApi Server)`;
    }
    if (sourceVidapiBtn) sourceVidapiBtn.classList.add('active');
  } else if (source === 'trailer' && trailer) {
    if (playerIframe) playerIframe.src = `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1`;
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
      document.querySelectorAll('.episode-card').forEach(el => {
        const isTarget = el.id === `ep-${s}-${ep}`;
        el.classList.toggle('active', isTarget);
        const playBtn = el.querySelector('.ep-play-btn');
        if (playBtn) playBtn.textContent = isTarget ? 'Playing' : 'Play';
      });
      if (activeEpInDom) {
        activeEpInDom.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  } else {
    document.querySelectorAll('.episode-card').forEach(el => {
      const isTarget = el.id === `ep-${s}-${ep}`;
      el.classList.toggle('active', isTarget);
      const playBtn = el.querySelector('.ep-play-btn');
      if (playBtn) playBtn.textContent = isTarget ? 'Playing' : 'Play';
    });
  }

  // Sync default player dropdown
  syncDefaultPlayerDropdown();
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
  // Close PiP window if open
  if (pipWindow) {
    pipWindow.close();
    pipWindow = null;
  }
}

async function togglePictureInPicture() {
  const playerIframe = document.querySelector('#media-player');
  const pipBtn = document.querySelector('#pip-btn');
  
  if (!playerIframe) return;

  // If PiP window is already open, close it and restore main player
  if (pipWindow) {
    // Restore main player with current timestamp
    if (mainPlayerSrcBeforePiP) {
      // Get current progress to resume from latest position
      const progressKey = type === 'tv'
        ? `progress_${currentMedia.id}_s${currentSeason}_e${currentEpisode}`
        : `progress_${currentMedia.id}`;
      const savedProgress = getProgress(progressKey);
      
      let restoreUrl = mainPlayerSrcBeforePiP;
      if (savedProgress && parseFloat(savedProgress) > 10) {
        // Remove any existing startAt parameter and add new one
        const urlWithoutStart = mainPlayerSrcBeforePiP.split('&startAt=')[0].split('?startAt=')[0];
        const separator = urlWithoutStart.includes('?') ? '&' : '?';
        restoreUrl = urlWithoutStart + separator + `startAt=${Math.floor(parseFloat(savedProgress))}`;
      }
      
      playerIframe.src = restoreUrl;
      mainPlayerSrcBeforePiP = null;
    }
    pipWindow.close();
    pipWindow = null;
    if (pipBtn) pipBtn.classList.remove('active');
    return;
  }

  // Check if Document Picture-in-Picture API is supported
  if (!('documentPictureInPicture' in window)) {
    toast('Picture-in-Picture is not supported in this browser');
    return;
  }

  try {
    // Store current URL with timestamp
    const currentSrc = playerIframe.src;
    mainPlayerSrcBeforePiP = currentSrc; // Store for later restoration
    let pipSrc = currentSrc;
    
    // Check if it already has startAt
    if (!currentSrc.includes('startAt=')) {
      // Try to get current progress
      const progressKey = type === 'tv'
        ? `progress_${currentMedia.id}_s${currentSeason}_e${currentEpisode}`
        : `progress_${currentMedia.id}`;
      const savedProgress = getProgress(progressKey);
      if (savedProgress && parseFloat(savedProgress) > 10) {
        const separator = currentSrc.includes('?') ? '&' : '?';
        pipSrc = currentSrc + separator + `startAt=${Math.floor(parseFloat(savedProgress))}`;
      }
    }

    // Hide main player
    playerIframe.src = 'about:blank';

    // Calculate aspect ratio (most videos are 16:9)
    const aspectRatio = 16 / 9;
    const baseWidth = 1280;
    const baseHeight = Math.round(baseWidth / aspectRatio);

    // Request a new PiP window with aspect ratio
    pipWindow = await window.documentPictureInPicture.requestWindow({
      width: baseWidth,
      height: baseHeight
    });

    // Set window title to clean name
    pipWindow.document.title = currentMedia ? titleOf(currentMedia) : 'Picture in Picture';

    // Copy essential styles to the PiP window for aspect ratio maintenance
    const style = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #000; overflow: hidden; width: 100%; height: 100%; }
      body { display: flex; align-items: center; justify-content: center; }
      .video-container {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      iframe {
        position: absolute;
        width: 100%;
        height: 100%;
        border: none;
        display: block;
        object-fit: contain;
      }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.textContent = style;
    pipWindow.document.head.appendChild(styleElement);

    // Create container for aspect ratio
    const container = document.createElement('div');
    container.className = 'video-container';

    // Create iframe for PiP
    const pipIframe = document.createElement('iframe');
    pipIframe.src = pipSrc;
    pipIframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    pipIframe.allowFullscreen = true;
    
    container.appendChild(pipIframe);
    pipWindow.document.body.appendChild(container);

    // Handle PiP window close - restore main player with current timestamp
    pipWindow.addEventListener('pagehide', () => {
      if (mainPlayerSrcBeforePiP) {
        // Get current progress to resume from latest position
        const progressKey = type === 'tv'
          ? `progress_${currentMedia.id}_s${currentSeason}_e${currentEpisode}`
          : `progress_${currentMedia.id}`;
        const savedProgress = getProgress(progressKey);
        
        let restoreUrl = mainPlayerSrcBeforePiP;
        if (savedProgress && parseFloat(savedProgress) > 10) {
          // Remove any existing startAt parameter and add new one
          const urlWithoutStart = mainPlayerSrcBeforePiP.split('&startAt=')[0].split('?startAt=')[0];
          const separator = urlWithoutStart.includes('?') ? '&' : '?';
          restoreUrl = urlWithoutStart + separator + `startAt=${Math.floor(parseFloat(savedProgress))}`;
        }
        
        playerIframe.src = restoreUrl;
        mainPlayerSrcBeforePiP = null;
      }
      pipWindow = null;
      if (pipBtn) pipBtn.classList.remove('active');
    });

    if (pipBtn) pipBtn.classList.add('active');
    toast('Picture-in-Picture mode enabled');

  } catch (error) {
    console.error('PiP error:', error);
    toast('Failed to enable Picture-in-Picture');
    pipWindow = null;
    // Restore main player on error with current timestamp
    if (mainPlayerSrcBeforePiP) {
      const progressKey = type === 'tv'
        ? `progress_${currentMedia.id}_s${currentSeason}_e${currentEpisode}`
        : `progress_${currentMedia.id}`;
      const savedProgress = getProgress(progressKey);
      
      let restoreUrl = mainPlayerSrcBeforePiP;
      if (savedProgress && parseFloat(savedProgress) > 10) {
        const urlWithoutStart = mainPlayerSrcBeforePiP.split('&startAt=')[0].split('?startAt=')[0];
        const separator = urlWithoutStart.includes('?') ? '&' : '?';
        restoreUrl = urlWithoutStart + separator + `startAt=${Math.floor(parseFloat(savedProgress))}`;
      }
      
      playerIframe.src = restoreUrl;
      mainPlayerSrcBeforePiP = null;
    }
  }
}

function scrollToPlayer() {
  const playerSection = document.querySelector('#player-section');
  if (playerSection) {
    playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function playEpisode(seasonNumber, episodeNumber) {
  const targetSource = currentSource === 'trailer' ? getDefaultPlayer() : currentSource;
  updatePlayer(targetSource, seasonNumber, episodeNumber);
  scrollToPlayer();
  toast(`Playing Season ${seasonNumber}, Episode ${episodeNumber}`);
}

function playNextEpisode() {
  if (!currentMedia || type !== 'tv') return;

  const validSeasons = (currentMedia.seasons || []).filter(s => s.season_number > 0);
  if (!validSeasons.length) {
    toast('No episodes available');
    return;
  }

  // Find current season data
  const currentSeasonData = validSeasons.find(s => s.season_number === currentSeason);
  if (!currentSeasonData) {
    toast('Season not found');
    return;
  }

  const totalEpisodes = currentSeasonData.episode_count || 0;
  let nextSeason = currentSeason;
  let nextEpisode = currentEpisode + 1;

  // If at end of current season, move to next season
  if (nextEpisode > totalEpisodes) {
    const nextSeasonData = validSeasons.find(s => s.season_number === currentSeason + 1);
    if (nextSeasonData) {
      nextSeason = nextSeasonData.season_number;
      nextEpisode = 1;
    } else {
      toast('You\'ve reached the end of the series');
      return;
    }
  }

  const targetSource = currentSource === 'trailer' ? getDefaultPlayer() : currentSource;
  updatePlayer(targetSource, nextSeason, nextEpisode);
  scrollToPlayer();
  toast(`Playing Season ${nextSeason}, Episode ${nextEpisode}`);
}

// Update active episode card and UI state without reloading the iframe
function syncActiveEpisode(s, ep) {
  currentSeason = Number(s);
  currentEpisode = Number(ep);

  if (currentMedia && type === 'tv') {
    saveTVState(currentMedia.id, currentSeason, currentEpisode);
  }

  // Update season dropdown if present
  const dropdown = document.querySelector('#season-dropdown');
  if (dropdown && dropdown.value != currentSeason) {
    dropdown.value = currentSeason;
  }

  // Update season pills
  document.querySelectorAll('.season-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === `Season ${currentSeason}`);
  });

  // Update player header title
  const playerTitle = document.querySelector('#player-title');
  if (playerTitle && currentMedia) {
    const serverName = currentSource === 'vidup' ? 'VidUp'
      : currentSource === 'vidsrc' ? 'VidSrc'
      : currentSource === 'vidfast' ? 'VidFast'
      : currentSource === 'viduki' ? 'Viduki'
      : currentSource === 'vidstuck' ? 'VidStuck'
      : currentSource === 'vidrock' ? 'VidRock'
      : currentSource === 'vidnest' ? 'VidNest'
      : currentSource === 'vidapi' ? 'VidApi'
      : 'VidUp';
    playerTitle.textContent = `${titleOf(currentMedia)} — Season ${currentSeason}, Episode ${currentEpisode} (${serverName} Server)`;
  }

  // Check if target episode card exists in currently rendered season
  const activeEpInDom = document.querySelector(`#ep-${currentSeason}-${currentEpisode}`);
  const episodesList = document.querySelector('#episodes-list');
  if (!activeEpInDom && episodesList) {
    loadSeason(currentSeason);
  } else {
    document.querySelectorAll('.episode-card').forEach(el => {
      const isTarget = el.id === `ep-${currentSeason}-${currentEpisode}`;
      el.classList.toggle('active', isTarget);
      const playBtn = el.querySelector('.ep-play-btn');
      if (playBtn) playBtn.textContent = isTarget ? 'Playing' : 'Play';
    });
    if (activeEpInDom) {
      activeEpInDom.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// Window message listener for player events, saving progress, and auto episode changes
window.addEventListener('message', (event) => {
  let eventData = event.data;
  if (typeof eventData === 'string') {
    try {
      eventData = JSON.parse(eventData);
    } catch (e) {
      return;
    }
  }
  if (!eventData) return;

  // VidSrc / standard embed format: { type: 'PLAYER_EVENT', data: { player_info, player_status, player_progress } }
  // Other players may send: { event, type, season, episode, currentTime, ... }
  let player_info = eventData.data?.player_info || eventData.player_info;
  let player_status = eventData.data?.player_status || eventData.player_status || eventData.event || eventData.status;
  let player_progress = eventData.data?.player_progress ?? eventData.player_progress ?? eventData.currentTime ?? eventData.time;

  // Extract season & episode from any standard location
  let eventSeason = player_info?.season ?? eventData.data?.season ?? eventData.season;
  let eventEpisode = player_info?.episode ?? eventData.data?.episode ?? eventData.episode;

  if (eventSeason !== undefined && eventSeason !== null) eventSeason = parseInt(eventSeason, 10);
  if (eventEpisode !== undefined && eventEpisode !== null) eventEpisode = parseInt(eventEpisode, 10);

  const isTv = (player_info?.mediaType === 'tv') || (eventData.mediaType === 'tv') || type === 'tv';
  const id = player_info?.tmdb || player_info?.imdb || eventData.tmdb || eventData.imdb || (currentMedia && currentMedia.id);
  // Verify message belongs to current media item
  if (currentMedia && id && String(id) !== String(currentMedia.id)) return;

  // If the player auto-switched to a new episode (e.g. via internal autonext), sync the UI and active episode card.
  if (isTv && typeof eventEpisode === 'number' && !isNaN(eventEpisode) && eventEpisode > 0) {
    const s = (typeof eventSeason === 'number' && !isNaN(eventSeason) && eventSeason > 0) ? eventSeason : currentSeason;
    
    if (eventEpisode !== currentEpisode || s !== currentSeason) {
      // During initial player load (first 1.5s), don't jump more than 1 episode away from currentEpisode
      // (this prevents a stale/cached preloader index like ep 6 from briefly flashing when you clicked ep 4)
      const isInitialBurst = (Date.now() - playerLoadedAt) < 1500;
      const isExtremeJump = Math.abs(eventEpisode - currentEpisode) > 1 && s === currentSeason;

      if (!isInitialBurst || !isExtremeJump) {
        playerLoadedAt = 0; // Clear load window once genuine transition is accepted
        syncActiveEpisode(s, eventEpisode);
      }
    }
  }

  if (!id) return;

  if (player_status === 'playing' || player_status === 'paused' || player_status === 'timeupdate') {
    const s = eventSeason || currentSeason;
    const ep = eventEpisode || currentEpisode;
    const key = isTv && s && ep
      ? `progress_${id}_s${s}_e${ep}`
      : `progress_${id}`;
    if (typeof player_progress === 'number' && player_progress > 5) {
      saveProgress(key, player_progress);
      saveProgress(`progress_${id}`, player_progress);
      if (isTv) {
        saveTVState(id, s, ep);
      }
      lastKnownProgress = { key, value: player_progress };
    }
  }

  // Auto-next episode handling when player completes and signals 'completed' / 'ended'
  if ((player_status === 'completed' || player_status === 'ended') && isTv) {
    const nextEp = (eventEpisode || currentEpisode) + 1;
    const season = eventSeason || currentSeason;
    toast(`Episode completed. Up next: Episode ${nextEp}`);
    updatePlayer(currentSource || 'vidsrc', season, nextEp);
  }
});

// Viduki player: auto-fallback across APIs + watch progress storage
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://www.viduki.net') return;
  let data = event.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { return; }
  }
  if (!data || typeof data !== 'object') return;

  if (data.type === 'MEDIA_DATA' && data.data) {
    try { localStorage.setItem('vidukinet-Progress', JSON.stringify(data.data)); } catch (e) {}
    return;
  }

  if (data.type === 'viduki:all-servers-failed' && currentSource === 'viduki') {
    if (vidukiApiIndex < 4) {
      vidukiApiIndex += 1;
      const iframe = document.querySelector('#media-player');
      if (iframe && currentMedia) {
        iframe.src = getVidukiUrl(currentMedia.id, type, currentSeason, currentEpisode);
      }
    } else {
      toast('Viduki: no working server found for this title');
    }
  }
});

// VidStuck player: save playback progress from postMessage events
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://vidstuck.cc') return;
  if (typeof event.data !== 'string') return;
  let data;
  try { data = JSON.parse(event.data); } catch (e) { return; }
  if (!data || typeof data.timestamp !== 'number' || data.timestamp <= 5) return;

  const mediaId = data.id || (currentMedia && currentMedia.id);
  if (!mediaId) return;
  const isTv = data.type === 'tv' || data.type === 'anime' || type === 'tv';
  const s = parseInt(data.season, 10) || currentSeason;
  const ep = parseInt(data.episode, 10) || currentEpisode;
  const key = isTv ? `progress_${mediaId}_s${s}_e${ep}` : `progress_${mediaId}`;
  saveProgress(key, data.timestamp);
  saveProgress(`progress_${mediaId}`, data.timestamp);
  if (isTv) saveTVState(mediaId, s, ep);
  lastKnownProgress = { key, value: data.timestamp };
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

    // --- Resume state (TV) ---
    // Keep track of where the user left off and restore currentSeason/currentEpisode
    // so selectors don't reset on page reload
    let resumeSeason = 1;
    let resumeEpisode = 1;
    let savedTv = null;
    if (type === 'tv') {
      savedTv = getTVState(item.id);
      if (savedTv && savedTv.season) {
        resumeSeason = Number(savedTv.season);
        if (savedTv.episode) resumeEpisode = Number(savedTv.episode);
        // Restore currentSeason/currentEpisode from saved state
        currentSeason = resumeSeason;
        currentEpisode = resumeEpisode;
      } else {
        // No saved state, default to 1/1
        currentSeason = 1;
        currentEpisode = 1;
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
                ${validSeasons.map(s => `<option value="${s.season_number}">S${s.season_number} (${s.episode_count || 0} eps)</option>`).join('')}
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

    const movieTitle = titleOf(item);
    const downloadUrl = `https://videodownloader.site/?${new URLSearchParams({ q: movieTitle }).toString()}`;

    const playerHtml = `
      <section class="preview content-section player-hidden" id="player-section">
        <div class="player-header">
          <span class="player-title" id="player-title">${titleOf(item)} ${type === 'tv' ? `— Season ${currentSeason}, Episode ${currentEpisode}` : ''} (${currentSource.charAt(0).toUpperCase() + currentSource.slice(1)} Server)</span>
          <div class="player-controls-right">
            <div class="default-player-selector">
              <label class="fact-label" for="default-player-select">Default Player:</label>
              <select class="default-player-select" id="default-player-select" onchange="setDefaultPlayer(this.value)">
                <option value="vidsrc" ${currentSource === 'vidsrc' ? 'selected' : ''}>VidSrc</option>
                <option value="vidrock" ${currentSource === 'vidrock' ? 'selected' : ''}>VidRock</option>
                <option value="vidup" ${currentSource === 'vidup' ? 'selected' : ''}>VidUp</option>
                <option value="viduki" ${currentSource === 'viduki' ? 'selected' : ''}>Viduki</option>
                <option value="vidstuck" ${currentSource === 'vidstuck' ? 'selected' : ''}>VidStuck</option>
                <option value="vidfast" ${currentSource === 'vidfast' ? 'selected' : ''}>VidFast</option>
                <option value="vidnest" ${currentSource === 'vidnest' ? 'selected' : ''}>VidNest</option>
                <option value="vidapi" ${currentSource === 'vidapi' ? 'selected' : ''}>VidApi</option>
              </select>
            </div>
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
              <button class="source-option ${currentSource === 'vidsrc' ? 'active' : ''}" id="source-vidsrc" type="button" onclick="updatePlayer('vidsrc'); scrollToPlayer();">
                <span> VidSrc</span>
              </button>
              <button class="source-option ${currentSource === 'vidrock' ? 'active' : ''}" id="source-vidrock" type="button" onclick="updatePlayer('vidrock'); scrollToPlayer();">
                <span> VidRock</span>
              </button>
              <button class="source-option ${currentSource === 'vidup' ? 'active' : ''}" id="source-vidup" type="button" onclick="updatePlayer('vidup'); scrollToPlayer();">
                <span> VidUp</span>
              </button>
              <button class="source-option ${currentSource === 'viduki' ? 'active' : ''}" id="source-viduki" type="button" onclick="updatePlayer('viduki'); scrollToPlayer();">
                <span> Viduki</span>
              </button>
              <button class="source-option ${currentSource === 'vidstuck' ? 'active' : ''}" id="source-vidstuck" type="button" onclick="updatePlayer('vidstuck'); scrollToPlayer();">
                <span> VidStuck</span>
              </button>
              <button class="source-option ${currentSource === 'vidfast' ? 'active' : ''}" id="source-vidfast" type="button" onclick="updatePlayer('vidfast'); scrollToPlayer();">
                <span> VidFast</span>
              </button>
              <button class="source-option ${currentSource === 'vidnest' ? 'active' : ''}" id="source-vidnest" type="button" onclick="updatePlayer('vidnest'); scrollToPlayer();">
                <span> VidNest</span>
              </button>
              <button class="source-option ${currentSource === 'vidapi' ? 'active' : ''}" id="source-vidapi" type="button" onclick="updatePlayer('vidapi'); scrollToPlayer();">
                <span> VidApi</span>
              </button>
              ${trailer ? `
                <button class="source-option" id="source-trailer" type="button" onclick="updatePlayer('trailer'); scrollToPlayer();">
                  <span> Official Trailer</span>
                </button>
              ` : ''}
              <button class="source-option pip-option" id="pip-btn" type="button" onclick="togglePictureInPicture()">
                <img src="assets/PIP.svg" alt="Picture in Picture" class="pip-icon">
                <span> Picture in Picture</span>
              </button>
              ${type === 'tv' ? `
                <button class="source-option next-ep-option" id="next-ep-btn" type="button" onclick="playNextEpisode()">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4"></polygon>
                    <line x1="19" y1="5" x2="19" y2="19"></line>
                  </svg>
                  <span> Next Episode</span>
                </button>
              ` : ''}
            </div>
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
            // For TV: check saved progress at the current position (not resumeSeason/Episode)
            // For movies: check the single movie progress key.
            const specificProgressKey = type === 'tv'
              ? `progress_${item.id}_s${currentSeason}_e${currentEpisode}`
              : `progress_${item.id}`;
            const savedProgress = getProgress(specificProgressKey);
            const hasSaved = savedProgress && parseFloat(savedProgress) > 10;
            const resumeLabel = type === 'tv'
              ? `↩ Resume S${currentSeason}E${currentEpisode} (${formatTime(savedProgress)})`
              : `↩ Resume from ${formatTime(savedProgress)}`;
            const downloadBtn = `
              <a class="button secondary download-btn" href="${downloadUrl}" target="_blank" rel="noopener noreferrer" title="Download ${movieTitle}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
            `;
            const savedToWatchlist = typeof isInWatchlist === 'function' && isInWatchlist(item.id, type);
            const watchlistBtn = `
              <button class="button secondary watchlist-btn${savedToWatchlist ? ' active' : ''}" id="watchlist-btn" onclick="toggleWatchlistSave()" title="${savedToWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>
                <span>${savedToWatchlist ? 'Saved' : 'Save'}</span>
              </button>
            `;
            // Watch now always plays from S1E1 for TV; Resume restores exact position.
            return hasSaved
              ? `<div class="watch-actions">
                   <button class="button primary" onclick="updatePlayer('${currentSource}', ${currentSeason}, ${currentEpisode}); scrollToPlayer();">${resumeLabel}</button>
                   <button class="button secondary" onclick="clearMediaProgress('${item.id}'); location.reload();" title="Start over"><img src="assets/Logos/play-button.png" alt="Play" class="btn-play-icon"> Watch from start</button>
                   ${downloadBtn}
                   ${watchlistBtn}
                 </div>`
              : `<div class="watch-actions">
                   <button class="button primary" onclick="updatePlayer('${currentSource}', 1, 1); scrollToPlayer();"><img src="assets/Logos/play-button.png" alt="Play" class="btn-play-icon"> Watch now</button>
                   ${downloadBtn}
                   ${watchlistBtn}
                 </div>`;
          })()}
        </div>
        <div class="detail-hero-poster">
          <div class="detail-poster-inner">
            <img class="detail-poster" src="${imageUrl(item.poster_path)}" alt="${titleOf(item)} poster">
            <div class="poster-shine"></div>
          </div>
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
            ${type === 'movie' ? `
              <div>
                <span class="fact-label">Director</span>
                <span class="fact-value">${director}</span>
              </div>
            ` : ''}
          </div>
          <div class="cast-section">
            <span class="fact-label">Cast</span>
            <div class="cast-list">${castList(item)}</div>
          </div>
        </div>
      </section>
      ${recommendations(item)}
    `;
    setupRowScrollButtons();
    initPosterTilt();

    // Update player title with correct source name
    const playerTitle = document.querySelector('#player-title');
    if (playerTitle) {
      const sourceName = currentSource.charAt(0).toUpperCase() + currentSource.slice(1);
      playerTitle.textContent = `${titleOf(item)} ${type === 'tv' ? `— Season ${currentSeason}, Episode ${currentEpisode}` : ''} (${sourceName} Server)`;
    }

    if (type === 'tv' && validSeasons.length) {
      if (!validSeasons.some(s => s.season_number === currentSeason)) {
        currentSeason = validSeasons[0].season_number;
      }
      // Set dropdown value BEFORE loading season
      const dropdown = document.querySelector('#season-dropdown');
      if (dropdown) {
        dropdown.value = currentSeason;
      }
      loadSeason(currentSeason);

      // Auto-open player if there's a saved state
      if (savedTv && savedTv.season) {
        setTimeout(() => {
          updatePlayer(currentSource, currentSeason, currentEpisode);
          scrollToPlayer();
        }, 100);
      }
    }
    if (location.hash === '#preview') {
      setTimeout(() => {
        updatePlayer('trailer');
        scrollToPlayer();
      }, 300);
    }
  } catch (e) {
    console.error('Details loading error:', e);
    showError(root, e.message);
  }
}

function initPosterTilt() {
  const container = document.querySelector('.detail-hero-poster');
  const card = container ? container.querySelector('.detail-poster-inner') : null;
  const shine = container ? container.querySelector('.poster-shine') : null;
  if (!container || !card) return;

  let rafId = null;
  const maxTilt = 14;

  const onMouseMove = (e) => {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normalX = (x / rect.width) * 2 - 1;
    const normalY = (y / rect.height) * 2 - 1;

    const rotateX = -normalY * maxTilt;
    const rotateY = normalX * maxTilt;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.04, 1.04, 1.04)`;
      if (shine) {
        const px = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const py = Math.max(0, Math.min(100, (y / rect.height) * 100));
        shine.style.background = `radial-gradient(circle at ${px.toFixed(1)}% ${py.toFixed(1)}%, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0) 65%)`;
      }
    });
  };

  const onMouseEnter = () => {
    card.style.transition = 'transform 0.12s ease-out, box-shadow 0.3s ease';
  };

  const onMouseLeave = () => {
    if (rafId) cancelAnimationFrame(rafId);
    card.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.5s ease';
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  };

  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseenter', onMouseEnter);
  container.addEventListener('mouseleave', onMouseLeave);
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
  // Update URL hash when switching seasons
  if (type === 'tv') {
    history.replaceState(null, '', `#s${number}e${currentEpisode}`);
  }
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

