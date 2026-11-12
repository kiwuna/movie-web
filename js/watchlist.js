const WATCHLIST_KEY = 'zanora_watchlist';

function getWatchlist() {
  try {
    const data = localStorage.getItem(WATCHLIST_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveWatchlist(list) {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save watchlist:', e);
  }
}

function isInWatchlist(id, mediaType) {
  return getWatchlist().some(item => item.id === id && item.media_type === mediaType);
}

function removeFromWatchlist(id, mediaType) {
  const list = getWatchlist().filter(item => !(item.id === id && item.media_type === mediaType));
  saveWatchlist(list);
  return list;
}

function clearWatchlist() {
  saveWatchlist([]);
}

// Called from the details page save button (uses currentMedia/type globals)
function toggleWatchlistSave() {
  if (typeof currentMedia === 'undefined' || !currentMedia) {
    toast('Nothing to save');
    return;
  }
  const mediaType = (typeof type !== 'undefined' && type) ? type : 'movie';
  const mediaId = currentMedia.id;
  const list = getWatchlist();
  const existingIndex = list.findIndex(item => item.id === mediaId && item.media_type === mediaType);
  const btn = document.querySelector('#watchlist-btn');
  const label = btn ? btn.querySelector('span') : null;

  if (existingIndex >= 0) {
    list.splice(existingIndex, 1);
    saveWatchlist(list);
    toast('Removed from watchlist');
    if (btn) {
      btn.classList.remove('active');
      btn.title = 'Add to watchlist';
      if (label) label.textContent = 'Save';
    }
  } else {
    const title = (typeof titleOf === 'function') ? titleOf(currentMedia) : (currentMedia.title || currentMedia.name);
    list.unshift({
      id: mediaId,
      title: title,
      poster_path: currentMedia.poster_path,
      backdrop_path: currentMedia.backdrop_path,
      release_date: currentMedia.release_date || currentMedia.first_air_date,
      vote_average: currentMedia.vote_average,
      media_type: mediaType,
      saved_at: Date.now()
    });
    saveWatchlist(list);
    toast('Added to watchlist');
    if (btn) {
      btn.classList.add('active');
      btn.title = 'Remove from watchlist';
      if (label) label.textContent = 'Saved';
    }
  }
}

function watchlistCard(item) {
  const media = item.media_type === 'tv' ? 'tv' : 'movie';
  const year = (item.release_date || '').slice(0, 4) || '—';
  return `
    <div class="history-card-wrapper" data-id="${item.id}">
      <button class="history-card-remove" onclick="removeFromWatchlistAndRefresh(${item.id}, '${media}')" title="Remove from watchlist">×</button>
      <a class="media-card" href="details.html?id=${item.id}&type=${media}">
        <img src="${imageUrl(item.poster_path)}" alt="${item.title} poster" loading="lazy">
        <div class="card-overlay">
          <h3>${item.title}</h3>
          <p>${year} <span class="rating">★ ${(item.vote_average || 0).toFixed(1)}</span></p>
          <span class="card-action">View details <svg class="arrow-icon" width="8" height="8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.2929 4.29289C12.6834 3.90237 13.3166 3.90237 13.7071 4.29289L20.7071 11.2929C21.0976 11.6834 21.0976 12.3166 20.7071 12.7071L13.7071 19.7071C13.3166 20.0976 12.6834 20.0976 12.2929 19.7071C11.9024 19.3166 11.9024 18.6834 12.2929 18.2929L17.5858 13H4C3.44772 13 3 12.5523 3 12C3 11.4477 3.44772 11 4 11H17.5858L12.2929 5.70711C11.9024 5.31658 11.9024 4.68342 12.2929 4.29289Z" fill="currentColor"/></svg></span>
        </div>
      </a>
    </div>
  `;
}

function renderWatchlist() {
  const grid = document.querySelector('#watchlist-grid');
  const countEl = document.querySelector('#result-count');
  const emptyEl = document.querySelector('#empty-state');

  if (!grid) return;

  const list = getWatchlist();

  if (list.length === 0) {
    grid.innerHTML = '';
    if (countEl) countEl.textContent = '';
    if (emptyEl) emptyEl.hidden = false;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  if (countEl) countEl.textContent = `${list.length} title${list.length !== 1 ? 's' : ''} in your watchlist`;
  grid.innerHTML = list.map(item => watchlistCard(item)).join('');
}

function removeFromWatchlistAndRefresh(movieId, mediaType) {
  removeFromWatchlist(movieId, mediaType || 'movie');
  renderWatchlist();
  toast('Removed from watchlist');
}

function clearWatchlistWithConfirmation() {
  const list = getWatchlist();
  if (list.length === 0) {
    toast('Watchlist is already empty');
    return;
  }
  if (confirm('Are you sure you want to clear your entire watchlist? This cannot be undone.')) {
    clearWatchlist();
    renderWatchlist();
    toast('Watchlist cleared');
  }
}

function loadWatchlistPage() {
  renderWatchlist();

  const clearBtn = document.querySelector('#clear-watchlist');
  if (clearBtn) {
    clearBtn.onclick = clearWatchlistWithConfirmation;
  }

  const browseBtn = document.querySelector('#browse-movies');
  if (browseBtn) {
    browseBtn.onclick = () => {
      location.href = 'movies.html';
    };
  }
}

// Check if we're on the watchlist page by looking for the watchlist grid element
if (document.querySelector('#watchlist-grid')) {
  loadWatchlistPage();
}
