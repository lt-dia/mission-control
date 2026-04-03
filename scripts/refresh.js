#!/usr/bin/env node
/**
 * Mission Control — Data Refresh Script
 * Runs in GitHub Actions every 30 minutes.
 * Fetches Linear tickets + Granola notes, writes to data/*.json
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

const LINEAR_API_KEY  = process.env.LINEAR_API_KEY;
const GRANOLA_API_KEY = process.env.GRANOLA_API_KEY;

const DATA_DIR = path.join(__dirname, '..', 'data');

/* ── HELPERS ──────────────────────────────────────────────── */
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function writeJSON(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`[refresh] Wrote ${filepath}`);
}

/* ── LINEAR ──────────────────────────────────────────────── */
async function fetchLinear() {
  if (!LINEAR_API_KEY) {
    console.warn('[refresh] LINEAR_API_KEY not set — skipping');
    return null;
  }

  const query = `{
    issues(
      filter: { assignee: { isMe: { eq: true } } }
      orderBy: updatedAt
    ) {
      nodes {
        id
        title
        state { name }
        priority
        updatedAt
      }
    }
  }`;

  const body = JSON.stringify({ query });

  const options = {
    hostname: 'api.linear.app',
    path: '/graphql',
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Authorization':  LINEAR_API_KEY,
    },
  };

  try {
    const { status, body: data } = await httpsRequest(options, body);
    if (status !== 200) {
      console.error(`[refresh] Linear API returned ${status}:`, data);
      return null;
    }
    console.log(`[refresh] Linear: fetched ${data?.data?.issues?.nodes?.length ?? 0} issues`);
    return data;
  } catch (err) {
    console.error('[refresh] Linear fetch error:', err.message);
    return null;
  }
}

/* ── GRANOLA ──────────────────────────────────────────────── */
async function fetchGranola() {
  if (!GRANOLA_API_KEY) {
    console.warn('[refresh] GRANOLA_API_KEY not set — skipping');
    return null;
  }

  const options = {
    hostname: 'public-api.granola.ai',
    path: '/v1/notes?page_size=5',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${GRANOLA_API_KEY}`,
      'Content-Type':  'application/json',
    },
  };

  try {
    const { status, body: data } = await httpsRequest(options, null);
    if (status !== 200) {
      console.error(`[refresh] Granola API returned ${status}:`, data);
      return null;
    }
    const count = data?.notes?.length ?? data?.data?.length ?? 0;
    console.log(`[refresh] Granola: fetched ${count} notes`);
    return data;
  } catch (err) {
    console.error('[refresh] Granola fetch error:', err.message);
    return null;
  }
}

/* ── STATUS ──────────────────────────────────────────────── */
function buildStatus(linearOk, granolaOk) {
  return {
    lastUpdated: new Date().toISOString(),
    integrations: {
      linear:  linearOk  ? 'ok' : 'err',
      granola: granolaOk ? 'ok' : 'err',
      github:  'warn',   // No org access yet
      discord: 'ok',
    },
  };
}

/* ── MAIN ─────────────────────────────────────────────────── */
async function main() {
  console.log('[refresh] Starting data refresh at', new Date().toISOString());

  const [linearData, granolaData] = await Promise.all([
    fetchLinear(),
    fetchGranola(),
  ]);

  // Write files (use previous placeholder if fetch failed)
  const prevLinear  = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'linear.json'),  'utf8'));
  const prevGranola = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'granola.json'), 'utf8'));

  writeJSON('linear.json',  linearData  ?? prevLinear);
  writeJSON('granola.json', granolaData ?? prevGranola);
  writeJSON('status.json',  buildStatus(!!linearData, !!granolaData));

  console.log('[refresh] Done.');
}

main().catch(err => {
  console.error('[refresh] Fatal error:', err);
  process.exit(1);
});
