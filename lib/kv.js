/* Tiny key-value helper over the Upstash Redis REST API.
   Works with either Vercel KV (KV_REST_API_*) or raw Upstash (UPSTASH_REDIS_REST_*)
   env vars — both speak the same protocol. No SDK dependency. */

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function kvConfigured() {
  return !!(URL && TOKEN);
}

async function cmd(args) {
  if (!kvConfigured()) throw new Error('KV not configured (set KV_REST_API_URL / KV_REST_API_TOKEN)');
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`KV error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.result;
}

export async function kvGet(key) {
  const raw = await cmd(['GET', key]);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function kvSet(key, value) {
  return cmd(['SET', key, JSON.stringify(value)]);
}
