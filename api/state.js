const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = 'clayable_sessions';

function sendJson(res, status, payload) {
    res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(payload));
}

function validateSessionId(sessionId) {
    return typeof sessionId === 'string' && sessionId.length >= 8 && sessionId.length <= 120;
}

async function supabaseRequest(path, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const headers = {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(options.headers || {})
    };
    const resp = await fetch(url, { ...options, headers });
    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`supabase ${resp.status}: ${txt}`);
    }
    const text = await resp.text();
    return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return sendJson(res, 500, { error: 'missing supabase env vars' });
    }

    if (req.method === 'GET') {
        const sessionId = req.query.sessionId;
        if (!validateSessionId(sessionId)) return sendJson(res, 400, { error: 'invalid sessionId' });
        try {
            const rows = await supabaseRequest(
                `${TABLE}?select=state,updated_at&session_id=eq.${encodeURIComponent(sessionId)}&limit=1`
            );
            if (!rows || rows.length === 0) return sendJson(res, 200, { state: null });
            return sendJson(res, 200, { state: rows[0].state || null, updatedAt: rows[0].updated_at || null });
        } catch (error) {
            return sendJson(res, 500, { error: 'failed to load state', detail: String(error?.message || error) });
        }
    }

    if (req.method === 'PUT') {
        const { sessionId, state } = req.body || {};
        if (!validateSessionId(sessionId)) return sendJson(res, 400, { error: 'invalid sessionId' });
        if (!state || typeof state !== 'object') return sendJson(res, 400, { error: 'missing state object' });
        try {
            const payload = [
                {
                    session_id: sessionId,
                    state,
                    updated_at: new Date().toISOString()
                }
            ];
            const rows = await supabaseRequest(`${TABLE}?on_conflict=session_id`, {
                method: 'POST',
                headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
                body: JSON.stringify(payload)
            });
            return sendJson(res, 200, { ok: true, updatedAt: rows?.[0]?.updated_at || null });
        } catch (error) {
            return sendJson(res, 500, { error: 'failed to save state', detail: String(error?.message || error) });
        }
    }

    return sendJson(res, 405, { error: 'method not allowed' });
}

