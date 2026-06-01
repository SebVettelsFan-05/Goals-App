import { useEffect, useRef, useState } from 'react';
import { fmt, nowMinutes, parseQuickAdd, toMin, todayStr, uid } from './utils.js';

const KEY = 'momentum.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || fresh();
  } catch {
    return fresh();
  }
}
function fresh() {
  return { events: [], habits: [], notified: {} };
}

function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (navigator.serviceWorker?.ready) {
    navigator.serviceWorker.ready
      .then((reg) =>
        reg.showNotification
          ? reg.showNotification(title, { body, icon: '/icon.svg', tag: title + body })
          : new Notification(title, { body })
      )
      .catch(() => {
        try {
          new Notification(title, { body });
        } catch {}
      });
  } else {
    try {
      new Notification(title, { body });
    } catch {}
  }
}

export function useMomentum() {
  const [state, setState] = useState(load);
  const [, forceTick] = useState(0); // re-render the clock every 30s
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist on every change.
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  // Tick: refresh clock, reset day, and fire due notifications.
  useEffect(() => {
    let lastDay = todayStr();
    function check() {
      const s = stateRef.current;
      const cur = nowMinutes();
      const day = todayStr();
      const fired = [];

      s.events
        .filter((e) => e.date === day && e.time && !e.done)
        .forEach((e) => {
          const t = toMin(e.time);
          const k = `ev:${e.id}:${day}`;
          if (t <= cur && t > cur - 1 && !s.notified[k]) {
            notify(e.title, `It’s ${fmt(e.time)} — time for this.`);
            fired.push(k);
          }
        });

      s.habits.forEach((h) => {
        if (h.history && h.history[day]) return;
        const t = toMin(h.time || '08:00');
        const k = `hb:${h.id}:${day}`;
        if (t <= cur && t > cur - 1 && !s.notified[k]) {
          notify(h.name, 'Quick habit check — tap to mark done.');
          fired.push(k);
        }
      });

      if (day !== lastDay) {
        lastDay = day;
        setState((p) => ({ ...p, notified: {} }));
      } else if (fired.length) {
        setState((p) => {
          const notified = { ...p.notified };
          fired.forEach((k) => (notified[k] = true));
          return { ...p, notified };
        });
      }
      forceTick((n) => n + 1);
    }
    const id = setInterval(check, 30000);
    check();
    return () => clearInterval(id);
  }, []);

  // ---- actions ----
  const addEvent = (raw) => {
    const { title, time } = parseQuickAdd(raw);
    setState((p) => ({
      ...p,
      events: [...p.events, { id: uid(), title, time, date: todayStr(), done: false }],
    }));
  };

  const toggleEvent = (id) =>
    setState((p) => ({
      ...p,
      events: p.events.map((e) => (e.id === id ? { ...e, done: !e.done } : e)),
    }));

  const deleteEvent = (id) =>
    setState((p) => ({ ...p, events: p.events.filter((e) => e.id !== id) }));

  const toggleHabit = (id) =>
    setState((p) => ({
      ...p,
      habits: p.habits.map((h) => {
        if (h.id !== id) return h;
        const history = { ...(h.history || {}) };
        const d = todayStr();
        if (history[d]) delete history[d];
        else history[d] = true;
        return { ...h, history };
      }),
    }));

  const saveHabit = (habit) =>
    setState((p) => {
      if (habit.id && p.habits.some((h) => h.id === habit.id)) {
        return { ...p, habits: p.habits.map((h) => (h.id === habit.id ? { ...h, ...habit } : h)) };
      }
      return { ...p, habits: [...p.habits, { id: uid(), history: {}, ...habit }] };
    });

  const deleteHabit = (id) =>
    setState((p) => ({ ...p, habits: p.habits.filter((h) => h.id !== id) }));

  return { state, addEvent, toggleEvent, deleteEvent, toggleHabit, saveHabit, deleteHabit };
}

export async function requestNotifications() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}
