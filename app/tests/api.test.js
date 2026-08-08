const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../server');

chai.use(chaiHttp);
const expect = chai.expect;

describe('BookMyShow-Lite API', () => {
  it('GET /health should return status UP', async () => {
    const res = await chai.request(app).get('/health');
    expect(res).to.have.status(200);
    expect(res.body.status).to.equal('UP');
  });

  it('GET /api/movies should return the film lineup', async () => {
    const res = await chai.request(app).get('/api/movies');
    expect(res).to.have.status(200);
    expect(res.body).to.be.an('array').that.is.not.empty;
    expect(res.body[0]).to.have.property('title');
    expect(res.body[0]).to.have.property('seatsLeft');
  });

  it('GET /api/movies/:id should return movie details with showtimes', async () => {
    const res = await chai.request(app).get('/api/movies/1');
    expect(res).to.have.status(200);
    expect(res.body).to.have.property('showtimes').that.is.an('array').that.is.not.empty;
  });

  it('GET /api/movies/:id should 404 for an unknown movie', async () => {
    const res = await chai.request(app).get('/api/movies/999');
    expect(res).to.have.status(404);
  });

  it('GET /api/showtimes/:id/seats should return a seat map', async () => {
    const res = await chai.request(app).get('/api/showtimes/1-1/seats');
    expect(res).to.have.status(200);
    expect(res.body).to.have.property('rows').that.is.an('array');
    expect(res.body).to.have.property('booked').that.is.an('array');
  });

  it('GET /api/theaters should return the theater list', async () => {
    const res = await chai.request(app).get('/api/theaters');
    expect(res).to.have.status(200);
    expect(res.body).to.be.an('array').that.is.not.empty;
    expect(res.body[0]).to.have.property('name');
  });

  it('GET /api/movies/:id showtimes should include theater info', async () => {
    const res = await chai.request(app).get('/api/movies/1');
    expect(res).to.have.status(200);
    expect(res.body.showtimes[0]).to.have.property('theaterName');
  });
});

describe('Auth', () => {
  const username = `tester_${Date.now()}`;
  const password = 'testpass123';
  let token;

  it('POST /api/auth/signup should create a new account', async () => {
    const res = await chai.request(app)
      .post('/api/auth/signup')
      .send({ username, password, name: 'Test User' });
    expect(res).to.have.status(201);
    expect(res.body).to.have.property('token');
    token = res.body.token;
  });

  it('POST /api/auth/signup should reject a duplicate username', async () => {
    const res = await chai.request(app)
      .post('/api/auth/signup')
      .send({ username, password, name: 'Test User' });
    expect(res).to.have.status(409);
  });

  it('POST /api/auth/login should reject a wrong password', async () => {
    const res = await chai.request(app)
      .post('/api/auth/login')
      .send({ username, password: 'wrongpassword' });
    expect(res).to.have.status(401);
  });

  it('POST /api/auth/login should succeed with correct credentials', async () => {
    const res = await chai.request(app)
      .post('/api/auth/login')
      .send({ username, password });
    expect(res).to.have.status(200);
    expect(res.body).to.have.property('token');
  });

  it('GET /api/auth/me should require a valid token', async () => {
    const res = await chai.request(app).get('/api/auth/me');
    expect(res).to.have.status(401);
  });

  it('GET /api/auth/me should return the profile for a valid token', async () => {
    const res = await chai.request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res).to.have.status(200);
    expect(res.body.username).to.equal(username);
  });

  it('POST /api/showtimes/:id/book should require authentication', async () => {
    const res = await chai.request(app)
      .post('/api/showtimes/1-1/book')
      .send({ seats: ['G1'] });
    expect(res).to.have.status(401);
  });

  it('POST /api/showtimes/:id/book should book seats when authenticated', async () => {
    const res = await chai.request(app)
      .post('/api/showtimes/1-1/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ seats: ['E5', 'E6'] });
    expect(res).to.have.status(200);
    expect(res.body).to.have.property('bookingId');
    expect(res.body.seats).to.deep.equal(['E5', 'E6']);
  });

  it('POST /api/showtimes/:id/book should reject already-booked seats', async () => {
    const res = await chai.request(app)
      .post('/api/showtimes/1-2/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ seats: ['A3'] }); // pre-seeded as booked in server.js
    expect(res).to.have.status(409);
  });

  it('POST /api/showtimes/:id/book should reject an empty seat selection', async () => {
    const res = await chai.request(app)
      .post('/api/showtimes/1-1/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ seats: [] });
    expect(res).to.have.status(400);
  });

  it('POST /api/showtimes/:id/book should 404 for an unknown showtime', async () => {
    const res = await chai.request(app)
      .post('/api/showtimes/999-9/book')
      .set('Authorization', `Bearer ${token}`)
      .send({ seats: ['A1'] });
    expect(res).to.have.status(404);
  });

  it('GET /api/bookings should require authentication', async () => {
    const res = await chai.request(app).get('/api/bookings');
    expect(res).to.have.status(401);
  });

  it('GET /api/bookings should return the logged-in user\'s bookings', async () => {
    const res = await chai.request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${token}`);
    expect(res).to.have.status(200);
    expect(res.body).to.be.an('array').with.length.greaterThan(0);
    expect(res.body[0]).to.have.property('bookingId');
  });
});
