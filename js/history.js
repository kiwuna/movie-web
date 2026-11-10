const HISTORY_KEY = 'zanora_watched_history';

function getHistory() {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

function addToHistory(movie) {
  const history = getHistory();
  const existingIndex = history.findIndex(item => item.id === movie.id);
  
  const historyItem = {
    id: movie.id,
    title: movie.title || movie.name,
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    release_date: movie.release_date || movie.first_air_date,
    vote_average: movie.vote_average,
    genres: movie.genres || [],
    media_type: movie.media_type || 'movie',
    watched_at: Date.now()
  };
  
  if (existingIndex >= 0) {
    history.splice(existingIndex, 1);
  }
  
  history.unshift(historyItem);
  saveHistory(history);
}

function removeFromHistory(movieId) {
  const history = getHistory();
  const filtered = history.filter(item => item.id !== movieId);
  saveHistory(filtered);
  return filtered;
}

function clearHistory() {
  saveHistory([]);
}

function historyCard(item) {
  const media = item.media_type === 'tv' ? 'tv' : 'movie';
  const year = (item.release_date || '').slice(0, 4) || '—';
  return `
    <div class="history-card-wrapper" data-id="${item.id}">
      <button class="history-card-remove" onclick="removeFromHistoryAndRefresh(${item.id})" title="Remove from history">×</button>
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

function renderHistory() {
  const grid = document.querySelector('#history-grid');
  const countEl = document.querySelector('#result-count');
  const emptyEl = document.querySelector('#empty-state');
  
  if (!grid) return;
  
  const history = getHistory();
  
  if (history.length === 0) {
    grid.innerHTML = '';
    countEl.textContent = '';
    emptyEl.hidden = false;
    return;
  }
  
  emptyEl.hidden = true;
  countEl.textContent = `${history.length} movie${history.length !== 1 ? 's' : ''} in your history`;
  grid.innerHTML = history.map(item => historyCard(item)).join('');
}

function removeFromHistoryAndRefresh(movieId) {
  removeFromHistory(movieId);
  renderHistory();
  toast('Removed from history');
}

function clearHistoryWithConfirmation() {
  const history = getHistory();
  if (history.length === 0) {
    toast('History is already empty');
    return;
  }
  
  if (confirm('Are you sure you want to clear your entire watch history? This cannot be undone.')) {
    clearHistory();
    renderHistory();
    toast('History cleared');
  }
}

function loadHistoryPage() {
  renderHistory();
  
  const clearBtn = document.querySelector('#clear-history');
  if (clearBtn) {
    clearBtn.onclick = clearHistoryWithConfirmation;
  }
  
  const browseBtn = document.querySelector('#browse-movies');
  if (browseBtn) {
    browseBtn.onclick = () => {
      location.href = 'movies.html';
    };
  }
}

// Check if we're on the history page by looking for the history grid element
if (document.querySelector('#history-grid')) {
  loadHistoryPage();
}
