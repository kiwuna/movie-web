const SURPRISE_MODAL = document.querySelector('#surprise-modal');
const SURPRISE_CLOSE = document.querySelector('#surprise-close');
const SURPRISE_FILTERS = document.querySelector('#surprise-filters');
const SURPRISE_RESULT = document.querySelector('#surprise-result');
const SURPRISE_GO = document.querySelector('#surprise-go');
const SURPRISE_GENRE = document.querySelector('#surprise-genre');
const SURPRISE_RATING = document.querySelector('#surprise-rating');
const SURPRISE_DECADE = document.querySelector('#surprise-decade');
const SURPRISE_LOADING = document.querySelector('#surprise-loading');
const SURPRISE_MOVIE = document.querySelector('#surprise-movie');
const SURPRISE_ERROR = document.querySelector('#surprise-error');

function openSurpriseModal() {
  if (!SURPRISE_MODAL) return;
  SURPRISE_MODAL.hidden = false;
  SURPRISE_FILTERS.hidden = false;
  SURPRISE_RESULT.hidden = true;
  SURPRISE_MOVIE.innerHTML = '';
  SURPRISE_ERROR.innerHTML = '';
  loadGenres();
}

function closeSurpriseModal() {
  if (!SURPRISE_MODAL) return;
  SURPRISE_MODAL.hidden = true;
}

async function loadGenres() {
  if (!SURPRISE_GENRE) return;
  try {
    const data = await getMovieGenres();
    const currentValue = SURPRISE_GENRE.value;
    SURPRISE_GENRE.innerHTML = '<option value="">Any genre</option>';
    data.genres.forEach(genre => {
      const option = document.createElement('option');
      option.value = genre.id;
      option.textContent = genre.name;
      SURPRISE_GENRE.appendChild(option);
    });
    SURPRISE_GENRE.value = currentValue;
  } catch (e) {
    console.error('Failed to load genres:', e);
  }
}

function getDecadeRange(decade) {
  const start = parseInt(decade);
  const end = start + 9;
  return `${start}-01-01,${end}-12-31`;
}

async function findSurpriseMovie() {
  if (!SURPRISE_FILTERS || !SURPRISE_RESULT) return;
  
  SURPRISE_FILTERS.hidden = true;
  SURPRISE_RESULT.hidden = false;
  SURPRISE_LOADING.hidden = false;
  SURPRISE_MOVIE.innerHTML = '';
  SURPRISE_ERROR.innerHTML = '';
  
  const genre = SURPRISE_GENRE?.value || '';
  const minRating = SURPRISE_RATING?.value || '';
  const decade = SURPRISE_DECADE?.value || '';
  
  const params = {
    page: 1
  };
  
  if (genre) {
    params.with_genres = genre;
  }
  
  if (minRating) {
    params['vote_average.gte'] = minRating;
  }
  
  if (decade) {
    params['primary_release_date.gte'] = `${decade}-01-01`;
    params['primary_release_date.lte'] = `${parseInt(decade) + 9}-12-31`;
  }
  
  params.sort_by = 'popularity.desc';
  
  try {
    const data = await discoverMovies(params);
    const movies = data.results || [];
    
    if (movies.length === 0) {
      SURPRISE_LOADING.hidden = true;
      SURPRISE_ERROR.textContent = 'No movies found — try different filters.';
      SURPRISE_ERROR.hidden = false;
      return;
    }
    
    const randomMovie = movies[Math.floor(Math.random() * movies.length)];
    displaySurpriseMovie(randomMovie);
  } catch (e) {
    console.error('Failed to find movie:', e);
    SURPRISE_LOADING.hidden = true;
    SURPRISE_ERROR.textContent = 'Failed to find a movie. Please try again.';
    SURPRISE_ERROR.hidden = false;
  }
}

function displaySurpriseMovie(movie) {
  if (!SURPRISE_MOVIE) return;
  
  SURPRISE_LOADING.hidden = true;
  
  const year = (movie.release_date || '').slice(0, 4) || '—';
  const genres = (movie.genres || []).map(g => g.name).join(' · ') || 'Not available';
  
  SURPRISE_MOVIE.innerHTML = `
    <div class="surprise-movie-card">
      <img class="surprise-movie-poster" src="${imageUrl(movie.poster_path)}" alt="${titleOf(movie)} poster">
      <div class="surprise-movie-info">
        <h3 class="surprise-movie-title">${titleOf(movie)}</h3>
        <div class="surprise-movie-meta">
          <span>${year}</span>
          <span class="rating">★ ${(movie.vote_average || 0).toFixed(1)}</span>
        </div>
        <p class="surprise-movie-overview">${movie.overview || 'No overview available.'}</p>
        <div class="surprise-movie-actions">
          <a class="button primary" href="details.html?id=${movie.id}&type=movie">Watch</a>
          <button class="button secondary" onclick="resetSurpriseFilters()">Try Again</button>
        </div>
      </div>
    </div>
  `;
}

function resetSurpriseFilters() {
  if (!SURPRISE_FILTERS || !SURPRISE_RESULT) return;
  SURPRISE_FILTERS.hidden = false;
  SURPRISE_RESULT.hidden = true;
  SURPRISE_MOVIE.innerHTML = '';
  SURPRISE_ERROR.innerHTML = '';
}

if (SURPRISE_CLOSE) {
  SURPRISE_CLOSE.onclick = closeSurpriseModal;
}

if (SURPRISE_GO) {
  SURPRISE_GO.onclick = findSurpriseMovie;
}

if (SURPRISE_MODAL) {
  SURPRISE_MODAL.addEventListener('click', (e) => {
    if (e.target === SURPRISE_MODAL) {
      closeSurpriseModal();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !SURPRISE_MODAL?.hidden) {
    closeSurpriseModal();
  }
});
