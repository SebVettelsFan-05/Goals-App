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
