const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// In-memory data. A real deployment would replace this with a proper DB
// (RDS/DynamoDB/etc). Kept in-memory here so the app stays a self-contained
// artifact the CI/CD pipeline can build, test, and deploy without extra infra.
// ---------------------------------------------------------------------------

const ROWS = 8;      // A - H
const COLS = 10;     // 1 - 10
const PREMIUM_ROWS = ['A', 'B'];
const ROW_LETTERS = Array.from({ length: ROWS }, (_, i) => String.fromCharCode(65 + i));

function freshSeatMap() {
  return []; // list of booked seat ids, e.g. ["A1", "C7"]
}

const movies = [
  {
    id: '1',
    title: 'Monsoon Diaries',
    genre: 'Romance',
    language: 'Hindi',
    duration: 142,
    certificate: 'U/A',
    poster: { from: '#f2a93b', to: '#6b2b4c' },
    showtimes: [
      { id: '1-1', time: '10:30 AM', basePrice: 180 },
      { id: '1-2', time: '2:00 PM', basePrice: 220 },
      { id: '1-3', time: '9:15 PM', basePrice: 260 }
    ]
  },
  {
    id: '2',
    title: 'The Last Circuit',
    genre: 'Sci-Fi Thriller',
    language: 'English',
    duration: 128,
    certificate: 'U/A',
    poster: { from: '#3ea88a', to: '#12101c' },
    showtimes: [
      { id: '2-1', time: '11:00 AM', basePrice: 190 },
      { id: '2-2', time: '6:45 PM', basePrice: 240 }
    ]
  },
  {
    id: '3',
    title: 'Shatranj Nights',
    genre: 'Mystery',
    language: 'Hindi',
    duration: 151,
    certificate: 'A',
    poster: { from: '#6b2b4c', to: '#1c1730' },
    showtimes: [
      { id: '3-1', time: '1:15 PM', basePrice: 200 },
      { id: '3-2', time: '10:00 PM', basePrice: 250 }
    ]
  },
  {
    id: '4',
    title: 'Rangmanch',
    genre: 'Drama',
    language: 'Hindi',
    duration: 137,
    certificate: 'U',
    poster: { from: '#f2a93b', to: '#3ea88a' },
    showtimes: [
      { id: '4-1', time: '9:45 AM', basePrice: 170 },
      { id: '4-2', time: '4:30 PM', basePrice: 210 },
      { id: '4-3', time: '8:00 PM', basePrice: 240 }
    ]
  },
  {
    id: '5',
    title: 'Basera',
    genre: 'Family Comedy',
    language: 'Hindi',
    duration: 119,
    certificate: 'U',
    poster: { from: '#3ea88a', to: '#f2a93b' },
    showtimes: [
      { id: '5-1', time: '12:00 PM', basePrice: 160 },
      { id: '5-2', time: '5:15 PM', basePrice: 200 }
    ]
  },
  {
    id: '6',
    title: 'Kerala Skies',
    genre: 'Adventure',
    language: 'Malayalam',
    duration: 133,
    certificate: 'U/A',
    poster: { from: '#12101c', to: '#3ea88a' },
    showtimes: [
      { id: '6-1', time: '11:30 AM', basePrice: 180 },
      { id: '6-2', time: '7:30 PM', basePrice: 230 }
    ]
  }
];

// Flat lookup: showtimeId -> { movieId, time, basePrice, booked: [] }
const showtimeIndex = {};
movies.forEach((movie) => {
  movie.showtimes.forEach((st) => {
    showtimeIndex[st.id] = {
      movieId: movie.id,
      movieTitle: movie.title,
      time: st.time,
      basePrice: st.basePrice,
      booked: freshSeatMap()
    };
  });
});

// Seed a few already-booked seats so the seat map has some visual variety
showtimeIndex['1-2'].booked.push('A3', 'A4', 'C5', 'C6', 'D1');
showtimeIndex['2-2'].booked.push('B2', 'B3', 'B4', 'F8');
showtimeIndex['3-2'].booked.push('A1', 'A2', 'A3', 'A4', 'A5', 'A6');

function seatPrice(basePrice, row) {
  return PREMIUM_ROWS.includes(row) ? Math.round(basePrice * 1.4) : basePrice;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

app.get('/api/movies', (req, res) => {
  const list = movies.map((m) => {
    const seatsLeft = m.showtimes.reduce((sum, st) => {
      const total = ROWS * COLS;
      return sum + (total - showtimeIndex[st.id].booked.length);
    }, 0);
    return {
      id: m.id,
      title: m.title,
      genre: m.genre,
      language: m.language,
      duration: m.duration,
      certificate: m.certificate,
      poster: m.poster,
      seatsLeft
    };
  });
  res.status(200).json(list);
});

app.get('/api/movies/:id', (req, res) => {
  const movie = movies.find((m) => m.id === req.params.id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  const showtimes = movie.showtimes.map((st) => {
    const entry = showtimeIndex[st.id];
    const totalSeats = ROWS * COLS;
    return {
      id: st.id,
      time: st.time,
      basePrice: st.basePrice,
      seatsLeft: totalSeats - entry.booked.length
    };
  });

  res.status(200).json({
    id: movie.id,
    title: movie.title,
    genre: movie.genre,
    language: movie.language,
    duration: movie.duration,
    certificate: movie.certificate,
    poster: movie.poster,
    showtimes
  });
});

app.get('/api/showtimes/:id/seats', (req, res) => {
  const entry = showtimeIndex[req.params.id];
  if (!entry) return res.status(404).json({ error: 'Showtime not found' });

  res.status(200).json({
    showtimeId: req.params.id,
    movieTitle: entry.movieTitle,
    time: entry.time,
    rows: ROW_LETTERS,
    cols: COLS,
    premiumRows: PREMIUM_ROWS,
    basePrice: entry.basePrice,
    premiumPrice: seatPrice(entry.basePrice, 'A'),
    booked: entry.booked
  });
});

app.post('/api/showtimes/:id/book', (req, res) => {
  const entry = showtimeIndex[req.params.id];
  if (!entry) return res.status(404).json({ error: 'Showtime not found' });

  const seats = Array.isArray(req.body.seats) ? req.body.seats : [];
  if (seats.length === 0) {
    return res.status(400).json({ error: 'Select at least one seat' });
  }

  const alreadyTaken = seats.filter((s) => entry.booked.includes(s));
  if (alreadyTaken.length > 0) {
    return res.status(409).json({ error: 'Some seats are already booked', seats: alreadyTaken });
  }

  const invalid = seats.filter((s) => {
    const row = s[0];
    const col = parseInt(s.slice(1), 10);
    return !ROW_LETTERS.includes(row) || !(col >= 1 && col <= COLS);
  });
  if (invalid.length > 0) {
    return res.status(400).json({ error: 'Invalid seat id', seats: invalid });
  }

  entry.booked.push(...seats);
  const total = seats.reduce((sum, s) => sum + seatPrice(entry.basePrice, s[0]), 0);

  res.status(200).json({
    bookingId: `BK${Date.now().toString(36).toUpperCase()}`,
    movieTitle: entry.movieTitle,
    time: entry.time,
    seats,
    total
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`bookmyshow-lite listening on port ${PORT}`));
}

module.exports = app;
