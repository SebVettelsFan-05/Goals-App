/* POST: store/refresh a device's push subscription and its reminder schedule.
   Body: { subscription, schedule:[{id,time,title,body,daily?,date?,dow?}], tz } */
import { kvGet, kvSet, kvConfigured } from '../lib/kv.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!kvConfigured()) return res.status(503).json({ error: 'KV store not configured' });

  try {
    const { subscription, schedule, tz } = req.body || {};
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'missing subscription' });
    }
    const subs = (await kvGet('push:subs')) || {};
    const prev = subs[subscription.endpoint];
    subs[subscription.endpoint] = {
      subscription,
      schedule: Array.isArray(schedule) ? schedule : [],
      tz: Number.isFinite(tz) ? tz : 0,
      sent: (prev && prev.sent) || [],
    };
    await kvSet('push:subs', subs);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
