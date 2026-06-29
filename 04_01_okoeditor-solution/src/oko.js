/**
 * OKO web-panel read-only client.
 *
 * The panel at https://oko.ag3nts.org requires a cookie-based login session.
 * This module handles authentication and provides typed fetch helpers for the
 * three data sections we need to inspect before editing:
 *
 *   • /          → incident list (incydenty)
 *   • /incydenty/:id  → single incident detail
 *   • /zadania        → task list
 *   • /zadania/:id    → single task detail
 *   • /notatki/:id    → single note (used to read the incident code table)
 *
 * IMPORTANT: nothing here performs write operations against the web UI.
 * All mutations go through the hub API (src/helpers/api.js).
 */

import '../../config.js';

const OKO_BASE = 'https://oko.ag3nts.org';

// ── Authentication ─────────────────────────────────────────────────────────

/** Shared cookie jar (session token only — no persistent storage needed). */
let sessionCookie = '';

/**
 * Log in to the OKO operator panel and cache the session cookie.
 *
 * The server requires a two-step handshake:
 *  1. GET /  → server sets an initial session token via Set-Cookie
 *  2. POST / with credentials + that initial token → server validates,
 *     issues a new authenticated session token, and returns HTTP 302
 *
 * Sending the POST without step 1 causes the server to return HTTP 200
 * (login page again) instead of 302, and the session is not established.
 *
 * @param {{ login: string, password: string, accessKey: string }} creds
 * @returns {Promise<void>}
 */
export async function login({ login, password, accessKey }) {
  // Step 1: obtain the pre-login session token
  const initRes    = await fetch(`${OKO_BASE}/`, { redirect: 'manual' });
  const initCookie = initRes.headers.get('set-cookie')?.match(/([^;]+)/)?.[1] ?? '';

  // Step 2: POST credentials with the initial token
  const body = new URLSearchParams({
    action:     'login',
    login,
    password,
    access_key: accessKey,
  });

  const res = await fetch(`${OKO_BASE}/`, {
    method:   'POST',
    headers:  {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie:         initCookie,
    },
    body:     body.toString(),
    redirect: 'manual',
  });

  if (res.status !== 302) {
    throw new Error(`OKO login failed — expected 302 redirect, got ${res.status}.`);
  }

  const setCookie = res.headers.get('set-cookie') ?? '';
  const match     = setCookie.match(/([^;]+)/);
  if (!match) {
    throw new Error('OKO login failed — no session cookie in redirect response.');
  }

  sessionCookie = match[1];
}

// ── Low-level HTML fetch ───────────────────────────────────────────────────

/**
 * GET an OKO page with the active session cookie.
 * Returns the raw HTML string.
 *
 * @param {string} path  e.g. "/" or "/incydenty/abc123"
 * @returns {Promise<string>}
 */
async function getPage(path) {
  if (!sessionCookie) throw new Error('Not logged in. Call login() first.');

  const res = await fetch(`${OKO_BASE}${path}`, {
    headers: { Cookie: sessionCookie },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${path}`);

  return res.text();
}

// ── HTML parsing helpers ───────────────────────────────────────────────────

/**
 * Strip all HTML tags and collapse whitespace.
 *
 * @param {string} html
 * @returns {string}
 */
function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract all list entries from an OKO list page (incidents or tasks).
 * Each entry links to a detail page via /section/:id.
 *
 * @param {string} html        Raw page HTML
 * @param {string} section     "incydenty" | "zadania"
 * @returns {{ id: string, title: string, badge: string, done: boolean }[]}
 */
function parseListPage(html, section) {
  const entries = [];
  const pattern = new RegExp(
    `href="/${section}/([a-f0-9]{32})"[\\s\\S]*?<strong>([^<]+)</strong>[\\s\\S]*?<span class="metric([^"]*)"[^>]*>([^<]+)</span>`,
    'g',
  );

  for (const m of html.matchAll(pattern)) {
    const [, id, title, cssClass, badge] = m;
    entries.push({
      id,
      title:  title.trim(),
      badge:  badge.trim(),
      done:   cssClass.includes('metric--done'),
    });
  }

  return entries;
}

/**
 * Extract the prose content from a detail page.
 *
 * @param {string} html
 * @returns {{ badge: string, content: string }}
 */
function parseDetailPage(html) {
  // Remove <style> and <nav> blocks before extracting readable text
  const cleaned = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/g, '');

  const panelMatch = cleaned.match(/<section class="panel">([\s\S]*?)<\/section>/);
  if (!panelMatch) return { badge: '', content: '' };

  const text    = stripTags(panelMatch[1]);
  // The badge is the first segment before the main prose
  const parts   = text.split(' ').filter(Boolean);
  const pipeIdx = text.indexOf(' | ');
  const badge   = pipeIdx >= 0 ? text.slice(0, text.indexOf(' ', text.indexOf(' | ', pipeIdx + 3) + 3)).trim() : '';
  const content = badge ? text.slice(badge.length).trim() : text;

  return { badge, content };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch the full incident list.
 *
 * @returns {Promise<{ id: string, title: string, badge: string, done: boolean }[]>}
 */
export async function listIncidents() {
  const html = await getPage('/');
  return parseListPage(html, 'incydenty');
}

/**
 * Fetch the full task list.
 *
 * @returns {Promise<{ id: string, title: string, badge: string, done: boolean }[]>}
 */
export async function listTasks() {
  const html = await getPage('/zadania');
  return parseListPage(html, 'zadania');
}

/**
 * Fetch a single incident detail.
 *
 * @param {string} id  32-char hex identifier
 * @returns {Promise<{ badge: string, content: string }>}
 */
export async function getIncident(id) {
  const html = await getPage(`/incydenty/${id}`);
  return parseDetailPage(html);
}

/**
 * Fetch a single task detail.
 *
 * @param {string} id  32-char hex identifier
 * @returns {Promise<{ badge: string, content: string }>}
 */
export async function getTask(id) {
  const html = await getPage(`/zadania/${id}`);
  return parseDetailPage(html);
}

/**
 * Fetch a single operator note by id.
 * Used here to read the incident-code classification table.
 *
 * @param {string} id
 * @returns {Promise<{ badge: string, content: string }>}
 */
export async function getNote(id) {
  const html = await getPage(`/notatki/${id}`);
  return parseDetailPage(html);
}
