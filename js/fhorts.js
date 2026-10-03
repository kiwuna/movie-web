const feed = document.querySelector('#fhorts-feed');
const genreRail = document.querySelector('#fhorts-genres');
const status = document.querySelector('#fhorts-status');
const categoryToggle = document.querySelector('.category-toggle');

if (categoryToggle) {
  categoryToggle.addEventListener('mouseenter', () => genreRail.classList.add('visible'));
  categoryToggle.addEventListener('mouseleave', () => genreRail.classList.remove('visible'));
}
if (genreRail) {
  genreRail.addEventListener('mouseenter', () => genreRail.classList.add('visible'));
  genreRail.addEventListener('mouseleave', () => genreRail.classList.remove('visible'));
}
const preferredGenres = ['Romance', 'Comedy', 'Horror', 'Drama', 'Thriller', 'Action', 'Science Fiction', 'Animation'];
let genreId = '', nextPage = 1, candidates = [], seenMovieIds = new Set(), fhortsLoading = false, exhausted = false, observer, feedVersion = 0, targetCards = 3, addingCards = false, soundEnabled = true;

function setStatus(message) { status.textContent = message; status.classList.toggle('show', Boolean(message)); }
function shuffle(items) { for (let index = items.length - 1; index > 0; index--) { const randomIndex = Math.floor(Math.random() * (index + 1)); [items[index], items[randomIndex]] = [items[randomIndex], items[index]]; } return items; }
function trailerOf(movie) { const videos = movie.videos?.results || []; return videos.find(video => video.site === 'YouTube' && video.type === 'Trailer' && video.official) || videos.find(video => video.site === 'YouTube' && video.type === 'Trailer'); }
function randomTrailerStart() { return 15 + Math.floor(Math.random() * 60); }
function trailerUrl(key, autoplay = true) { return `https://www.youtube-nocookie.com/embed/${key}?autoplay=${autoplay ? 1 : 0}&mute=0&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&playsinline=1&rel=0&start=${randomTrailerStart()}&enablejsapi=1&cc_load_policy=0&hl=en&showinfo=0&cc=0&caption=false&captions=false`; }

async function fillCandidates() {
  if (fhortsLoading || exhausted) return;
  fhortsLoading = true;
  try {
    const data = await discoverMovies({ sort_by: 'popularity.desc', with_genres: genreId, 'vote_count.gte': 25, page: nextPage });
    nextPage += 1;
    const fresh = (data.results || []).filter(movie => !seenMovieIds.has(movie.id));
    candidates.push(...shuffle(fresh));
    exhausted = !fresh.length || nextPage > Math.min(data.total_pages || 1, 500);
  } catch (error) { setStatus(error.message); } finally { fhortsLoading = false; }
}

function createCard(movie, trailer) {
  const card = document.createElement('article');
  card.className = 'fhort';
  card.style.setProperty('--fhort-backdrop', `url("${imageUrl(movie.backdrop_path, 'original')}")`);
  const genreNames = (movie.genres || []).map(genre => genre.name).join(' · ') || 'Movie trailer';
  card.innerHTML = `<div class="fhort-video"><iframe data-trailer-key="${trailer.key}" title="${titleOf(movie)} trailer" allow="autoplay; encrypted-media; picture-in-picture"></iframe></div><div class="fhort-info"><div class="fhort-copy"><p class="eyebrow">Trailer spotlight</p><h2>${titleOf(movie)}</h2><p class="fhort-meta">${yearOf(movie)} <strong>★ ${(movie.vote_average || 0).toFixed(1)}</strong> · ${genreNames}</p><p class="fhort-overview">${movie.overview || 'Discover your next movie night.'}</p><div class="fhort-actions"><a class="fhort-details" href="details.html?id=${movie.id}&type=movie">Details</a></div></div></div>`;
  card.addEventListener('click', event => { if (!event.target.closest('a')) togglePlayback(card); });
  observer.observe(card);
  return card;
}

async function appendFhort() {
  const version = feedVersion;
  if (!candidates.length) await fillCandidates();
  if (version !== feedVersion) return false;
  while (candidates.length) {
    const candidate = candidates.shift();
    seenMovieIds.add(candidate.id);
    try {
      const movie = await getMovieDetails(candidate.id);
      if (version !== feedVersion) return false;
      const trailer = trailerOf(movie);
      if (!trailer) continue;
      feed.append(createCard(movie, trailer));
      setStatus('');
      return true;
    } catch (error) { console.warn('Could not load Fhort:', error); }
  }
  if (!exhausted) return appendFhort();
  setStatus('No more trailers found for this genre.');
  return false;
}

async function keepFeedReady(target = 3) { targetCards = Math.max(targetCards, target); if (addingCards) return; addingCards = true; while (feed.children.length < targetCards) { if (!await appendFhort()) break; } addingCards = false; }
function playerCommand(iframe, command, args = []) { iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: command, args }), '*'); }
function activateSound(iframe) { setTimeout(() => { playerCommand(iframe, 'playVideo'); playerCommand(iframe, 'unMute'); playerCommand(iframe, 'setVolume', [100]); playerCommand(iframe, 'setPlaybackQuality', ['hd720']); }, 700); }
function startTrailer(card) { const iframe = card.querySelector('iframe'); if (!iframe) return; if (iframe.dataset.loaded !== 'true') { iframe.src = trailerUrl(iframe.dataset.trailerKey); iframe.dataset.loaded = 'true'; } document.querySelectorAll('.fhort').forEach(c => { if (c !== card) pauseTrailer(c); }); playerCommand(iframe, 'playVideo'); setTimeout(() => { playerCommand(iframe, 'setOption', ['captions', 'track', {languageCode: 'off'}]); playerCommand(iframe, 'setOption', ['captions', 'reload']); }, 500); activateSound(iframe); card.dataset.playing = 'true'; }
function preloadTrailer(card) { const iframe = card?.querySelector('iframe'); if (iframe && iframe.dataset.loaded !== 'true') { iframe.src = trailerUrl(iframe.dataset.trailerKey, false); iframe.dataset.loaded = 'true'; } }
function pauseTrailer(card) { const iframe = card.querySelector('iframe'); playerCommand(iframe, 'pauseVideo'); playerCommand(iframe, 'mute'); card.dataset.playing = 'false'; }
function togglePlayback(card) { const iframe = card.querySelector('iframe'); if (!iframe || iframe.dataset.loaded !== 'true') return; const playing = card.dataset.playing !== 'false'; if (playing) { playerCommand(iframe, 'pauseVideo'); playerCommand(iframe, 'mute'); } else { playerCommand(iframe, 'playVideo'); activateSound(iframe); } card.dataset.playing = String(!playing); }
function setupObserver() { observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { const cards = [...feed.children]; const index = cards.indexOf(entry.target); startTrailer(entry.target); preloadTrailer(cards[index + 1]); if (index >= cards.length - 2) keepFeedReady(feed.children.length + 2); } else pauseTrailer(entry.target); }), { root: feed, threshold: .7 }); }

async function selectGenre(button) {
  genreId = button.dataset.genreId;
  genreRail.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
  feedVersion += 1;
  observer.disconnect(); feed.replaceChildren(); candidates = []; seenMovieIds = new Set(); nextPage = 1; exhausted = false; targetCards = 3;
  setStatus(`Loading ${button.textContent} trailers…`); setupObserver(); await keepFeedReady();
}

async function init() {
  setupObserver();
  try {
    const { genres } = await getMovieGenres();
    const options = [{ id: '', name: 'All' }, ...preferredGenres.map(name => genres.find(genre => genre.name === name)).filter(Boolean)];
    options.forEach((genre, index) => { const button = document.createElement('button'); button.type = 'button'; button.className = `fhorts-genre${index === 0 ? ' active' : ''}`; button.dataset.genreId = genre.id; button.textContent = genre.name === 'Science Fiction' ? 'Sci-Fi' : genre.name; button.addEventListener('click', () => selectGenre(button)); genreRail.append(button); });
    await keepFeedReady();
  } catch (error) { setStatus(error.message); }
}
init();
