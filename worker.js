/**
 * Valentine API - Cloudflare Worker
 * 
 * Replaces Firebase Realtime Database with Cloudflare D1 (SQLite).
 * Handles all valentine link tracking and e-card CRUD operations.
 * 
 * Endpoints:
 *   POST /api/valentine          - Create valentine entry
 *   POST /api/valentine/:id/view - Record a view
 *   POST /api/valentine/:id/yes  - Record Yes click
 *   GET  /api/valentine/:id      - Get valentine data (dashboard)
 *   POST /api/ecard              - Create e-card
 *   GET  /api/ecard/:id          - Load e-card
 *   POST /api/ecard/:id/view     - Mark e-card as viewed
 *   POST /api/ecard/:id/respond  - Record e-card Yes response
 * 
 * D1 Binding: DB (valentine-db)
 */

// ============================================================================
// ALLOWED ORIGINS - Only your site can call this API
// ============================================================================
const ALLOWED_ORIGINS = [
  'https://willyoubemyvalentine.fun',
  'https://www.willyoubemyvalentine.fun',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getAllowedOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  // For non-browser requests (like curl, testing), allow if no Origin header
  if (!origin) {
    return 'https://willyoubemyvalentine.fun';
  }
  return null;
}

function corsHeaders(request) {
  const origin = getAllowedOrigin(request);
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

function errorResponse(message, request, status = 400) {
  return jsonResponse({ error: message }, request, status);
}

// Simple input sanitization - prevent XSS in stored data
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, '').trim().substring(0, 100);
}

// ============================================================================
// WORKER ENTRY POINT
// ============================================================================

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const origin = getAllowedOrigin(request);
      if (!origin) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Block requests from unauthorized origins
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // ============================================================
      // VALENTINE ENDPOINTS
      // ============================================================

      // POST /api/valentine - Create a new valentine entry
      if (method === 'POST' && path === '/api/valentine') {
        const body = await request.json();
        const trackingId = sanitize(body.trackingId);
        const senderName = sanitize(body.senderName);

        if (!trackingId || !senderName) {
          return errorResponse('trackingId and senderName are required', request);
        }

        // Prevent duplicate entries (ignore if already exists)
        await env.DB.prepare(
          'INSERT OR IGNORE INTO valentines (tracking_id, sender_name, created_at, views, yes_clicked, yes_clicked_at) VALUES (?, ?, ?, 0, 0, NULL)'
        ).bind(trackingId, senderName, Date.now()).run();

        return jsonResponse({ success: true, trackingId }, request);
      }

      // POST /api/valentine/:id/view - Record a view
      if (method === 'POST' && path.match(/^\/api\/valentine\/[^/]+\/view$/)) {
        const id = sanitize(path.split('/')[3]);

        await env.DB.prepare(
          'UPDATE valentines SET views = views + 1 WHERE tracking_id = ?'
        ).bind(id).run();

        return jsonResponse({ success: true }, request);
      }

      // POST /api/valentine/:id/yes - Record Yes click
      if (method === 'POST' && path.match(/^\/api\/valentine\/[^/]+\/yes$/)) {
        const id = sanitize(path.split('/')[3]);

        await env.DB.prepare(
          'UPDATE valentines SET yes_clicked = 1, yes_clicked_at = ? WHERE tracking_id = ?'
        ).bind(Date.now(), id).run();

        return jsonResponse({ success: true }, request);
      }

      // GET /api/valentine/:id - Get valentine data (dashboard)
      if (method === 'GET' && path.match(/^\/api\/valentine\/[^/]+$/)) {
        const id = sanitize(path.split('/')[3]);

        const result = await env.DB.prepare(
          'SELECT * FROM valentines WHERE tracking_id = ?'
        ).bind(id).first();

        if (!result) {
          return errorResponse('Valentine not found', request, 404);
        }

        return jsonResponse({
          senderName: result.sender_name,
          createdAt: result.created_at,
          views: result.views,
          yesClicked: result.yes_clicked === 1,
          yesClickedAt: result.yes_clicked_at,
        }, request);
      }

      // ============================================================
      // E-CARD ENDPOINTS
      // ============================================================

      // POST /api/ecard - Create e-card
      if (method === 'POST' && path === '/api/ecard') {
        const body = await request.json();
        const ecardId = sanitize(body.ecardId);
        const from = sanitize(body.from);
        const to = sanitize(body.to);
        const theme = sanitize(body.theme) || 'classic';
        const message = (body.message || '').replace(/[<>"']/g, '').trim().substring(0, 500);

        if (!ecardId || !from || !to) {
          return errorResponse('ecardId, from, and to are required', request);
        }

        // Prevent duplicate entries
        await env.DB.prepare(
          'INSERT OR IGNORE INTO ecards (ecard_id, from_name, to_name, theme, message, created_at, viewed, responded, responded_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, NULL)'
        ).bind(ecardId, from, to, theme, message, Date.now()).run();

        return jsonResponse({ success: true, ecardId }, request);
      }

      // GET /api/ecard/:id - Load e-card
      if (method === 'GET' && path.match(/^\/api\/ecard\/[^/]+$/)) {
        const id = sanitize(path.split('/')[3]);

        const result = await env.DB.prepare(
          'SELECT * FROM ecards WHERE ecard_id = ?'
        ).bind(id).first();

        if (!result) {
          return errorResponse('E-card not found', request, 404);
        }

        return jsonResponse({
          from: result.from_name,
          to: result.to_name,
          theme: result.theme,
          message: result.message,
          createdAt: result.created_at,
          viewed: result.viewed === 1,
          responded: result.responded === 1,
          respondedAt: result.responded_at,
        }, request);
      }

      // POST /api/ecard/:id/view - Mark e-card as viewed
      if (method === 'POST' && path.match(/^\/api\/ecard\/[^/]+\/view$/)) {
        const id = sanitize(path.split('/')[3]);

        await env.DB.prepare(
          'UPDATE ecards SET viewed = 1 WHERE ecard_id = ?'
        ).bind(id).run();

        return jsonResponse({ success: true }, request);
      }

      // POST /api/ecard/:id/respond - Record e-card response
      if (method === 'POST' && path.match(/^\/api\/ecard\/[^/]+\/respond$/)) {
        const id = sanitize(path.split('/')[3]);

        await env.DB.prepare(
          'UPDATE ecards SET responded = 1, responded_at = ? WHERE ecard_id = ?'
        ).bind(Date.now(), id).run();

        return jsonResponse({ success: true }, request);
      }

      // ============================================================
      // FALLBACK
      // ============================================================
      return errorResponse('Not found', request, 404);

    } catch (err) {
      console.error('Worker error:', err);
      return errorResponse('Internal server error', request, 500);
    }
  },
};
