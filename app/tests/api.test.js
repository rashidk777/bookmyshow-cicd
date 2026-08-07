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

  it('POST /api/showtimes/:id/book should book available seats', async () => {
    const res = await chai.request(app)
      .post('/api/showtimes/1-1/book')
      .send({ seats: ['E5', 'E6'] });
    expect(res).to.have.status(200);
    expect(res.body).to.have.property('bookingId');
    expect(res.body.seats).to.deep.equal(['E5', 'E6']);
  });

  it('POST /api/showtimes/:id/book should reject already-booked seats', async () => {
    const res = await chai.request(app)
      .post('/api/showtimes/1-2/book')
      .send({ seats: ['A3'] }); // pre-seeded as booked in server.js
    expect(res).to.have.status(409);
  });

  it('POST /api/showtimes/:id/book should reject an empty seat selection', async () => {
    const res = await chai.request(app)
      .post('/api/showtimes/1-1/book')
      .send({ seats: [] });
    expect(res).to.have.status(400);
  });

  it('POST /api/showtimes/:id/book should 404 for an unknown showtime', async () => {
    const res = await chai.request(app)
      .post('/api/showtimes/999-9/book')
      .send({ seats: ['A1'] });
    expect(res).to.have.status(404);
  });
});
