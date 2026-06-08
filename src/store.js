import { useEffect, useRef, useState } from 'react';
import { fmt, nowMinutes, parseQuickAdd, slug, toMin, todayStr, uid } from './utils.js';

const KEY = 'momentum.v1';

// A starter exercise library so the tracker is usable immediately.
const DEFAULT_EXERCISES = [
  ['Bench Press', 'Chest'], ['Incline Dumbbell Press', 'Chest'], ['Chest Fly', 'Chest'], ['Push-up', 'Chest'],
  ['Deadlift', 'Back'], ['Pull-up', 'Back'], ['Barbell Row', 'Back'], ['Lat Pulldown', 'Back'], ['Seated Cable Row', 'Back'],
  ['Squat', 'Legs'], ['Leg Press', 'Legs'], ['Romanian Deadlift', 'Legs'], ['Walking Lunge', 'Legs'], ['Leg Curl', 'Legs'], ['Leg Extension', 'Legs'], ['Calf Raise', 'Legs'],
  ['Overhead Press', 'Shoulders'], ['Lateral Raise', 'Shoulders'], ['Face Pull', 'Shoulders'],
  ['Bicep Curl', 'Arms'], ['Hammer Curl', 'Arms'], ['Tricep Pushdown', 'Arms'], ['Skullcrusher', 'Arms'],
  ['Plank', 'Core'], ['Hanging Leg Raise', 'Core'], ['Cable Crunch', 'Core'],
  ['Treadmill', 'Cardio'], ['Cycling', 'Cardio'], ['Rowing', 'Cardio'],
];
function defaultExercises() {
  return DEFAULT_EXERCISES.map(([name, category]) => ({ id: 'd_' + slug(name), name, category }));
}

export const EXERCISE_CATEGORIES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Other'];

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    // Merge defaults so older saved states gain new fields.
    return parsed ? { ...fresh(), ...parsed } : fresh();
  } catch {
    return fresh();
  }
}
function fresh() {
  return {
    events: [],
    habits: [],
    notified: {},
    weights: [],
    goal: { target: null, unit: 'lb' },
    steps: [],
    stepGoal: 10000,
    exercises: defaultExercises(),
    routines: [],
    workouts: [],
    activeWorkout: null,
    meals: [],
    calorieGoal: 2000,
    sleep: [],
    sleepGoal: 8,
  };
}

// Behaviors proven to matter for a lean cut — seeded in one tap.
export const LEAN_PACK = [
  { name: 'Hit protein', time: '12:00' },
  { name: 'Train', time: '17:00' },
  { name: '10k steps', time: '19:00' },
  { name: 'No late snack', time: '21:00' },
  { name: '7h+ sleep', time: '22:30' },
];

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

// ---- Web Push (real background reminders) ----
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;
export const pushAvailable =
  !!VAPID_PUBLIC && 'serviceWorker' in navigator && 'PushManager' in window;

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Turn the user's habits/events into a server-side reminder schedule.
function buildSchedule(s) {
  const items = [];
  s.habits.forEach((h) =>
    items.push({
      id: `hb:${h.id}`,
      time: h.time || '08:00',
      title: h.name,
      body: 'Habit check — open to mark it done.',
      daily: true,
    })
  );
  (s.events || [])
    .filter((e) => e.time && e.date >= todayStr() && !e.done)
    .forEach((e) =>
      items.push({ id: `ev:${e.id}`, time: e.time, date: e.date, title: e.title, body: 'Time for this.' })
    );
  // Sunday evening weekly check-in.
  items.push({
    id: 'weekly',
    time: '18:00',
    dow: 0,
    title: 'Weekly check-in',
    body: 'See how your week went and line up next week.',
  });
  return items;
}

async function syncPushSubscription(s) {
  if (!pushAvailable || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }
  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub, schedule: buildSchedule(s), tz: new Date().getTimezoneOffset() }),
  });
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

  // Keep the push backend's schedule in sync (also subscribes on load if granted).
  useEffect(() => {
    syncPushSubscription(stateRef.current).catch(() => {});
  }, [state.habits, state.events, state.goal]);

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

  // Upsert today's weigh-in (one entry per day; latest wins).
  const logWeight = (value) =>
    setState((p) => {
      const v = parseFloat(value);
      if (!isFinite(v) || v <= 0) return p;
      const d = todayStr();
      const others = (p.weights || []).filter((w) => w.date !== d);
      return { ...p, weights: [...others, { date: d, value: v }] };
    });

  const deleteWeight = (date) =>
    setState((p) => ({ ...p, weights: (p.weights || []).filter((w) => w.date !== date) }));

  const setGoal = (goal) => setState((p) => ({ ...p, goal: { ...p.goal, ...goal } }));

  // Upsert today's step count (one entry per day; latest wins).
  const logSteps = (value) =>
    setState((p) => {
      const v = Math.round(parseFloat(value));
      if (!isFinite(v) || v < 0) return p;
      const d = todayStr();
      const others = (p.steps || []).filter((s) => s.date !== d);
      return { ...p, steps: [...others, { date: d, value: v }] };
    });

  const setStepGoal = (value) => {
    const v = Math.round(parseFloat(value));
    if (isFinite(v) && v > 0) setState((p) => ({ ...p, stepGoal: v }));
  };

  // ---- Exercise library ----
  const addExercise = (name, category) => {
    const nm = (name || '').trim();
    if (!nm) return null;
    const ex = { id: uid(), name: nm, category: category || 'Other' };
    setState((p) => ({ ...p, exercises: [...(p.exercises || []), ex] }));
    return ex;
  };
  const deleteExercise = (id) =>
    setState((p) => ({ ...p, exercises: (p.exercises || []).filter((e) => e.id !== id) }));

  // ---- Routines (repeatable templates) ----
  const saveRoutine = (routine) =>
    setState((p) => {
      const routines = p.routines || [];
      if (routine.id && routines.some((r) => r.id === routine.id)) {
        return { ...p, routines: routines.map((r) => (r.id === routine.id ? { ...r, ...routine } : r)) };
      }
      return { ...p, routines: [...routines, { id: uid(), ...routine }] };
    });
  const deleteRoutine = (id) =>
    setState((p) => ({ ...p, routines: (p.routines || []).filter((r) => r.id !== id) }));

  // ---- Active workout ----
  // Prefill each exercise's sets from the most recent past session of that exercise.
  const prefillEntry = (s, exId) => {
    for (let i = (s.workouts || []).length - 1; i >= 0; i--) {
      const e = (s.workouts[i].entries || []).find((x) => x.id === exId);
      if (e && e.sets && e.sets.length) {
        return e.sets.map((set) => ({ weight: set.weight, reps: set.reps, done: false }));
      }
    }
    return [{ weight: '', reps: '', done: false }];
  };

  const startWorkout = (name, exerciseIds = [], routineId = null) =>
    setState((p) => ({
      ...p,
      activeWorkout: {
        name: name || 'Workout',
        routineId,
        entries: exerciseIds.map((id) => ({ id, sets: prefillEntry(p, id) })),
      },
    }));

  const startRoutine = (routineId) =>
    setState((p) => {
      const r = (p.routines || []).find((x) => x.id === routineId);
      if (!r) return p;
      return {
        ...p,
        activeWorkout: {
          name: r.name,
          routineId,
          entries: (r.exerciseIds || []).map((id) => ({ id, sets: prefillEntry(p, id) })),
        },
      };
    });

  const repeatWorkout = (workoutId) =>
    setState((p) => {
      const w = (p.workouts || []).find((x) => x.id === workoutId);
      if (!w) return p;
      return {
        ...p,
        activeWorkout: {
          name: w.name,
          routineId: w.routineId || null,
          entries: (w.entries || []).map((e) => ({
            id: e.id,
            sets: (e.sets || []).map((s) => ({ weight: s.weight, reps: s.reps, done: false })),
          })),
        },
      };
    });

  const updateActive = (fn) =>
    setState((p) => (p.activeWorkout ? { ...p, activeWorkout: fn(p.activeWorkout) } : p));

  const setActiveName = (name) => updateActive((a) => ({ ...a, name }));
  const addActiveExercise = (exId) =>
    updateActive((a) =>
      a.entries.some((e) => e.id === exId)
        ? a
        : { ...a, entries: [...a.entries, { id: exId, sets: [{ weight: '', reps: '', done: false }] }] }
    );
  const removeActiveExercise = (idx) =>
    updateActive((a) => ({ ...a, entries: a.entries.filter((_, i) => i !== idx) }));
  const addSet = (exIdx) =>
    updateActive((a) => ({
      ...a,
      entries: a.entries.map((e, i) => {
        if (i !== exIdx) return e;
        const last = e.sets[e.sets.length - 1];
        return { ...e, sets: [...e.sets, { weight: last?.weight || '', reps: last?.reps || '', done: false }] };
      }),
    }));
  const updateSet = (exIdx, setIdx, field, value) =>
    updateActive((a) => ({
      ...a,
      entries: a.entries.map((e, i) =>
        i !== exIdx ? e : { ...e, sets: e.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s)) }
      ),
    }));
  const toggleSet = (exIdx, setIdx) =>
    updateActive((a) => ({
      ...a,
      entries: a.entries.map((e, i) =>
        i !== exIdx ? e : { ...e, sets: e.sets.map((s, j) => (j === setIdx ? { ...s, done: !s.done } : s)) }
      ),
    }));
  const removeSet = (exIdx, setIdx) =>
    updateActive((a) => ({
      ...a,
      entries: a.entries.map((e, i) => (i !== exIdx ? e : { ...e, sets: e.sets.filter((_, j) => j !== setIdx) })),
    }));

  const cancelWorkout = () => setState((p) => ({ ...p, activeWorkout: null }));

  const finishWorkout = () =>
    setState((p) => {
      const a = p.activeWorkout;
      if (!a) return p;
      // Keep only sets with at least reps logged; drop empty exercises.
      const entries = a.entries
        .map((e) => ({
          id: e.id,
          sets: e.sets
            .filter((s) => `${s.reps}`.trim() !== '' || `${s.weight}`.trim() !== '')
            .map((s) => ({ weight: s.weight === '' ? 0 : Number(s.weight), reps: s.reps === '' ? 0 : Number(s.reps) })),
        }))
        .filter((e) => e.sets.length > 0);
      if (!entries.length) return { ...p, activeWorkout: null };
      const workout = { id: uid(), date: todayStr(), name: a.name, routineId: a.routineId || null, entries };
      return { ...p, activeWorkout: null, workouts: [...(p.workouts || []), workout] };
    });

  const deleteWorkout = (id) =>
    setState((p) => ({ ...p, workouts: (p.workouts || []).filter((w) => w.id !== id) }));

  // ---- Food (calorie estimate) ----
  const addMeal = (label, kcal) =>
    setState((p) => {
      const k = Math.round(parseFloat(kcal));
      if (!isFinite(k) || k <= 0) return p;
      return {
        ...p,
        meals: [...(p.meals || []), { id: uid(), date: todayStr(), label: (label || '').trim() || 'Meal', kcal: k }],
      };
    });
  const deleteMeal = (id) =>
    setState((p) => ({ ...p, meals: (p.meals || []).filter((m) => m.id !== id) }));
  const setCalorieGoal = (value) => {
    const v = Math.round(parseFloat(value));
    if (isFinite(v) && v > 0) setState((p) => ({ ...p, calorieGoal: v }));
  };

  // ---- Sleep ----
  const logSleep = (hours) =>
    setState((p) => {
      const v = parseFloat(hours);
      if (!isFinite(v) || v < 0 || v > 24) return p;
      const d = todayStr();
      const others = (p.sleep || []).filter((s) => s.date !== d);
      return { ...p, sleep: [...others, { date: d, hours: Math.round(v * 10) / 10 }] };
    });
  const setSleepGoal = (value) => {
    const v = parseFloat(value);
    if (isFinite(v) && v > 0 && v <= 14) setState((p) => ({ ...p, sleepGoal: v }));
  };

  const seedLeanPack = () =>
    setState((p) => {
      const existing = new Set(p.habits.map((h) => h.name));
      const toAdd = LEAN_PACK.filter((h) => !existing.has(h.name)).map((h) => ({
        id: uid(),
        history: {},
        ...h,
      }));
      return { ...p, habits: [...p.habits, ...toAdd] };
    });

  // Ask permission, then (if granted) subscribe to push and push the schedule.
  const enableNotifications = async () => {
    if (!('Notification' in window)) return 'unsupported';
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      try {
        await syncPushSubscription(stateRef.current);
      } catch {}
    }
    return perm;
  };

  return {
    state,
    addEvent,
    toggleEvent,
    deleteEvent,
    toggleHabit,
    saveHabit,
    deleteHabit,
    logWeight,
    deleteWeight,
    setGoal,
    logSteps,
    setStepGoal,
    addExercise,
    deleteExercise,
    saveRoutine,
    deleteRoutine,
    startWorkout,
    startRoutine,
    repeatWorkout,
    setActiveName,
    addActiveExercise,
    removeActiveExercise,
    addSet,
    updateSet,
    toggleSet,
    removeSet,
    cancelWorkout,
    finishWorkout,
    deleteWorkout,
    addMeal,
    deleteMeal,
    setCalorieGoal,
    logSleep,
    setSleepGoal,
    seedLeanPack,
    enableNotifications,
  };
}
