// Pure helpers — no React, easy to test.

export const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const fmt = (hhmm) => {
  let [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return m === 0 ? `${h}${ap}` : `${h}:${String(m).padStart(2, '0')}${ap}`;
};

export const uid = () => Math.random().toString(36).slice(2, 9);

// "Gym 7pm", "Call mom 14:30", "lunch noon", "Standup 9:30am"
export function parseQuickAdd(raw) {
  let text = raw.trim();
  let time = null;

  const noonMatch = /\b(noon|midday)\b/i.exec(text);
  if (noonMatch) {
    time = '12:00';
    text = text.replace(noonMatch[0], '').trim();
  }

  const ampm = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(text);
  const h24 = /\b(\d{1,2}):(\d{2})\b/.exec(text);

  if (!time && ampm) {
    let h = parseInt(ampm[1], 10) % 12;
    if (/pm/i.test(ampm[3])) h += 12;
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
    time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    text = text.replace(ampm[0], '').trim();
  } else if (!time && h24) {
    time = `${String(parseInt(h24[1], 10)).padStart(2, '0')}:${h24[2]}`;
    text = text.replace(h24[0], '').trim();
  }

  text = text.replace(/\s+at\s*$/i, '').replace(/\s{2,}/g, ' ').trim();
  return { title: text || raw.trim(), time };
}

export function streakOf(habit, today = new Date()) {
  let n = 0;
  const d = new Date(today);
  for (;;) {
    const ds = todayStr(d);
    if (habit.history && habit.history[ds]) {
      n++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return n;
}

// Days between two 'YYYY-MM-DD' strings (b - a).
export function daysBetween(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((db - da) / 86400000);
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// Trailing moving average over a numeric series (by position).
export function movingAverage(values, window = 7) {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/* Turn raw daily weigh-ins into the numbers that actually matter for a cut:
   a smoothed current weight, weekly rate of change (least-squares over the
   recent window), and a projected date to hit the goal. */
export function weightStats(weights, target) {
  if (!weights || weights.length === 0) return null;
  const sorted = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0].date;
  const pts = sorted.map((w) => ({ x: daysBetween(first, w.date), y: w.value, date: w.date }));
  const smoothed = movingAverage(pts.map((p) => p.y), 7);
  const current = smoothed[smoothed.length - 1];

  // Least-squares slope (per day) over the last up-to-28 points.
  const win = pts.slice(-28);
  let ratePerWeek = 0;
  if (win.length >= 2) {
    const n = win.length;
    const sx = win.reduce((s, p) => s + p.x, 0);
    const sy = win.reduce((s, p) => s + p.y, 0);
    const sxy = win.reduce((s, p) => s + p.x * p.y, 0);
    const sxx = win.reduce((s, p) => s + p.x * p.x, 0);
    const denom = n * sxx - sx * sx;
    if (denom !== 0) ratePerWeek = ((n * sxy - sx * sy) / denom) * 7;
  }

  let etaDate = null;
  let weeksToGo = null;
  if (target != null && ratePerWeek < -0.01 && current > target) {
    weeksToGo = (current - target) / -ratePerWeek;
    etaDate = addDays(sorted[sorted.length - 1].date, Math.round(weeksToGo * 7));
  }

  // % of bodyweight per week — healthy cut is ~0.5–1%.
  const pctPerWeek = current ? (Math.abs(ratePerWeek) / current) * 100 : 0;

  return { sorted, pts, smoothed, current, ratePerWeek, weeksToGo, etaDate, pctPerWeek };
}

// Daily step counts -> the numbers and series a Steps view needs.
export function stepsStats(steps, goal = 10000) {
  const list = steps || [];
  if (!list.length) return null;
  const map = {};
  list.forEach((s) => { map[s.date] = s.value; });
  const today = todayStr();
  const span = (n) => Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)));

  const last14 = span(14).map((d) => ({ date: d, value: map[d] || 0 }));
  const last7 = span(7).map((d) => ({ date: d, value: map[d] || 0 }));
  const logged7 = last7.filter((d) => map[d.date] != null);
  const weekAvg = logged7.length
    ? Math.round(logged7.reduce((a, b) => a + b.value, 0) / logged7.length)
    : 0;
  const daysHitWeek = last7.filter((d) => d.value >= goal).length;
  const todayVal = map[today] ?? null;

  // Consecutive days ending today that hit the goal.
  let streak = 0;
  let cur = today;
  while ((map[cur] || 0) >= goal) {
    streak++;
    cur = addDays(cur, -1);
  }

  return { last14, last7, weekAvg, daysHitWeek, todayVal, streak, goal };
}

// Habit consistency over the last 7 days (including today).
export function weeklyHabitStats(habits, today = todayStr()) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  let done = 0;
  let total = 0;
  let bestStreak = 0;
  habits.forEach((h) => {
    bestStreak = Math.max(bestStreak, streakOf(h));
    days.forEach((d) => {
      total += 1;
      if (h.history && h.history[d]) done += 1;
    });
  });
  return { done, total, rate: total ? done / total : null, bestStreak, days: days.length };
}

/* ---------------- Workouts ---------------- */

export const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Total tonnage of a session = sum(weight * reps) across all sets.
export function workoutVolume(workout) {
  let v = 0;
  (workout.entries || []).forEach((e) =>
    (e.sets || []).forEach((s) => {
      const w = parseFloat(s.weight) || 0;
      const r = parseInt(s.reps, 10) || 0;
      v += w * r;
    })
  );
  return Math.round(v);
}

export function workoutSetCount(workout) {
  return (workout.entries || []).reduce((n, e) => n + (e.sets || []).length, 0);
}

// Aggregate gym behaviour for insights.
export function gymStats(workouts, exercises, today = todayStr()) {
  const catOf = {};
  (exercises || []).forEach((e) => { catOf[e.id] = e.category; });
  const within = (date, n) => daysBetween(date, today) >= 0 && daysBetween(date, today) < n;

  const last7 = (workouts || []).filter((w) => within(w.date, 7));
  const last30 = (workouts || []).filter((w) => within(w.date, 30));

  const catSets = {};
  const dow = [0, 0, 0, 0, 0, 0, 0];
  last30.forEach((w) => {
    const d = new Date(w.date + 'T00:00').getDay();
    dow[d] += 1;
    (w.entries || []).forEach((e) => {
      const c = catOf[e.id] || 'Other';
      catSets[c] = (catSets[c] || 0) + (e.sets || []).length;
    });
  });

  let topCategory = null;
  let topSets = 0;
  Object.entries(catSets).forEach(([c, n]) => { if (n > topSets) { topSets = n; topCategory = c; } });

  let topDay = null;
  let topDayN = 0;
  dow.forEach((n, i) => { if (n > topDayN) { topDayN = n; topDay = i; } });

  const volume7 = last7.reduce((sum, w) => sum + workoutVolume(w), 0);

  return {
    count7: last7.length,
    count30: last30.length,
    volume7,
    topCategory,
    topSets,
    topDay,
    catSets, // { category: setCount } over last 30 days
    byDay: dow, // [Sun..Sat] workout counts over last 30 days
    lastDate: (workouts || []).map((w) => w.date).sort().pop() || null,
  };
}

// Flatten all workouts to CSV (one row per set). No paywall.
export function workoutsToCSV(workouts, exercises) {
  const nameOf = {};
  const catOf = {};
  (exercises || []).forEach((e) => { nameOf[e.id] = e.name; catOf[e.id] = e.category; });
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['Date', 'Workout', 'Exercise', 'Category', 'Set', 'Weight', 'Reps']];
  [...(workouts || [])]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((w) => {
      (w.entries || []).forEach((e) => {
        (e.sets || []).forEach((s, i) => {
          rows.push([
            w.date,
            w.name || 'Workout',
            nameOf[e.id] || e.name || e.id,
            catOf[e.id] || '',
            i + 1,
            s.weight ?? '',
            s.reps ?? '',
          ]);
        });
      });
    });
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
