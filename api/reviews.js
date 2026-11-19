const { randomUUID } = require('node:crypto');
const APPROVED = 'aurelia:vows:reviews:approved';
const PENDING = 'aurelia:vows:reviews:pending';
function redisConfig() { return { url: (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, ''), token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.KV_REST_API_READ_WRITE_TOKEN || '' }; }
async function command(name, ...args) { const { url, token } = redisConfig(); if (!url || !token) throw new Error('Review database is not configured.'); const response = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify([name, ...args]) }); const result = await response.json(); if (!response.ok || result.error) throw new Error('Review database request failed.'); return result.result; }
function send(res, status, data) { res.status(status).setHeader('Cache-Control', 'no-store').json(data); }
function admin(req) { const key = process.env.REVIEW_ADMIN_KEY; return Boolean(key && req.headers.authorization === 'Bearer ' + key); }
async function list(key) { const rows = await command('LRANGE', key, 0, 99); return (rows || []).map(value => { try { return JSON.parse(value); } catch { return null; } }).filter(Boolean); }
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const pending = new URL(req.url, 'https://site.invalid').searchParams.get('status') === 'pending';
    if (pending && !admin(req)) return send(res, 401, { error: 'Admin authorization required.' });
    try { const reviews = await list(pending ? PENDING : APPROVED); return send(res, 200, { reviews: pending ? reviews : reviews.map(({ id, name, location, rating, text, createdAt }) => ({ id, name, location, rating, text, createdAt })) }); }
    catch { return send(res, 503, { error: 'Review service is not configured.' }); }
  }
  if (req.method === 'POST' && req.url === '/api/reviews') {
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const name = String(body.name || '').trim(), location = String(body.location || '').trim(), text = String(body.text || '').trim(), rating = Number(body.rating);
    if (name.length < 2 || name.length > 80 || location.length > 80 || text.length < 10 || text.length > 1200 || !Number.isInteger(rating) || rating < 1 || rating > 5 || body.permission !== true) return send(res, 400, { error: 'Please provide your name, a 1–5 star rating, review text, and permission to publish.' });
    const review = { id: randomUUID(), name, location, rating, text, permission: true, status: 'pending', createdAt: new Date().toISOString() };
    try { await command('RPUSH', PENDING, JSON.stringify(review)); return send(res, 202, { message: 'Review received and pending approval.' }); }
    catch { return send(res, 503, { error: 'Review service is not configured.' }); }
  }
  const match = req.url.match(/^\/api\/reviews\/([a-f0-9-]+)\/(approve|reject)$/i);
  if (req.method === 'POST' && match) {
    if (!admin(req)) return send(res, 401, { error: 'Admin authorization required.' });
    try {
      const action = match[2], source = await list(PENDING), review = source.find(item => item.id === match[1]);
      if (!review) return send(res, 404, { error: 'Pending review not found.' });
      await command('LREM', PENDING, 1, JSON.stringify(review));
      if (action === 'approve') { review.status = 'approved'; review.approvedAt = new Date().toISOString(); await command('RPUSH', APPROVED, JSON.stringify(review)); }
      return send(res, 200, { message: action === 'approve' ? 'Review approved.' : 'Review rejected.' });
    } catch { return send(res, 503, { error: 'Review service is not configured.' }); }
  }
  res.setHeader('Allow', 'GET, POST'); return send(res, 405, { error: 'Method not allowed.' });
};