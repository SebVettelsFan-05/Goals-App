/* Cron endpoint: send any reminders that are due right now.
   Triggered by Vercel Cron (sends Authorization: Bearer $CRON_SECRET) or by an
   external 1-minute cron hitting /api/tick?key=$CRON_SECRET.
   Uses a 15-minute grace window so it's robust to infrequent ticks. */
import webpush from 'web-push';
import { kvGet, kvSet, kvConfigured } from '../lib/kv.js';

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const ok = req.query.key === secret || req.headers.authorization === `Bearer ${secret}`;
    if (!ok) return res.status(401).json({ error: 'unauthorized' });
  }

  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return res.status(500).json({ error: 'VAPID keys not configured' });
  if (!kvConfigured()) return res.status(503).json({ error: 'KV store not configured' });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:reminders@momentum.app', pub, priv);

  const subs = (await kvGet('push:subs')) || {};
  const now = Date.now();
  let sent = 0;
  const dead = [];

  for (const [endpoint, rec] of Object.entries(subs)) {
    const tz = rec.tz || 0; // minutes, as from Date.getTimezoneOffset()
    const local = new Date(now - tz * 60000);
    const localMin = local.getUTCHours() * 60 + local.getUTCMinutes();
    const localDow = local.getUTCDay();
    const localDate = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
    const already = new Set(rec.sent || []);

    for (const item of rec.schedule || []) {
      if (!item.time) continue;
      if (item.date && item.date !== localDate) continue;
      if (item.dow != null && item.dow !== localDow) continue;
      const diff = localMin - toMin(item.time);
      if (diff < 0 || diff >= 15) continue;
      const key = `${localDate}|${item.id}`;
      if (already.has(key)) continue;
      try {
        await webpush.sendNotification(
          rec.subscription,
          JSON.stringify({ title: item.title, body: item.body || '' })
        );
        already.add(key);
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) dead.push(endpoint);
      }
    }
    rec.sent = Array.from(already).slice(-60); // keep bounded
  }

  dead.forEach((e) => delete subs[e]);
  await kvSet('push:subs', subs);
  return res.status(200).json({ ok: true, sent, devices: Object.keys(subs).length });
}
