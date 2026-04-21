/**
 * Cloud session persistence via Upstash Redis REST (no Supabase).
 * Env (Vercel → Settings → Environment Variables):
 *   UPSTASH_REDIS_REST_URL   e.g. https://xxxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN  Bearer token from Upstash console
 *
 * Vercel “Storage → Create Database → Upstash” may also inject:
 *   KV_REST_API_URL / KV_REST_API_TOKEN — those are supported as fallbacks.
 */

const redisUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '')
    .trim()
    .replace(/\/$/, '');
const redisToken = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '').trim();

const KEY_PREFIX = 'clayable:session:';
const DEFAULT_TTL_SEC = 60 * 60 * 24 * 90; // 90 days

function sendJson(res, status, payload) {
    res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

function validateSessionId(sessionId) {
    return typeof sessionId === 'string' && sessionId.length >= 8 && sessionId.length <= 120;
}

function sessionKey(sessionId) {
    return `${KEY_PREFIX}${sessionId}`;
}

function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
        }
    }
    return {};
}

async function redisGet(key) {
    const url = `${redisUrl}/get/${encodeURIComponent(key)}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${redisToken}` } });
    const text = await resp.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`redis get: non-json response (${resp.status}): ${text.slice(0, 200)}`);
    }
    if (!resp.ok) throw new Error(`redis get ${resp.status}: ${text.slice(0, 200)}`);
    return data.result;
}

async function redisSet(key, valueString, ttlSec = DEFAULT_TTL_SEC) {
    const url = `${redisUrl}/set/${encodeURIComponent(key)}?EX=${ttlSec}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken}` },
        body: valueString
    });
    const text = await resp.text();
    if (!resp.ok) throw new Error(`redis set ${resp.status}: ${text.slice(0, 300)}`);
}

export default async function handler(req, res) {
    if (!redisUrl || !redisToken) {
        return sendJson(res, 500, {
            error: 'missing redis env vars',
            hint: 'set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (see CLOUD_BACKEND.md)'
        });
    }

    if (req.method === 'GET') {
        const sessionId = req.query.sessionId;
        if (!validateSessionId(sessionId)) return sendJson(res, 400, { error: 'invalid sessionId' });
        try {
            const raw = await redisGet(sessionKey(sessionId));
            if (raw == null) return sendJson(res, 200, { state: null });
            let envelope;
            try {
                envelope = JSON.parse(raw);
            } catch {
                return sendJson(res, 200, { state: null });
            }
            if (!envelope || typeof envelope !== 'object') return sendJson(res, 200, { state: null });
            return sendJson(res, 200, {
                state: envelope.state ?? null,
                updatedAt: envelope.savedAt ?? null
            });
        } catch (error) {
            return sendJson(res, 500, { error: 'failed to load state', detail: String(error?.message || error) });
        }
    }

    if (req.method === 'PUT') {
        const body = readJsonBody(req);
        const { sessionId, state } = body || {};
        if (!validateSessionId(sessionId)) return sendJson(res, 400, { error: 'invalid sessionId' });
        if (!state || typeof state !== 'object') return sendJson(res, 400, { error: 'missing state object' });
        try {
            const savedAt = new Date().toISOString();
            const envelope = JSON.stringify({ v: 1, savedAt, state });
            await redisSet(sessionKey(sessionId), envelope);
            return sendJson(res, 200, { ok: true, updatedAt: savedAt });
        } catch (error) {
            return sendJson(res, 500, { error: 'failed to save state', detail: String(error?.message || error) });
        }
    }

    return sendJson(res, 405, { error: 'method not allowed' });
}
