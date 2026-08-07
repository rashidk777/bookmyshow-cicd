(function () {
  const grid = document.getElementById('movie-grid');
  const ticker = document.getElementById('ticker');
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

  let currentMovie = null;
  let currentShowtime = null;
  let seatData = null;
  let selectedSeats = [];

  function money(n) {
    return n.toLocaleString('en-IN');
  }

  async function loadMovies() {
    const res = await fetch('/api/movies');
    const movies = await res.json();
    ticker.textContent = `${movies.length} films playing today — book ahead, seats move fast`;
    grid.innerHTML = '';
    movies.forEach((m) => grid.appendChild(movieCard(m)));
  }

  function movieCard(m) {
    const card = document.createElement('button');
    card.className = 'movie-card';
    card.setAttribute('aria-label', `View showtimes for ${m.title}`);
    card.innerHTML = `
      <div class="movie-poster" style="background:linear-gradient(160deg, ${m.poster.from}, ${m.poster.to})">
        <span class="movie-poster__cert">${m.certificate}</span>
        <span class="movie-poster__title">${m.title}</span>
      </div>
      <div class="movie-meta">
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
    sheetMeta.textContent = `${currentMovie.genre} · ${currentMovie.language} · ${currentMovie.duration} min · ${currentMovie.certificate}`;

    showtimeRow.innerHTML = '';
    currentMovie.showtimes.forEach((st) => {
      const chip = document.createElement('button');
      chip.className = 'showtime-chip';
      chip.textContent = `${st.time} · from \u20B9${st.basePrice}`;
      chip.addEventListener('click', () => selectShowtime(st.id, chip));
      showtimeRow.appendChild(chip);
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
          // Refresh seat map to reflect seats someone else grabbed first
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
      confirmDetails.textContent = `${data.movieTitle} · ${data.time} · Seats ${data.seats.sort().join(', ')} · \u20B9${money(data.total)}`;
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
