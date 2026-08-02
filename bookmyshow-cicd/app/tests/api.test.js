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

  it('GET /api/shows should return the show catalogue', async () => {
    const res = await chai.request(app).get('/api/shows');
    expect(res).to.have.status(200);
    expect(res.body).to.have.property('1');
  });

  it('POST /api/shows/:id/book should book seats when available', async () => {
    const res = await chai.request(app).post('/api/shows/1/book').send({ seats: 2 });
    expect(res).to.have.status(200);
    expect(res.body).to.have.property('seatsRemaining');
  });

  it('POST /api/shows/:id/book should reject when sold out', async () => {
    const res = await chai.request(app).post('/api/shows/2/book').send({ seats: 1 });
    expect(res).to.have.status(409);
  });

  it('POST /api/shows/:id/book should 404 for an unknown show', async () => {
    const res = await chai.request(app).post('/api/shows/999/book').send({ seats: 1 });
    expect(res).to.have.status(404);
  });
});
