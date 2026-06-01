import { useEffect, useMemo, useState } from 'react';
import { useMomentum } from './store.js';
import { fmt, nowMinutes, streakOf, toMin, todayStr, weightStats, weeklyHabitStats } from './utils.js';

export default function App() {
  const store = useMomentum();
  const [tab, setTab] = useState('now');
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState(null); // habit object, {} for new, or null
  const [notifyState, setNotifyState] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const todaysEvents = useMemo(
    () =>
      store.state.events
        .filter((e) => e.date === todayStr())
        .sort((a, b) => (a.time ? toMin(a.time) : 9999) - (b.time ? toMin(b.time) : 9999)),
    [store.state.events]
  );

  const { current, next, upcoming } = useMemo(() => {
    const cur = nowMinutes();
    const timed = todaysEvents.filter((e) => e.time);
    let current = null;
    let next = null;
    for (const e of timed) {
      const t = toMin(e.time);
      if (t <= cur && t > cur - 90 && !e.done) current = e;
      if (t > cur && !next) next = e;
    }
    return { current, next, upcoming: timed.filter((e) => toMin(e.time) > cur).slice(0, 4) };
  }, [todaysEvents]);

  const submit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      store.addEvent(input);
      setInput('');
    }
  };

  return (
    <>
      <main id="app">
        {tab === 'now' && (
          <section className="view">
            <header className="now-header">
              <div className="clock">
                {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
              </div>
              <div className="date">{dateLabel}</div>
            </header>

            <div className={'now-card' + (current ? ' active' : '')}>
              <div className="now-card-label">Right now</div>
              {current ? (
                <>
                  <div className="now-card-title">{current.title}</div>
                  <div className="now-card-sub">Started {fmt(current.time)} · focus on this</div>
                  <button className="now-done-btn" onClick={() => store.toggleEvent(current.id)}>
                    Mark done
                  </button>
                </>
              ) : next ? (
                <>
                  <div className="now-card-title">Free right now</div>
                  <div className="now-card-sub">
                    Next: {next.title} at {fmt(next.time)}
                  </div>
                </>
              ) : (
                <>
                  <div className="now-card-title">
                    {todaysEvents.length ? 'You’re all caught up' : 'Nothing scheduled'}
                  </div>
                  <div className="now-card-sub">Add something below to get going.</div>
                </>
              )}
            </div>

            <div className="next-up">
              {upcoming.map((e) => (
                <div
                  key={e.id}
                  className={'next-item' + (e.done ? ' done' : '')}
                  onClick={() => store.toggleEvent(e.id)}
                >
                  <span className="t">{fmt(e.time)}</span>
                  <span className="n">{e.title}</span>
                </div>
              ))}
            </div>

            <div className="habits-strip">
              <div className="strip-label">Today’s habits</div>
              <div className="habit-chips">
                {store.state.habits.length === 0 && (
                  <span style={{ color: 'var(--muted)', fontSize: 14 }}>
                    No habits yet — add some in the Habits tab.
                  </span>
                )}
                {store.state.habits.map((h) => {
                  const done = !!(h.history && h.history[todayStr()]);
                  return (
                    <button
                      key={h.id}
                      className={'chip' + (done ? ' done' : '')}
                      onClick={() => store.toggleHabit(h.id)}
                    >
                      <span className="box" />
                      {h.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <WeeklyCheckin store={store} />
          </section>
        )}

        {tab === 'today' && (
          <section className="view">
            <header className="view-header">
              <h1>Today</h1>
              <span>{dateLabel}</span>
            </header>
            <div className="timeline">
              {todaysEvents.length === 0 && <div className="tl-empty">No events today. Add one below.</div>}
              {todaysEvents.map((e) => (
                <div
                  key={e.id}
                  className={'next-item' + (e.done ? ' done' : '')}
                  onClick={() => store.toggleEvent(e.id)}
                  onContextMenu={(ev) => {
                    ev.preventDefault();
                    if (confirm('Delete this?')) store.deleteEvent(e.id);
                  }}
                >
                  <span className="t">{e.time ? fmt(e.time) : '—'}</span>
                  <span className="n">{e.title}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'habits' && (
          <section className="view">
            <header className="view-header">
              <h1>Habits</h1>
            </header>
            <div className="habit-list">
              {store.state.habits.map((h) => {
                const done = !!(h.history && h.history[todayStr()]);
                const s = streakOf(h);
                return (
                  <div key={h.id} className="habit-row" onClick={() => setEditing(h)}>
                    <span
                      className="box"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        border: `2px solid ${done ? 'var(--good)' : 'var(--muted)'}`,
                        background: done ? 'var(--good)' : 'transparent',
                      }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        store.toggleHabit(h.id);
                      }}
                    />
                    <div className="info">
                      <div className="name">{h.name}</div>
                      <div className="meta">Reminder {fmt(h.time || '08:00')}</div>
                    </div>
                    <span className={'streak' + (s >= 3 ? ' hot' : '')}>{s > 0 ? `${s}d` : 'start'}</span>
                  </div>
                );
              })}
            </div>
            <button className="add-habit-btn" onClick={() => setEditing({})}>
              + New habit
            </button>
            <button
              className="add-habit-btn"
              style={{ borderStyle: 'solid', background: 'var(--accent-soft)', color: 'var(--text)' }}
              onClick={() => store.seedLeanPack()}
            >
              Add Lean Summer pack
            </button>
          </section>
        )}

        {tab === 'weight' && <WeightView store={store} />}
      </main>

      <form
        className="quick-add"
        onSubmit={submit}
        autoComplete="off"
        style={tab === 'weight' ? { display: 'none' } : undefined}
      >
        <input
          type="text"
          placeholder="Add  e.g.  Gym 7pm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" aria-label="Add">
          +
        </button>
      </form>

      <nav className="tabbar">
        <button className={'tab' + (tab === 'now' ? ' active' : '')} onClick={() => setTab('now')}>
          Now
        </button>
        <button className={'tab' + (tab === 'today' ? ' active' : '')} onClick={() => setTab('today')}>
          Today
        </button>
        <button className={'tab' + (tab === 'habits' ? ' active' : '')} onClick={() => setTab('habits')}>
          Habits
        </button>
        <button className={'tab' + (tab === 'weight' ? ' active' : '')} onClick={() => setTab('weight')}>
          Weight
        </button>
      </nav>

      {editing && (
        <HabitModal
          habit={editing}
          onClose={() => setEditing(null)}
          onSave={(h) => {
            store.saveHabit(h);
            setEditing(null);
          }}
          onDelete={(id) => {
            store.deleteHabit(id);
            setEditing(null);
          }}
        />
      )}

      {notifyState === 'default' && (
        <div className="notify-banner">
          <span>Turn on notifications so I can nudge you.</span>
          <button
            onClick={async () => {
              const r = await store.enableNotifications();
              setNotifyState(r);
            }}
          >
            Enable
          </button>
        </div>
      )}
    </>
  );
}

function HabitModal({ habit, onClose, onSave, onDelete }) {
  const isEdit = !!habit.id;
  const [name, setName] = useState(habit.name || '');
  const [time, setTime] = useState(habit.time || '08:00');

  useEffect(() => {
    setName(habit.name || '');
    setTime(habit.time || '08:00');
  }, [habit]);

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Edit habit' : 'New habit'}</h2>
        <label>
          Name
          <input
            type="text"
            placeholder="Drink water"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          Remind me at
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <div className="modal-actions">
          {isEdit ? (
            <button
              className="ghost"
              id="habit-delete"
              onClick={() => confirm('Delete this habit and its streak?') && onDelete(habit.id)}
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div>
            <button className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              onClick={() => name.trim() && onSave({ ...habit, name: name.trim(), time })}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeightView({ store }) {
  const { state } = store;
  const unit = state.goal?.unit || 'lb';
  const target = state.goal?.target ?? null;
  const [entry, setEntry] = useState('');
  const [goalInput, setGoalInput] = useState(target != null ? String(target) : '');

  const stats = useMemo(() => weightStats(state.weights, target), [state.weights, target]);
  const loggedToday = (state.weights || []).some((w) => w.date === todayStr());

  const submitWeight = (e) => {
    e.preventDefault();
    if (entry.trim()) {
      store.logWeight(entry);
      setEntry('');
    }
  };

  const losing = stats && stats.ratePerWeek < -0.01;
  const tooFast = stats && stats.pctPerWeek > 1.0;
  const rateLabel = stats
    ? `${stats.ratePerWeek > 0 ? '+' : ''}${stats.ratePerWeek.toFixed(1)} ${unit}/wk`
    : '—';

  return (
    <section className="view">
      <header className="view-header">
        <h1>Weight</h1>
        <button
          className="unit-toggle"
          onClick={() => store.setGoal({ unit: unit === 'lb' ? 'kg' : 'lb' })}
        >
          {unit}
        </button>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-num">{stats ? stats.current.toFixed(1) : '—'}</div>
          <div className="stat-label">Trend ({unit})</div>
        </div>
        <div className="stat">
          <div className={'stat-num' + (losing ? ' good' : '')}>{rateLabel}</div>
          <div className="stat-label">Weekly rate</div>
        </div>
        <div className="stat">
          <div className="stat-num">{target != null ? target : '—'}</div>
          <div className="stat-label">Goal ({unit})</div>
        </div>
      </div>

      {stats && stats.pts.length >= 2 ? (
        <WeightChart stats={stats} target={target} unit={unit} />
      ) : (
        <div className="tl-empty">Log a few days to see your trend line.</div>
      )}

      {stats && (
        <div className="projection">
          {target == null ? (
            'Set a goal weight below to get a projected finish date.'
          ) : tooFast ? (
            `Cutting ${stats.pctPerWeek.toFixed(1)}%/wk — fast enough to risk muscle. Aim for 0.5–1%.`
          ) : stats.etaDate ? (
            <>
              On track to hit <b>{target} {unit}</b> around{' '}
              <b>
                {new Date(stats.etaDate + 'T00:00').toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </b>{' '}
              ({Math.round(stats.weeksToGo)} weeks). Healthy pace at {stats.pctPerWeek.toFixed(1)}%/wk.
            </>
          ) : losing === false && stats.current > target ? (
            'Not trending down yet — log consistently and check the deficit.'
          ) : (
            'Keep logging to refine the projection.'
          )}
        </div>
      )}

      <form className="weight-entry" onSubmit={submitWeight}>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder={loggedToday ? 'Update today’s weight' : `Today’s weight (${unit})`}
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
        />
        <button type="submit">{loggedToday ? 'Update' : 'Log'}</button>
      </form>

      <div className="goal-row">
        <label>Goal weight ({unit})</label>
        <div>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="e.g. 175"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
          />
          <button
            onClick={() => store.setGoal({ target: goalInput ? parseFloat(goalInput) : null })}
          >
            Set
          </button>
        </div>
      </div>
    </section>
  );
}

function WeightChart({ stats, target, unit }) {
  const W = 320;
  const H = 150;
  const pad = { l: 6, r: 6, t: 10, b: 18 };
  const raw = stats.pts.map((p, i) => ({ x: p.x, y: p.y, s: stats.smoothed[i], date: p.date }));

  const ys = raw.flatMap((p) => [p.y, p.s]).concat(target != null ? [target] : []);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (max - min < 2) {
    min -= 1;
    max += 1;
  }
  const xs = raw.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const sx = (x) => pad.l + ((x - xMin) / (xMax - xMin || 1)) * (W - pad.l - pad.r);
  const sy = (y) => pad.t + (1 - (y - min) / (max - min || 1)) * (H - pad.t - pad.b);

  const smoothPath = raw.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.s).toFixed(1)}`).join(' ');
  const goalY = target != null ? sy(target) : null;

  return (
    <svg className="weight-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {goalY != null && (
        <line x1={pad.l} y1={goalY} x2={W - pad.r} y2={goalY} className="goal-line" />
      )}
      {raw.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.2" className="dot" />
      ))}
      <path d={smoothPath} className="trend" fill="none" />
    </svg>
  );
}

function WeeklyCheckin({ store }) {
  const { state } = store;
  const unit = state.goal?.unit || 'lb';
  const target = state.goal?.target ?? null;

  const hab = useMemo(() => weeklyHabitStats(state.habits), [state.habits]);
  const stats = useMemo(() => weightStats(state.weights, target), [state.weights, target]);

  const ratePct = hab.rate == null ? null : Math.round(hab.rate * 100);
  const weightChange = stats ? stats.ratePerWeek : null;
  const losing = weightChange != null && weightChange < -0.01;

  // Nothing to summarize yet.
  if (!state.habits.length && !stats) return null;

  // A short, honest read on the week.
  let verdict;
  if (ratePct != null && ratePct >= 80 && losing) verdict = 'Strong week — habits locked in and trending down.';
  else if (losing) verdict = 'Trending down. Tighten the habits to speed it up.';
  else if (ratePct != null && ratePct >= 80) verdict = 'Habits are solid — keep logging weight to confirm the deficit.';
  else verdict = 'Inconsistent week. Pick one habit to nail every day next week.';

  return (
    <div className="checkin">
      <div className="strip-label">This week</div>
      <div className="checkin-row">
        <div className="checkin-stat">
          <div className="checkin-num">{ratePct == null ? '—' : `${ratePct}%`}</div>
          <div className="checkin-label">Habits hit</div>
        </div>
        <div className="checkin-stat">
          <div className={'checkin-num' + (losing ? ' good' : '')}>
            {weightChange == null ? '—' : `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)}`}
          </div>
          <div className="checkin-label">{unit}/week</div>
        </div>
        <div className="checkin-stat">
          <div className="checkin-num">{hab.bestStreak || 0}</div>
          <div className="checkin-label">Best streak</div>
        </div>
      </div>
      <div className="checkin-verdict">{verdict}</div>
    </div>
  );
}
