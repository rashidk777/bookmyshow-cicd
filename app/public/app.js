(function () {
  const grid = document.getElementById('movie-grid');
  const ticker = document.getElementById('ticker');
  const filterBar = document.getElementById('filter-bar');
  const emptyState = document.getElementById('empty-state');
  const overlay = document.getElementById('overlay');
  const sheetClose = document.getElementById('sheet-close');
  const sheetTitle = document.getElementById('sheet-title');
  const sheetMeta = document.getElementById('sheet-meta');
  const showtimeRow = document.getElementById('showtime-row');
  const showtimeSection = document.getElementById('showtime-section');
  const seatSection = document.getElementById('seat-section');
  const seatMapEl = document.getElementById('seat-map');
  const statusLine = document.getElementById('status-line');
  const stubSeats = document.getElementById('stub-seats');
  const stubTotal = document.getElementById('stub-total');
  const confirmBtn = document.getElementById('confirm-btn');
  const confirmSection = document.getElementById('confirm-section');
  const confirmId = document.getElementById('confirm-id');
  const confirmDetails = document.getElementById('confirm-details');
  const confirmDone = document.getElementById('confirm-done');
  const qrCodeEl = document.getElementById('qr-code');

  let allMovies = [];
  let activeGenre = 'all';
  let currentMovie = null;
  let currentShowtime = null;
  let seatData = null;
  let selectedSeats = [];

  // Decorative genre icons — original line-art, not depicting any real IP.
  const GENRE_ICONS = {
    'Romance': '<path fill="currentColor" d="M50 82 C20 60 8 40 8 25 C8 12 18 4 30 4 C40 4 47 10 50 18 C53 10 60 4 70 4 C82 4 92 12 92 25 C92 40 80 60 50 82 Z"/>',
    'Sci-Fi Thriller': '<circle fill="currentColor" cx="50" cy="42" r="16"/><ellipse cx="50" cy="42" rx="44" ry="12" transform="rotate(-18 50 42)" fill="none" stroke="currentColor" stroke-width="4"/>',
    'Mystery': '<circle cx="40" cy="40" r="26" fill="none" stroke="currentColor" stroke-width="6"/><line x1="59" y1="59" x2="88" y2="88" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>',
    'Drama': '<path d="M10 20 Q10 10 22 10 Q34 10 34 22 Q34 34 22 40 Q10 46 10 58 Q10 70 22 70 Q34 70 34 58" fill="none" stroke="currentColor" stroke-width="5"/><path d="M90 20 Q90 10 78 10 Q66 10 66 22 Q66 34 78 40 Q90 46 90 58 Q90 70 78 70 Q66 70 66 58" fill="none" stroke="currentColor" stroke-width="5"/>',
    'Family Comedy': '<circle cx="50" cy="45" r="38" fill="none" stroke="currentColor" stroke-width="5"/><circle fill="currentColor" cx="36" cy="38" r="5"/><circle fill="currentColor" cx="64" cy="38" r="5"/><path d="M28 58 Q50 78 72 58" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    'Adventure': '<path d="M50 8 L92 82 L8 82 Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M50 8 L68 82" stroke="currentColor" stroke-width="4"/><circle fill="currentColor" cx="50" cy="8" r="6"/>'
  };

  function genreIcon(genre) {
    return GENRE_ICONS[genre] || GENRE_ICONS['Drama'];
  }

  function money(n) {
    return n.toLocaleString('en-IN');
  }

  function starRow(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    let out = '';
    for (let i = 0; i < 5; i++) {
      if (i < full) out += '&#9733;';
      else if (i === full && half) out += '&#189;&#9733;';
      else out += '&#9734;';
    }
    return out;
  }

  async function loadMovies() {
    const res = await fetch('/api/movies');
    allMovies = await res.json();
    ticker.textContent = `${allMovies.length} films playing today — book ahead, seats move fast`;
    buildFilterBar();
    renderGrid();
  }

  function buildFilterBar() {
    const genres = ['all', ...new Set(allMovies.map((m) => m.genre))];
    filterBar.innerHTML = '';
    genres.forEach((g) => {
      const chip = document.createElement('button');
      chip.className = 'filter-chip' + (g === activeGenre ? ' is-active' : '');
      chip.textContent = g === 'all' ? 'All' : g;
      chip.dataset.genre = g;
      chip.addEventListener('click', () => {
        activeGenre = g;
        document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        renderGrid();
      });
      filterBar.appendChild(chip);
    });
  }

  function renderGrid() {
    const movies = activeGenre === 'all' ? allMovies : allMovies.filter((m) => m.genre === activeGenre);
    grid.innerHTML = '';
    emptyState.style.display = movies.length === 0 ? '' : 'none';
    movies.forEach((m) => grid.appendChild(movieCard(m)));
  }

  function movieCard(m) {
    const card = document.createElement('button');
    card.className = 'movie-card';
    card.setAttribute('aria-label', `View showtimes for ${m.title}`);
    card.innerHTML = `
      <div class="movie-poster" style="background:linear-gradient(160deg, ${m.poster.from}, ${m.poster.to})">
        <span class="movie-poster__cert">${m.certificate}</span>
        <svg class="movie-poster__icon" viewBox="0 0 100 90" aria-hidden="true">${genreIcon(m.genre)}</svg>
        <div class="movie-poster__cta">Book Now</div>
        <span class="movie-poster__title">${m.title}</span>
      </div>
      <div class="movie-meta">
        <div class="movie-meta__top">
          <span class="movie-meta__rating" title="${m.rating} / 5">${starRow(m.rating)} <span class="movie-meta__rating-num">${m.rating}</span></span>
        </div>
        <div class="movie-meta__tags">${m.genre} · ${m.language} · ${m.duration} min</div>
        <div class="movie-meta__seats">${m.seatsLeft} seats left today</div>
      </div>
    `;
    card.addEventListener('click', () => openMovie(m.id));
    return card;
  }

  async function openMovie(id) {
    const res = await fetch(`/api/movies/${id}`);
    if (!res.ok) return;
    currentMovie = await res.json();

    sheetTitle.textContent = currentMovie.title;
    sheetMeta.innerHTML = `${currentMovie.genre} · ${currentMovie.language} · ${currentMovie.duration} min · ${currentMovie.certificate} · <span class="sheet__rating">${starRow(currentMovie.rating)} ${currentMovie.rating}</span>`;

    // Group showtimes by theater
    const byTheater = {};
    currentMovie.showtimes.forEach((st) => {
      if (!byTheater[st.theaterId]) {
        byTheater[st.theaterId] = { name: st.theaterName, area: st.theaterArea, shows: [] };
      }
      byTheater[st.theaterId].shows.push(st);
    });

    showtimeRow.innerHTML = '';
    Object.values(byTheater).forEach((theater) => {
      const group = document.createElement('div');
      group.className = 'theater-group';
      group.innerHTML = `<div class="theater-group__name">${theater.name} <span class="theater-group__area">${theater.area}</span></div>`;
      const chipRow = document.createElement('div');
      chipRow.className = 'showtime-row';
      theater.shows.forEach((st) => {
        const chip = document.createElement('button');
        chip.className = 'showtime-chip';
        chip.textContent = `${st.time} · from \u20B9${st.basePrice}`;
        chip.addEventListener('click', () => selectShowtime(st.id, chip));
        chipRow.appendChild(chip);
      });
      group.appendChild(chipRow);
      showtimeRow.appendChild(group);
    });

    showtimeSection.style.display = '';
    seatSection.style.display = 'none';
    confirmSection.style.display = 'none';
    overlay.classList.add('is-open');
  }

  async function selectShowtime(id, chipEl) {
    document.querySelectorAll('.showtime-chip').forEach((c) => c.classList.remove('is-active'));
    chipEl.classList.add('is-active');

    const res = await fetch(`/api/showtimes/${id}/seats`);
    seatData = await res.json();
    currentShowtime = id;
    selectedSeats = [];

    renderSeatMap();
    updateStub();
    seatSection.style.display = '';
    statusLine.textContent = '';
    seatSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderSeatMap() {
    seatMapEl.innerHTML = '';
    seatData.rows.forEach((row) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'seat-row';

      const label = document.createElement('span');
      label.className = 'seat-row__label';
      label.textContent = row;
      rowEl.appendChild(label);

      for (let col = 1; col <= seatData.cols; col++) {
        const seatId = `${row}${col}`;
        const isPremium = seatData.premiumRows.includes(row);
        const isTaken = seatData.booked.includes(seatId);

        const btn = document.createElement('button');
        btn.className = 'seat' + (isPremium ? ' is-premium' : '') + (isTaken ? ' is-taken' : '');
        btn.setAttribute('aria-label', `Seat ${seatId}${isTaken ? ', taken' : isPremium ? ', premium' : ', available'}`);
        btn.disabled = isTaken;
        btn.dataset.seat = seatId;
        btn.addEventListener('click', () => toggleSeat(seatId, btn));
        rowEl.appendChild(btn);
      }
      seatMapEl.appendChild(rowEl);
    });
  }

  function toggleSeat(seatId, btn) {
    const idx = selectedSeats.indexOf(seatId);
    if (idx >= 0) {
      selectedSeats.splice(idx, 1);
      btn.classList.remove('is-selected');
    } else {
      selectedSeats.push(seatId);
      btn.classList.add('is-selected');
    }
    updateStub();
  }

  function seatPrice(seatId) {
    const row = seatId[0];
    return seatData.premiumRows.includes(row) ? seatData.premiumPrice : seatData.basePrice;
  }

  function updateStub() {
    if (selectedSeats.length === 0) {
      stubSeats.textContent = 'No seats selected';
      stubTotal.textContent = '0';
      confirmBtn.disabled = true;
      return;
    }
    const sorted = [...selectedSeats].sort();
    stubSeats.textContent = sorted.join(', ');
    const total = selectedSeats.reduce((sum, s) => sum + seatPrice(s), 0);
    stubTotal.textContent = money(total);
    confirmBtn.disabled = false;
  }

  function renderQr(data) {
    qrCodeEl.innerHTML = '';
    const payload = [
      `Booking: ${data.bookingId}`,
      `Film: ${data.movieTitle}`,
      `Theater: ${data.theaterName} (${data.theaterArea})`,
      `Time: ${data.time}`,
      `Seats: ${data.seats.sort().join(', ')}`,
      `Total: Rs.${data.total}`
    ].join('\n');

    if (window.qrcode) {
      const qr = window.qrcode(0, 'M'); // typeNumber 0 = auto-size, error correction M
      qr.addData(payload);
      qr.make();
      qrCodeEl.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });
    } else {
      qrCodeEl.textContent = data.bookingId;
    }
  }

  async function confirmBooking() {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Booking…';
    statusLine.textContent = '';

    try {
      const res = await fetch(`/api/showtimes/${currentShowtime}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seats: selectedSeats })
      });
      const data = await res.json();

      if (!res.ok) {
        statusLine.textContent = data.error || 'Could not complete booking. Please try again.';
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm booking';
        if (data.seats) {
          const freshRes = await fetch(`/api/showtimes/${currentShowtime}/seats`);
          seatData = await freshRes.json();
          selectedSeats = selectedSeats.filter((s) => !data.seats.includes(s));
          renderSeatMap();
          selectedSeats.forEach((s) => {
            const el = seatMapEl.querySelector(`[data-seat="${s}"]`);
            if (el) el.classList.add('is-selected');
          });
          updateStub();
        }
        return;
      }

      confirmId.textContent = `Booking ${data.bookingId}`;
      confirmDetails.textContent = `${data.movieTitle} · ${data.theaterName}, ${data.theaterArea} · ${data.time} · Seats ${data.seats.sort().join(', ')} · \u20B9${money(data.total)}`;
      renderQr(data);
      showtimeSection.style.display = 'none';
      seatSection.style.display = 'none';
      confirmSection.style.display = '';
    } catch (err) {
      statusLine.textContent = 'Network error. Please try again.';
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm booking';
    }
  }

  function closeSheet() {
    overlay.classList.remove('is-open');
    confirmBtn.textContent = 'Confirm booking';
  }

  sheetClose.addEventListener('click', closeSheet);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSheet();
  });
  confirmBtn.addEventListener('click', confirmBooking);
  confirmDone.addEventListener('click', () => {
    closeSheet();
    loadMovies();
  });

  loadMovies();
})();
