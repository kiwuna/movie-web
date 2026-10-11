/**
 * "What Are You Thinking?" - Interactive Movie Recommendation Engine for Zanora
 * 
 * Flow:
 * 1. User answers 9 fun mood/preference questions (one at a time)
 * 2. Questions map to soft criteria, hard filters, and local scoring models
 * 3. Discover candidates from TMDB API
 * 4. Multi-variable scoring ranks candidates
 * 5. High-score candidate chosen with controlled randomness
 * 6. Smooth transition ("Okay... I think I know what you're looking for.")
 * 7. Cinematic result card revealed with trailer, view movie, and try again
 */

(function () {
  // Question Definitions matching user requirements
  const WAI_QUESTIONS = [
    {
      id: 'media_type',
      title: 'What are you in the mood for?',
      subtitle: 'Choose your preferred format.',
      options: [
        { id: 'movie', label: 'Movie', desc: 'A complete story in one sitting', icon: '' },
        { id: 'tv', label: 'TV Show', desc: 'Episodic storytelling with longer arcs', icon: '' },
        { id: 'any', label: "Doesn't matter", desc: 'Surprise me with either', icon: '' }
      ]
    },
    {
      id: 'animation',
      title: 'Animated or live-action?',
      subtitle: 'Pick your preferred visual style.',
      options: [
        { id: 'live_action', label: 'Live-action', desc: 'Real actors and practical effects', icon: '' },
        { id: 'animated', label: 'Animated', desc: 'Hand-drawn, CGI, or stop-motion art', icon: '' },
        { id: 'any', label: "Doesn't matter", desc: 'Great stories come in all forms', icon: '' }
      ]
    },
    {
      id: 'feel',
      title: 'What do you want to feel?',
      subtitle: 'Pick the emotional wave you want to ride tonight.',
      options: [
        { id: 'laugh', label: 'Laugh', desc: 'Lighthearted, witty or silly fun', icon: '' },
        { id: 'feel_something', label: 'Feel something', desc: 'Deep emotions and moving stories', icon: '' },
        { id: 'fall_in_love', label: 'Fall in love', desc: 'Butterflies, romance, and heartstrings', icon: '' },
        { id: 'stressed', label: 'Be stressed', desc: 'Edge of your seat, nail-biting suspense', icon: '' },
        { id: 'think', label: 'Think', desc: 'Mind-bending mysteries and deep themes', icon: '' },
        { id: 'badass', label: 'Feel badass', desc: 'High adrenaline, slick action, and power', icon: '' },
        { id: 'scared', label: 'Get scared', desc: 'Creepy chills, jump scares, and dark thrills', icon: '' },
        { id: 'warm', label: 'Feel warm', desc: 'Cozy, uplifting comfort cinema', icon: '' }
      ]
    },
    {
      id: 'energy',
      title: "What's the energy?",
      subtitle: 'How fast should the narrative rhythm move?',
      options: [
        { id: 'fast', label: 'Fast-paced', desc: 'No filler, keeps moving from start to finish', icon: '' },
        { id: 'slow', label: 'Slow & atmospheric', desc: 'Rich world, moody scenes, and patient buildup', icon: '' },
        { id: 'balanced', label: 'A bit of everything', desc: 'Well-rounded dynamic pacing', icon: '' },
        { id: 'chill', label: 'Chill', desc: 'Easygoing vibe with no rush', icon: '' }
      ]
    },
    {
      id: 'seriousness',
      title: 'How serious should it be?',
      subtitle: 'From pure playfulness to emotional devastation.',
      options: [
        { id: 'light', label: "Don't take itself seriously", desc: 'Fun, tongue-in-cheek, zero pretension', icon: '' },
        { id: 'balanced', label: 'Balanced', desc: 'Has real weight, but leaves room to breathe', icon: '' },
        { id: 'pretty_serious', label: 'Pretty serious', desc: 'Grounded, authentic, and dramatic stakes', icon: '' },
        { id: 'destroy_me', label: 'Absolutely destroy me', desc: 'Prepare tissues or an existential crisis', icon: '' }
      ]
    },
    {
      id: 'runtime',
      title: 'How long do you want it to be?',
      subtitle: 'Match the length of your viewing session.',
      options: [
        { id: 'under_90', label: 'Under 90 minutes', desc: 'Short, sweet, and tight runtime', icon: '' },
        { id: '90_120', label: '90–120 minutes', desc: 'The classic feature film sweet spot', icon: '' },
        { id: 'over_120', label: 'Over 2 hours', desc: 'Epic journey or immersive deep dive', icon: '' },
        { id: 'any', label: "Doesn't matter", desc: 'Whatever fits the story best', icon: '' }
      ]
    },
    {
      id: 'era',
      title: 'What era?',
      subtitle: 'Choose a time period that resonates.',
      options: [
        { id: 'recent', label: 'Recent', desc: '2020 to today (modern looks & sound)', icon: '' },
        { id: '2010s', label: '2010s', desc: 'The golden decade of modern blockbusters & indies', icon: '' },
        { id: '2000s', label: '2000s', desc: 'Y2K nostalgia and iconic cinematic staples', icon: '' },
        { id: 'older', label: 'Older', desc: 'Pre-2000s vintage classics and 90s gold', icon: '' },
        { id: 'any', label: 'Any era', desc: 'Great movies transcend time', icon: '' }
      ]
    },
    {
      id: 'popularity',
      title: 'How popular should it be?',
      subtitle: 'Mainstream crowd-pleaser or obscure masterpiece?',
      options: [
        { id: 'everyone', label: 'Something everyone knows', desc: 'Universal crowd favorite or massive hit', icon: '' },
        { id: 'popular_subtle', label: 'Popular but not obvious', desc: 'Critically acclaimed without being overplayed', icon: '' },
        { id: 'hidden_gem', label: 'A hidden gem', desc: 'Underrated gem waiting to be discovered', icon: '' },
        { id: 'surprise', label: 'Surprise me', desc: 'Give me anything that hits the mark', icon: '' }
      ]
    },
    {
      id: 'romance',
      title: 'How much romance?',
      subtitle: 'Are love stories on tonight\'s agenda?',
      options: [
        { id: 'none', label: 'None', desc: 'Zero romantic focus or love subplots', icon: '' },
        { id: 'little', label: 'A little', desc: 'Subtle chemistry or light side plot', icon: '' },
        { id: 'important', label: 'Important part', desc: 'Core relationship that drives the plot', icon: '' },
        { id: 'whole_thing', label: 'Basically the whole thing', desc: 'Full-blown passionate romance', icon: '' }
      ]
    },
    {
      id: 'chaos',
      title: 'How much chaos?',
      subtitle: 'From peaceful calm to absolute anarchy.',
      options: [
        { id: 'peaceful', label: 'Peaceful', desc: 'Calm, gentle, low-stress storytelling', icon: '' },
        { id: 'some_drama', label: 'Some drama', desc: 'Everyday friction and grounded conflict', icon: '' },
        { id: 'messy', label: 'Things are getting messy', desc: 'Wild turns, spiraling choices, and complications', icon: '' },
        { id: 'therapy', label: 'Everyone needs therapy', desc: 'Peak unhinged chaos and psychological wreckage', icon: '' }
      ]
    },
    {
      id: 'character',
      title: 'What kind of main character?',
      subtitle: 'Who should guide your journey?',
      options: [
        { id: 'teen', label: 'Teenager', desc: 'Coming-of-age, youthful rebellion & discovery', icon: '' },
        { id: 'adult', label: 'Adult', desc: 'Career, personal battles, and life complexity', icon: '' },
        { id: 'older', label: 'Older character', desc: 'Seasoned veterans, wisdom, and retrospective look', icon: '' },
        { id: 'ensemble', label: 'Ensemble / cast', desc: 'Group dynamics, crews, or multi-perspective narratives', icon: '' },
        { id: 'any', label: "Doesn't matter", desc: 'Any compelling protagonist', icon: '' }
      ]
    }
  ];

  // TMDB Genre ID dictionary for scoring and mapping
  const GENRE_MAP = {
    Action: 28,
    Adventure: 12,
    Animation: 16,
    Comedy: 35,
    Crime: 80,
    Documentary: 99,
    Drama: 18,
    Family: 10751,
    Fantasy: 14,
    History: 36,
    Horror: 27,
    Music: 10402,
    Mystery: 9648,
    Romance: 10749,
    SciFi: 878,
    TVMovie: 10770,
    Thriller: 53,
    War: 10752,
    Western: 37
  };

  // State management
  let currentStep = 0;
  let userAnswers = {};
  let currentMatchedMovie = null;
  let isThinking = false;

  // Initialize UI modal element once DOM is ready
  function initThinkingFeature() {
    createThinkingModal();
    attachGlobalTriggers();
    console.log('Thinking feature initialized');
  }

  // Create the modal DOM markup and append to body
  function createThinkingModal() {
    if (document.querySelector('#wai-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'wai-modal';
    overlay.className = 'wai-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="wai-modal-container" id="wai-container">
        <div class="wai-topbar">
          <div class="wai-topbar-title">
            <span class="wai-badge">
              <span class="wai-badge-dot"></span>
              What Are You Thinking?
            </span>
          </div>
          <button class="wai-close-btn" id="wai-close" aria-label="Close interactive quiz">✕</button>
        </div>

        <div class="wai-progress-bar-wrap">
          <div class="wai-progress-bar-fill" id="wai-progress-fill"></div>
        </div>

        <div class="wai-step-indicator" id="wai-step-indicator">
          <span id="wai-step-label">Question 1 of ${WAI_QUESTIONS.length}</span>
          <div class="wai-step-dots" id="wai-step-dots"></div>
        </div>

        <div class="wai-body" id="wai-body">
          <!-- Dynamically populated step content -->
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close handlers
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeThinkingModal();
    });

    const closeBtn = overlay.querySelector('#wai-close');
    if (closeBtn) closeBtn.onclick = closeThinkingModal;

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) {
        closeThinkingModal();
      }
    });
  }

  // Open modal and reset to first question or continue
  function openThinkingModal() {
    console.log('openThinkingModal called');
    const modal = document.querySelector('#wai-modal');
    if (!modal) {
      console.error('Modal not found');
      return;
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    modal.scrollTop = 0; // Scroll modal to top

    // If starting fresh or already on result, start at 0
    if (currentStep >= WAI_QUESTIONS.length || Object.keys(userAnswers).length === 0) {
      currentStep = 0;
      userAnswers = {};
    }
    renderStep();
  }

  // Close modal
  function closeThinkingModal() {
    const modal = document.querySelector('#wai-modal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';

    // Stop any playing trailer inside the modal
    const trailerBox = modal.querySelector('#wai-trailer-container');
    if (trailerBox) trailerBox.innerHTML = '';
  }

  // Attach triggers to nav buttons & any elements with data-wai-trigger
  function attachGlobalTriggers() {
    // 1. Add "What Am I Thinking Of?" button into main header navigation (removed from nav)
    // const navLinks = document.querySelector('.site-header .nav-links');
    // if (navLinks && !document.querySelector('#nav-wai-btn')) {
    //   const btn = document.createElement('button');
    //   btn.id = 'nav-wai-btn';
    //   btn.className = 'nav-wai-btn';
    //   btn.innerHTML = `What Am I Thinking Of?`;
    //   btn.title = 'Let Zanora guess your mood and pick the perfect movie';
    //   btn.onclick = (e) => {
    //     e.preventDefault();
    //     openThinkingModal();
    //   };
    //   navLinks.appendChild(btn);
    // }

    // 2. Delegate click for anything with class or attribute
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('.open-wai-modal, [data-action="open-wai"]');
      if (trigger) {
        e.preventDefault();
        openThinkingModal();
      }
    });
  }



  // Render current question step
  function renderStep() {
    const body = document.querySelector('#wai-body');
    const stepLabel = document.querySelector('#wai-step-label');
    const stepDots = document.querySelector('#wai-step-dots');
    const progressFill = document.querySelector('#wai-progress-fill');
    const stepIndicator = document.querySelector('#wai-step-indicator');
    if (!body) return;

    if (stepIndicator) stepIndicator.style.display = 'flex';

    // Filter out runtime question if TV show selected
    const filteredQuestions = userAnswers.media_type === 'tv' 
      ? WAI_QUESTIONS.filter(q => q.id !== 'runtime')
      : WAI_QUESTIONS;
    
    // Map current step to filtered questions
    const q = filteredQuestions[currentStep];
    const total = filteredQuestions.length;

    // Update progress bar & pips
    const percent = ((currentStep + 1) / total) * 100;
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (stepLabel) stepLabel.textContent = `Question ${currentStep + 1} of ${total}`;

    if (stepDots) {
      stepDots.innerHTML = filteredQuestions.map((_, idx) => {
        let cls = 'wai-step-pip';
        if (idx === currentStep) cls += ' active';
        else if (idx < currentStep) cls += ' passed';
        return `<span class="${cls}"></span>`;
      }).join('');
    }

    const currentSelected = userAnswers[q.id];
    const is3Cols = q.options.length >= 6;

    body.innerHTML = `
      <div class="wai-question-view">
        <div class="wai-question-header">
          <h3 class="wai-question-title">${q.title}</h3>
          <p class="wai-question-subtitle">${q.subtitle}</p>
        </div>

        <div class="wai-options-grid ${is3Cols ? 'cols-3' : ''}">
          ${q.options.map(opt => `
            <button type="button" class="wai-option-card ${currentSelected === opt.id ? 'selected' : ''}" data-val="${opt.id}">
              <div class="wai-option-content">
                <span class="wai-option-label">${opt.label}</span>
                <span class="wai-option-desc">${opt.desc}</span>
              </div>
            </button>
          `).join('')}
        </div>

        <div class="wai-actions-bar">
          <button type="button" class="wai-btn-back" id="wai-back" ${currentStep === 0 ? 'disabled' : ''}>
            ← Previous
          </button>
          <span class="wai-keyboard-hint">Select an answer to proceed</span>
        </div>
      </div>
    `;

    // Bind option click
    const optionCards = body.querySelectorAll('.wai-option-card');
    optionCards.forEach(card => {
      card.onclick = () => {
        const val = card.getAttribute('data-val');
        userAnswers[q.id] = val;
        card.classList.add('selected');

        // Smooth transition to next step after brief click feedback
        setTimeout(() => {
          goToNextStep();
        }, 180);
      };
    });

    // Back button
    const backBtn = body.querySelector('#wai-back');
    if (backBtn) {
      backBtn.onclick = () => {
        if (currentStep > 0) {
          currentStep--;
          // Skip runtime when going back if TV show selected
          if (userAnswers.media_type === 'tv' && WAI_QUESTIONS[currentStep].id === 'runtime') {
            currentStep--;
          }
          renderStep();
        }
      };
    }
  }

  // Advance step or trigger recommendation computation
  function goToNextStep() {
    const filteredQuestions = userAnswers.media_type === 'tv' 
      ? WAI_QUESTIONS.filter(q => q.id !== 'runtime')
      : WAI_QUESTIONS;
    
    if (currentStep < filteredQuestions.length - 1) {
      currentStep++;
      renderStep();
    } else {
      // Completed all questions! Show thinking transition & select recommendation
      showThinkingTransition();
    }
  }

  // Transition screen: "Okay... I think I know what you're looking for."
  async function showThinkingTransition() {
    isThinking = true;
    const body = document.querySelector('#wai-body');
    const stepIndicator = document.querySelector('#wai-step-indicator');
    const progressFill = document.querySelector('#wai-progress-fill');
    if (!body) return;

    if (stepIndicator) stepIndicator.style.display = 'none';
    if (progressFill) progressFill.style.width = '100%';

    body.innerHTML = `
      <div class="wai-thinking-view">
        <div class="wai-thinking-orb-wrap">
          <div class="wai-thinking-ring"></div>
          <div class="wai-thinking-orb"></div>
        </div>
        <h3 class="wai-thinking-phrase" id="wai-thinking-text">Reading your mood...</h3>
        <p class="wai-thinking-sub" id="wai-thinking-sub">Translating your energy, chaos tolerance, and runtime into cinema.</p>
      </div>
    `;

    const thinkingTexts = [
      { main: 'Reading your mood...', sub: 'Connecting feelings with our TMDB database...' },
      { main: 'Filtering the vibes...', sub: 'Weighing pacing, era, and intensity score...' },
      { main: "Okay... I think I know what you're looking for.", sub: 'Finding your movie...' }
    ];

    // Cycle text messages for realistic intelligent feel
    let tIdx = 0;
    const tInterval = setInterval(() => {
      tIdx++;
      if (tIdx < thinkingTexts.length) {
        const mainEl = document.querySelector('#wai-thinking-text');
        const subEl = document.querySelector('#wai-thinking-sub');
        if (mainEl) mainEl.textContent = thinkingTexts[tIdx].main;
        if (subEl) subEl.textContent = thinkingTexts[tIdx].sub;
      } else {
        clearInterval(tInterval);
      }
    }, 900);

    try {
      // Find candidate movie
      const bestMovie = await evaluateRecommendation(userAnswers);
      // Wait at least 2.5 seconds total for the smooth transition feel
      await new Promise(r => setTimeout(r, 2600));
      clearInterval(tInterval);
      currentMatchedMovie = bestMovie;
      renderResult(bestMovie);
    } catch (err) {
      console.error('Error finding recommendation:', err);
      clearInterval(tInterval);
      renderError(err.message || 'Could not find a movie. Please try again.');
    } finally {
      isThinking = false;
    }
  }

  // =========================================================================
  // Recommendation Engine & Local Scoring System
  // =========================================================================

  /**
   * Evaluates the user answers:
   * 1. Constructs intelligent TMDB Discover API query with safe soft/hard filters.
   * 2. Fetches pool of 20-40 candidates across popular pages.
   * 3. Calculates local score for each candidate across 9 dimensions.
   * 4. Chooses from top 3 highest scoring movies with weighted randomness.
   */
  async function evaluateRecommendation(answers) {
    const { media_type, animation, feel, energy, seriousness, runtime, era, popularity, romance, chaos, character } = answers;

    const params = {
      sort_by: 'popularity.desc',
      'vote_count.gte': '60',
      'vote_average.gte': '5.8'
    };

    // 0. Media type filter (Movie vs TV)
    if (media_type === 'movie') {
      // Default is movie, no special params needed
    } else if (media_type === 'tv') {
      // Need to search TV instead
      return await evaluateTVRecommendation(answers);
    }

    // 0.5 Animation filter
    let withGenres = [];
    let withoutGenres = [];

    if (animation === 'animated') {
      withGenres.push(GENRE_MAP.Animation);
    } else if (animation === 'live_action') {
      withoutGenres.push(GENRE_MAP.Animation);
    }

    // Runtime filter (only applies to movies)
    if (runtime === 'under_90') {
      params['with_runtime.lte'] = '95';
    } else if (runtime === '90_120') {
      params['with_runtime.gte'] = '88';
      params['with_runtime.lte'] = '125';
    } else if (runtime === 'over_120') {
      params['with_runtime.gte'] = '120';
    }

    // 1. Era filter (Hard filter when specific, else left open)
    const currentYear = new Date().getFullYear();
    if (era === 'recent') {
      params['primary_release_date.gte'] = '2020-01-01';
      params['primary_release_date.lte'] = `${currentYear}-12-31`;
    } else if (era === '2010s') {
      params['primary_release_date.gte'] = '2010-01-01';
      params['primary_release_date.lte'] = '2019-12-31';
    } else if (era === '2000s') {
      params['primary_release_date.gte'] = '2000-01-01';
      params['primary_release_date.lte'] = '2009-12-31';
    } else if (era === 'older') {
      params['primary_release_date.lte'] = '1999-12-31';
      params['primary_release_date.gte'] = '1970-01-01';
    }

    // 3. Primary Genre Hints for pool discovery
    // We add primary genre filters so TMDB returns a strictly relevant pool.
    let poolGenre = null;
    if (feel === 'scared') poolGenre = GENRE_MAP.Horror;
    else if (feel === 'laugh') poolGenre = GENRE_MAP.Comedy;
    else if (feel === 'fall_in_love' || romance === 'whole_thing') poolGenre = GENRE_MAP.Romance;
    else if (feel === 'badass') poolGenre = GENRE_MAP.Action;
    else if (feel === 'stressed') poolGenre = GENRE_MAP.Thriller;
    else if (feel === 'think') poolGenre = `${GENRE_MAP.Mystery},${GENRE_MAP.SciFi}`;
    else if (feel === 'feel_something' || seriousness === 'destroy_me') poolGenre = GENRE_MAP.Drama;
    else if (feel === 'warm') poolGenre = `${GENRE_MAP.Comedy},${GENRE_MAP.Family}`;

    if (poolGenre) {
      withGenres.push(poolGenre);
    }

    if (withGenres.length > 0) {
      params.with_genres = withGenres.join(',');
    }
    if (withoutGenres.length > 0) {
      params.without_genres = withoutGenres.join(',');
    }

    // 4. Popularity parameters
    if (popularity === 'hidden_gem') {
      params.sort_by = 'vote_average.desc';
      params['vote_count.gte'] = '120';
      params['vote_count.lte'] = '2000';
    } else if (popularity === 'everyone') {
      params.sort_by = 'popularity.desc';
      params['vote_count.gte'] = '400';
    } else if (popularity === 'popular_subtle') {
      params.sort_by = 'vote_average.desc';
      params['vote_count.gte'] = '300';
    }

    // Fetch pool (try page 1 and page 2 for greater candidate variety)
    let candidates = [];
    try {
      const pageToFetch = (popularity === 'popular_subtle' || popularity === 'surprise') ? 2 : 1;
      const res1 = await discoverMovies({ ...params, page: 1 });
      candidates = candidates.concat(res1.results || []);

      if (candidates.length < 10) {
        // Fallback: relax runtime and strict vote thresholds while KEEPING genre intact
        const relaxedParams = { ...params };
        delete relaxedParams['with_runtime.lte'];
        delete relaxedParams['with_runtime.gte'];
        relaxedParams['vote_count.gte'] = '20';
        relaxedParams['vote_average.gte'] = '5.0';
        const fallbackRes = await discoverMovies({ ...relaxedParams, page: 1 });
        candidates = candidates.concat(fallbackRes.results || []);
      }

      if (candidates.length >= 10 && (popularity === 'surprise' || popularity === 'popular_subtle')) {
        const res2 = await discoverMovies({ ...params, page: pageToFetch });
        candidates = candidates.concat(res2.results || []);
      }
    } catch (e) {
      console.warn('First discover attempt failed, retrying with broader params:', e);
      // Keep genre in fallback so we never return a completely unrelated genre
      const fallbackParams = { sort_by: 'popularity.desc', page: 1 };
      if (params.with_genres) fallbackParams.with_genres = params.with_genres;
      const fallback = await discoverMovies(fallbackParams);
      candidates = fallback.results || [];
    }

    // Filter duplicates and movies without overview or poster
    const seen = new Set();
    candidates = candidates.filter(m => {
      if (!m.id || !m.title || !m.poster_path || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    if (candidates.length === 0) {
      throw new Error('No movies matched your current combination. Try tweaking your answers!');
    }

    // 5. Local Multi-Variable Scoring System
    const scoredCandidates = candidates.map(movie => {
      const score = calculateLocalScore(movie, answers);
      return { movie, score };
    });

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Pick from top 3 candidates with weighted randomness so repeated runs are not identical
    const topSlice = scoredCandidates.slice(0, Math.min(4, scoredCandidates.length));
    const chosenIndex = Math.floor(Math.random() * topSlice.length);
    const chosen = topSlice[chosenIndex].movie;

    // Fetch detailed movie info (runtime, genres, videos for trailer)
    try {
      const fullDetails = await getMovieDetails(chosen.id);
      return fullDetails || chosen;
    } catch (e) {
      return chosen;
    }
  }

  /**
   * TV Show Recommendation Engine (similar to movie but for TV)
   */
  async function evaluateTVRecommendation(answers) {
    const { animation, feel, energy, seriousness, era, popularity, romance, chaos, character } = answers;

    const params = {
      sort_by: 'popularity.desc',
      'vote_count.gte': '50',
      'vote_average.gte': '5.5'
    };

    // Animation filter for TV
    if (animation === 'animated') {
      params.with_genres = GENRE_MAP.Animation;
    } else if (animation === 'live_action') {
      params.without_genres = GENRE_MAP.Animation;
    }

    // Era filter for TV
    const currentYear = new Date().getFullYear();
    if (era === 'recent') {
      params['first_air_date.gte'] = '2020-01-01';
      params['first_air_date.lte'] = `${currentYear}-12-31`;
    } else if (era === '2010s') {
      params['first_air_date.gte'] = '2010-01-01';
      params['first_air_date.lte'] = '2019-12-31';
    } else if (era === '2000s') {
      params['first_air_date.gte'] = '2000-01-01';
      params['first_air_date.lte'] = '2009-12-31';
    } else if (era === 'older') {
      params['first_air_date.lte'] = '1999-12-31';
      params['first_air_date.gte'] = '1970-01-01';
    }

    // Genre hints based on mood (note: TMDB TV doesn't have Horror genre 27; uses Mystery 9648 / Crime 80 / Drama 18)
    let poolGenre = null;
    if (feel === 'scared') poolGenre = `${GENRE_MAP.Mystery},${GENRE_MAP.Crime}`;
    else if (feel === 'laugh') poolGenre = GENRE_MAP.Comedy;
    else if (feel === 'fall_in_love' || romance === 'whole_thing') poolGenre = GENRE_MAP.Romance;
    else if (feel === 'badass') poolGenre = GENRE_MAP.Action;
    else if (feel === 'stressed') poolGenre = `${GENRE_MAP.Mystery},${GENRE_MAP.Crime}`;
    else if (feel === 'think') poolGenre = `${GENRE_MAP.Mystery},${GENRE_MAP.SciFi}`;
    else if (feel === 'feel_something' || seriousness === 'destroy_me') poolGenre = GENRE_MAP.Drama;
    else if (feel === 'warm') poolGenre = `${GENRE_MAP.Comedy},${GENRE_MAP.Family}`;

    if (poolGenre) {
      params.with_genres = poolGenre;
    }

    // Popularity parameters
    if (popularity === 'hidden_gem') {
      params.sort_by = 'vote_average.desc';
      params['vote_count.gte'] = '100';
      params['vote_count.lte'] = '1500';
    } else if (popularity === 'everyone') {
      params.sort_by = 'popularity.desc';
      params['vote_count.gte'] = '300';
    } else if (popularity === 'popular_subtle') {
      params.sort_by = 'vote_average.desc';
      params['vote_count.gte'] = '200';
    }

    // Fetch TV candidates
    let candidates = [];
    try {
      const res1 = await discoverTV({ ...params, page: 1 });
      candidates = candidates.concat(res1.results || []);

      if (candidates.length < 10) {
        const relaxedParams = { ...params };
        relaxedParams['vote_count.gte'] = '20';
        relaxedParams['vote_average.gte'] = '5.0';
        const fallbackRes = await discoverTV({ ...relaxedParams, page: 1 });
        candidates = candidates.concat(fallbackRes.results || []);
      }

      if (candidates.length >= 10 && (popularity === 'surprise' || popularity === 'popular_subtle')) {
        const res2 = await discoverTV({ ...params, page: 2 });
        candidates = candidates.concat(res2.results || []);
      }
    } catch (e) {
      console.warn('TV discover failed, retrying:', e);
      const fallbackParams = { sort_by: 'popularity.desc', page: 1 };
      if (params.with_genres) fallbackParams.with_genres = params.with_genres;
      const fallback = await discoverTV(fallbackParams);
      candidates = fallback.results || [];
    }

    // Filter duplicates
    const seen = new Set();
    candidates = candidates.filter(m => {
      if (!m.id || !m.name || !m.poster_path || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    if (candidates.length === 0) {
      throw new Error('No TV shows matched your current combination. Try tweaking your answers!');
    }

    // Score candidates
    const scoredCandidates = candidates.map(show => {
      const score = calculateLocalScore(show, answers);
      return { movie: show, score };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);

    const topSlice = scoredCandidates.slice(0, Math.min(4, scoredCandidates.length));
    const chosenIndex = Math.floor(Math.random() * topSlice.length);
    const chosen = topSlice[chosenIndex].movie;

    // Fetch detailed TV info
    try {
      const fullDetails = await getTVDetails(chosen.id);
      return fullDetails || chosen;
    } catch (e) {
      return chosen;
    }
  }

  /**
   * Local Scoring Algorithm:
   * Rates a candidate movie based on mood, energy, seriousness, chaos, romance, and character.
   */
  function calculateLocalScore(movie, answers) {
    let score = 50; // Base score
    const genres = movie.genre_ids || (movie.genres || []).map(g => g.id);
    const overview = (movie.overview || '').toLowerCase();
    const title = (movie.title || movie.name || '').toLowerCase();
    const voteAvg = movie.vote_average || 7.0;
    const voteCount = movie.vote_count || 100;

    // Quality bonus
    score += (voteAvg - 6.0) * 8;

    // 1. FEEL MATCHING (Dominant weight so the primary mood is always respected)
    switch (answers.feel) {
      case 'laugh':
        if (genres.includes(GENRE_MAP.Comedy)) score += 60;
        if (genres.includes(GENRE_MAP.Animation)) score += 15;
        if (genres.includes(GENRE_MAP.Horror)) score -= 40;
        break;
      case 'feel_something':
        if (genres.includes(GENRE_MAP.Drama)) score += 60;
        if (overview.includes('loss') || overview.includes('family') || overview.includes('life')) score += 15;
        break;
      case 'fall_in_love':
        if (genres.includes(GENRE_MAP.Romance)) score += 70;
        if (genres.includes(GENRE_MAP.Comedy)) score += 15;
        if (genres.includes(GENRE_MAP.War)) score -= 30;
        break;
      case 'stressed':
        if (genres.includes(GENRE_MAP.Thriller)) score += 65;
        if (genres.includes(GENRE_MAP.Crime) || genres.includes(GENRE_MAP.Mystery)) score += 20;
        break;
      case 'think':
        if (genres.includes(GENRE_MAP.Mystery)) score += 40;
        if (genres.includes(GENRE_MAP.SciFi)) score += 40;
        if (overview.includes('secret') || overview.includes('truth') || overview.includes('discover')) score += 15;
        break;
      case 'badass':
        if (genres.includes(GENRE_MAP.Action)) score += 65;
        if (genres.includes(GENRE_MAP.Adventure)) score += 20;
        if (genres.includes(GENRE_MAP.Drama) && !genres.includes(GENRE_MAP.Action)) score -= 15;
        break;
      case 'scared':
        // Strong positive weight for Horror (or Mystery/Thriller in TV)
        if (genres.includes(GENRE_MAP.Horror)) score += 80;
        if (genres.includes(GENRE_MAP.Thriller) || genres.includes(GENRE_MAP.Mystery)) score += 30;
        if (genres.includes(GENRE_MAP.Comedy)) score -= 30;
        break;
      case 'warm':
        if (genres.includes(GENRE_MAP.Family) || genres.includes(GENRE_MAP.Animation)) score += 50;
        if (genres.includes(GENRE_MAP.Comedy)) score += 20;
        if (genres.includes(GENRE_MAP.Horror) || genres.includes(GENRE_MAP.War)) score -= 50;
        break;
    }

    // 2. ENERGY MATCHING
    switch (answers.energy) {
      case 'fast':
        if (genres.includes(GENRE_MAP.Action) || genres.includes(GENRE_MAP.Adventure) || genres.includes(GENRE_MAP.Thriller)) score += 20;
        break;
      case 'slow':
        if (genres.includes(GENRE_MAP.Drama) || genres.includes(GENRE_MAP.Mystery) || genres.includes(GENRE_MAP.History)) score += 20;
        if (genres.includes(GENRE_MAP.Action)) score -= 10;
        break;
      case 'chill':
        if (genres.includes(GENRE_MAP.Comedy) || genres.includes(GENRE_MAP.Documentary) || genres.includes(GENRE_MAP.Animation)) score += 18;
        if (genres.includes(GENRE_MAP.Horror) && answers.feel !== 'scared') score -= 25;
        break;
    }

    // 3. SERIOUSNESS MATCHING
    switch (answers.seriousness) {
      case 'light':
        if (genres.includes(GENRE_MAP.Comedy) || genres.includes(GENRE_MAP.Family)) score += 25;
        if (genres.includes(GENRE_MAP.War) || genres.includes(GENRE_MAP.History)) score -= 25;
        break;
      case 'pretty_serious':
        if (genres.includes(GENRE_MAP.Drama) || genres.includes(GENRE_MAP.History) || genres.includes(GENRE_MAP.Crime)) score += 22;
        break;
      case 'destroy_me':
        if (genres.includes(GENRE_MAP.Drama)) score += 30;
        if (overview.includes('death') || overview.includes('tragedy') || overview.includes('grief') || overview.includes('devastating')) score += 25;
        break;
    }

    // 4. ROMANCE MATCHING
    switch (answers.romance) {
      case 'none':
        if (!genres.includes(GENRE_MAP.Romance)) score += 15;
        else score -= 25;
        break;
      case 'little':
        if (genres.includes(GENRE_MAP.Romance) && (genres.includes(GENRE_MAP.Action) || genres.includes(GENRE_MAP.Comedy))) score += 18;
        break;
      case 'important':
      case 'whole_thing':
        if (genres.includes(GENRE_MAP.Romance)) score += 35;
        else score -= 20;
        break;
    }

    // 5. CHAOS MATCHING
    switch (answers.chaos) {
      case 'peaceful':
        if (genres.includes(GENRE_MAP.Family) || genres.includes(GENRE_MAP.Documentary) || genres.includes(GENRE_MAP.Animation)) score += 20;
        if ((genres.includes(GENRE_MAP.Action) || genres.includes(GENRE_MAP.Horror)) && answers.feel !== 'scared') score -= 30;
        break;
      case 'messy':
        if (genres.includes(GENRE_MAP.Comedy) || genres.includes(GENRE_MAP.Crime)) score += 18;
        if (overview.includes('mistake') || overview.includes('heist') || overview.includes('crazy') || overview.includes('wild')) score += 15;
        break;
      case 'therapy':
        if (genres.includes(GENRE_MAP.Thriller) || genres.includes(GENRE_MAP.Horror) || genres.includes(GENRE_MAP.Drama)) score += 25;
        if (overview.includes('obsession') || overview.includes('psychological') || overview.includes('unravel') || overview.includes('dark')) score += 20;
        break;
    }

    // 6. CHARACTER MATCHING
    switch (answers.character) {
      case 'teen':
        if (overview.includes('high school') || overview.includes('teen') || overview.includes('student') || overview.includes('young') || genres.includes(GENRE_MAP.Animation)) score += 22;
        break;
      case 'older':
        if (overview.includes('veteran') || overview.includes('retired') || overview.includes('father') || overview.includes('mother') || overview.includes('aging')) score += 20;
        break;
      case 'ensemble':
        if (overview.includes('team') || overview.includes('group') || overview.includes('friends') || overview.includes('crew') || overview.includes('family')) score += 20;
        break;
    }

    return score;
  }

  // =========================================================================
  // Final Result Display
  // =========================================================================

  function renderResult(movie) {
    const body = document.querySelector('#wai-body');
    const stepIndicator = document.querySelector('#wai-step-indicator');
    if (!body) return;

    if (stepIndicator) stepIndicator.style.display = 'none';

    // Detect if TV show or movie
    const isTV = !!movie.name;
    const title = movie.title || movie.name || '—';
    const year = (movie.release_date || movie.first_air_date || '').slice(0, 4) || '—';
    const rating = (movie.vote_average || 0).toFixed(1);
    const runtimeText = movie.runtime ? `${movie.runtime} min` : (movie.number_of_seasons ? `${movie.number_of_seasons} Seasons` : '');
    const genresList = (movie.genres || []).map(g => g.name);
    const posterSrc = imageUrl(movie.poster_path, 'w500');
    const backdropSrc = imageUrl(movie.backdrop_path, 'original');
    const mediaType = isTV ? 'tv' : 'movie';

    // Find official YouTube trailer
    const videos = movie.videos?.results || [];
    const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official)
      || videos.find(v => v.site === 'YouTube' && v.type === 'Trailer')
      || videos.find(v => v.site === 'YouTube' && v.type === 'Teaser');

    // Construct personalized interpretation summary
    const moodInterpretation = getPersonalizedMoodBadge(userAnswers);

    body.innerHTML = `
      <div class="wai-result-view">
        <div class="wai-result-hero">
          <div class="wai-result-backdrop" style="background-image: url('${backdropSrc}')"></div>
          <div class="wai-result-content">
            <div class="wai-result-poster-wrap">
              <img class="wai-result-poster" src="${posterSrc}" alt="${title} poster">
            </div>
            <div class="wai-result-info">
              <div class="wai-result-tagline">Zanora's Perfect Match</div>
              <h2 class="wai-result-title">${title}</h2>
              <div class="wai-result-meta">
                <span class="wai-result-meta-item">${year}</span>
                <span class="wai-result-meta-item wai-result-rating">${rating}</span>
                ${runtimeText ? `<span class="wai-result-meta-item">${runtimeText}</span>` : ''}
              </div>
              <div class="wai-result-genres">
                ${genresList.map(g => `<span class="wai-result-genre-tag">${g}</span>`).join('')}
              </div>
              <div class="wai-match-reasons">
                <span>${moodInterpretation}</span>
              </div>
              <p class="wai-result-overview">${movie.overview || 'No synopsis available.'}</p>
            </div>
          </div>
        </div>

        <!-- In-Modal Trailer Container -->
        <div class="wai-trailer-box" id="wai-trailer-container"></div>

        <div class="wai-result-actions">
          ${trailer ? `
            <button class="button secondary" id="wai-btn-trailer" type="button">
              Watch trailer
            </button>
          ` : `
            <a class="button secondary" href="details.html?id=${movie.id}&type=${mediaType}#preview">
              Watch trailer
            </a>
          `}
          <a class="button primary" href="details.html?id=${movie.id}&type=${mediaType}">
            View ${isTV ? 'show' : 'movie'} →
          </a>
          <button class="button wai-btn-try-again" id="wai-btn-retry" type="button">
            Try again
          </button>
        </div>
      </div>
    `;

    // Trailer button click handler
    const trailerBtn = body.querySelector('#wai-btn-trailer');
    const trailerContainer = body.querySelector('#wai-trailer-container');
    if (trailerBtn && trailerContainer && trailer) {
      trailerBtn.onclick = () => {
        if (trailerContainer.classList.contains('show')) {
          trailerContainer.classList.remove('show');
          trailerContainer.innerHTML = '';
          trailerBtn.innerHTML = '▶ Watch trailer';
        } else {
          trailerContainer.classList.add('show');
          trailerContainer.innerHTML = `
            <iframe src="https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          `;
          trailerBtn.innerHTML = 'Hide trailer';
        }
      };
    }

    // Try again handler
    const retryBtn = body.querySelector('#wai-btn-retry');
    if (retryBtn) {
      retryBtn.onclick = () => {
        currentStep = 0;
        userAnswers = {};
        currentMatchedMovie = null;
        renderStep();
      };
    }
  }

  // Create human-sounding explanation of the match
  function getPersonalizedMoodBadge(answers) {
    const feelLabels = {
      laugh: 'craving laughs',
      feel_something: 'ready to feel moved',
      fall_in_love: 'seeking romance',
      stressed: 'hunting thrill & suspense',
      think: 'ready to engage your mind',
      badass: 'looking for high octane adrenaline',
      scared: 'ready for dark chills',
      warm: 'looking for comfort warmth'
    };
    const chaosLabels = {
      peaceful: 'peaceful vibes',
      some_drama: 'grounded drama',
      messy: 'messy entanglements',
      therapy: 'full unhinged chaos'
    };

    const feelText = feelLabels[answers.feel] || 'your mood';
    const chaosText = chaosLabels[answers.chaos] || 'your vibe';
    return `Picked for you: You're ${feelText} with ${chaosText}.`;
  }

  // Render error in case TMDB fetch fails
  function renderError(message) {
    const body = document.querySelector('#wai-body');
    if (!body) return;
    body.innerHTML = `
      <div class="wai-thinking-view">
        <h3 class="wai-thinking-phrase" style="color: #ff7878;">Oops!</h3>
        <p class="wai-thinking-sub">${message}</p>
        <div class="wai-result-actions" style="margin-top: 24px;">
          <button class="button primary" id="wai-err-retry">Try again</button>
        </div>
      </div>
    `;
    const btn = body.querySelector('#wai-err-retry');
    if (btn) {
      btn.onclick = () => {
        currentStep = 0;
        userAnswers = {};
        renderStep();
      };
    }
  }

  // Expose API on window for external callers
  window.openThinkingModal = openThinkingModal;
  window.closeThinkingModal = closeThinkingModal;

  // Auto-init on DOMContentLoaded or immediate if already ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThinkingFeature);
  } else {
    initThinkingFeature();
  }
})();

