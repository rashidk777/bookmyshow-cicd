const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory "database" of shows and seat availability.
// A real deployment would replace this with RDS / DynamoDB etc.
const shows = {
  1: { title: 'Interstellar Returns', seatsAvailable: 42 },
  2: { title: 'The Last Circuit', seatsAvailable: 0 },
  3: { title: 'Kerala Skies', seatsAvailable: 15 }
};

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

app.get('/api/shows', (req, res) => {
  res.status(200).json(shows);
});

app.post('/api/shows/:id/book', (req, res) => {
  const show = shows[req.params.id];
  const seats = parseInt(req.body.seats, 10) || 1;

  if (!show) {
    return res.status(404).json({ error: 'Show not found' });
  }
  if (show.seatsAvailable < seats) {
    return res.status(409).json({ error: 'Not enough seats available' });
  }

  show.seatsAvailable -= seats;
  return res.status(200).json({
    message: `Booked ${seats} seat(s) for ${show.title}`,
    seatsRemaining: show.seatsAvailable
  });
});

const PORT = process.env.PORT || 3000;

// Only start listening when run directly (keeps it testable via supertest/chai-http)
if (require.main === module) {
  app.listen(PORT, () => console.log(`bookmyshow-lite listening on port ${PORT}`));
}

module.exports = app;
