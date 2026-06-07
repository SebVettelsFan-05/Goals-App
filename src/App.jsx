import { useEffect, useMemo, useState } from 'react';
import { useMomentum } from './store.js';
import { useInstall } from './install.js';
import { addDays, fmt, nowMinutes, streakOf, toMin, todayStr, weightStats, weeklyHabitStats } from './utils.js';

const lastDays = (n) => Array.from({ length: n }, (_, i) => addDays(todayStr(), -(n - 1 - i)));
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const greeting = (h) => (h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

export default function App() {
  const store = useMomentum();
  const [tab, setTab] = useState('home');
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

  const { current, next } = useMemo(() => {
    const cur = nowMinutes();
    const timed = todaysEvents.filter((e) => e.time);
    let current = null;
    let next = null;
    for (const e of timed) {
      const t = toMin(e.time);
      if (t <= cur && t > cur - 90 && !e.done) current = e;
      if (t > cur && !next) next = e;
    }
    return { current, next };
  }, [todaysEvents]);

  const submit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      store.addEvent(input);
      setInput('');
    }
  };

  const showQuickAdd = tab === 'home' || tab === 'today';

  return (
    <>
      <main id="app" className={showQuickAdd ? 'has-quickadd' : ''}>
        {tab === 'home' && (
          <section className="view">
            <header className="hero">
              <div className="hero-greet">{greeting(now.getHours())}</div>
              <div className="hero-date">{dateLabel}</div>
            </header>

            <InstallCard />

            <FocusCard current={current} next={next} count={todaysEvents.length} store={store} />

            <WeightCard store={store} onOpen={() => setTab('weight')} />

            <HomeHabits store={store} onManage={() => setTab('habits')} />

            <Heatmap habits={store.state.habits} />

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
              {todaysEvents.length === 0 && (
                <div className="empty">
                  <div className="empty-big">Nothing planned yet</div>
                  <div>Add your day below — try “Gym 7pm”.</div>
                </div>
              )}
              {todaysEvents.map((e) => (
                <button
                  key={e.id}
                  className={'row tappable' + (e.done ? ' done' : '')}
                  onClick={() => store.toggleEvent(e.id)}
                  onContextMenu={(ev) => {
                    ev.preventDefault();
                    if (confirm('Delete this?')) store.deleteEvent(e.id);
                  }}
                >
                  <span className={'check' + (e.done ? ' on' : '')} />
                  <span className="row-time">{e.time ? fmt(e.time) : '—'}</span>
                  <span className="row-name">{e.title}</span>
                </button>
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
              {store.state.habits.length === 0 && (
                <div className="empty">
                  <div className="empty-big">No habits yet</div>
                  <div>Build momentum with a few small daily wins.</div>
                </div>
              )}
              {store.state.habits.map((h) => {
                const done = !!(h.history && h.history[todayStr()]);
                const s = streakOf(h);
                return (
                  <div key={h.id} className="habit-row" onClick={() => setEditing(h)}>
                    <button
                      className={'check big' + (done ? ' on' : '')}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        store.toggleHabit(h.id);
                      }}
                      aria-label="toggle"
                    />
                    <div className="info">
                      <div className="name">{h.name}</div>
                      <div className="meta">Reminder {fmt(h.time || '08:00')}</div>
                      <DotStrip habit={h} />
                    </div>
                    <span className={'streak' + (s >= 3 ? ' hot' : '')}>{s > 0 ? `${s}d` : 'start'}</span>
                  </div>
                );
              })}
            </div>
            <button className="btn-outline" onClick={() => setEditing({})}>
              + New habit
            </button>
            <button className="btn-soft" onClick={() => store.seedLeanPack()}>
              Add Lean Summer pack
            </button>
          </section>
        )}

        {tab === 'weight' && <WeightView store={store} />}
      </main>

      {showQuickAdd && (
        <form className="quick-add" onSubmit={submit} autoComplete="off">
          <input
            type="text"
            placeholder="Add to today — e.g. Gym 7pm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" aria-label="Add">
            +
          </button>
        </form>
      )}

      <nav className="tabbar">
        {[
          ['home', 'Home'],
          ['today', 'Today'],
          ['habits', 'Habits'],
          ['weight', 'Weight'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={'tab' + (tab === key ? ' active' : '')}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
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
          <span>Turn on reminders so I can nudge you.</span>
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

/* ---------------- Home cards ---------------- */

function InstallCard() {
  const { installed, canPrompt, isIOS, promptInstall } = useInstall();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('momentum.installDismissed') === '1'
  );
  const [showIOS, setShowIOS] = useState(false);

  if (installed || dismissed) return null;
  if (!canPrompt && !isIOS) return null;

  const dismiss = () => {
    localStorage.setItem('momentum.installDismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="install-card">
      <div className="install-text">
        <div className="install-title">Add Momentum to your home screen</div>
        <div className="install-sub">One tap to open, plus reminders. Takes 5 seconds.</div>
      </div>
      <div className="install-actions">
        {canPrompt ? (
          <button className="btn-primary sm" onClick={promptInstall}>
            Add
          </button>
        ) : (
          <button className="btn-primary sm" onClick={() => setShowIOS(true)}>
            How
          </button>
        )}
        <button className="btn-x" onClick={dismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>

      {showIOS && (
        <div className="modal" onClick={() => setShowIOS(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Add to Home Screen</h2>
            <ol className="steps">
              <li>Tap the <b>Share</b> button in Safari’s toolbar.</li>
              <li>Scroll and tap <b>Add to Home Screen</b>.</li>
              <li>Tap <b>Add</b> — then open Momentum from your home screen.</li>
            </ol>
            <div className="modal-actions">
              <span />
              <div>
                <button className="btn-primary" onClick={() => setShowIOS(false)}>
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FocusCard({ current, next, count, store }) {
  return (
    <div className={'card focus' + (current ? ' active' : '')}>
      <div className="card-label">Right now</div>
      {current ? (
        <>
          <div className="focus-title">{current.title}</div>
          <div className="focus-sub">Started {fmt(current.time)} · focus on this</div>
          <button className="btn-primary" onClick={() => store.toggleEvent(current.id)}>
            Mark done
          </button>
        </>
      ) : next ? (
        <>
          <div className="focus-title">Free right now</div>
          <div className="focus-sub">
            Next up: {next.title} at {fmt(next.time)}
          </div>
        </>
      ) : (
        <>
          <div className="focus-title">{count ? 'All caught up' : 'Open runway'}</div>
          <div className="focus-sub">
            {count ? 'Nice — nothing scheduled right now.' : 'Add something below to get going.'}
          </div>
        </>
      )}
    </div>
  );
}

function WeightCard({ store, onOpen }) {
  const { state } = store;
  const unit = state.goal?.unit || 'lb';
  const target = state.goal?.target ?? null;
  const [entry, setEntry] = useState('');

  const stats = useMemo(() => weightStats(state.weights, target), [state.weights, target]);
  const todayVal = (state.weights || []).find((w) => w.date === todayStr())?.value;

  const submit = (e) => {
    e.preventDefault();
    if (entry.trim()) {
      store.logWeight(entry);
      setEntry('');
    }
  };

  const losing = stats && stats.ratePerWeek < -0.01;
  const rateLabel = stats
    ? `${stats.ratePerWeek > 0 ? '+' : ''}${stats.ratePerWeek.toFixed(1)} ${unit}/wk`
    : null;

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-label">Weight</div>
        <button className="link-btn" onClick={onOpen}>
          Details
        </button>
      </div>

      <div className="weight-hero">
        <div className="weight-now">
          {stats ? stats.current.toFixed(1) : '—'}
          <span className="unit">{unit}</span>
        </div>
        {rateLabel && <div className={'rate-pill' + (losing ? ' good' : '')}>{rateLabel}</div>}
      </div>

      {stats && stats.pts.length >= 2 ? (
        <WeightChart stats={stats} target={target} unit={unit} />
      ) : (
        <div className="chart-hint">Log a few days to see your live trend line.</div>
      )}

      {stats && (
        <GoalBar start={stats.sorted[0]?.value} current={stats.current} goal={target} unit={unit} />
      )}

      <form className="weight-entry" onSubmit={submit}>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder={todayVal != null ? `Logged ${todayVal} ${unit} — update?` : `Log today’s weight (${unit})`}
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
        />
        <button type="submit" className="btn-primary">
          {todayVal != null ? 'Update' : 'Log'}
        </button>
      </form>
    </div>
  );
}

function HomeHabits({ store, onManage }) {
  const habits = store.state.habits;
  const day = todayStr();
  const doneCount = habits.filter((h) => h.history && h.history[day]).length;

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-label">
          Today’s habits {habits.length > 0 && <span className="count">{doneCount}/{habits.length}</span>}
        </div>
        <button className="link-btn" onClick={onManage}>
          {habits.length ? 'Edit' : 'Add'}
        </button>
      </div>
      {habits.length === 0 ? (
        <div className="chart-hint">No habits yet. Tap “Add” to start a streak.</div>
      ) : (
        <div className="habit-toggles">
          {habits.map((h) => {
            const done = !!(h.history && h.history[day]);
            return (
              <button
                key={h.id}
                className={'toggle' + (done ? ' done' : '')}
                onClick={() => store.toggleHabit(h.id)}
              >
                <span className={'check' + (done ? ' on' : '')} />
                <span>{h.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Weight tab (details) ---------------- */

function WeightView({ store }) {
  const { state } = store;
  const unit = state.goal?.unit || 'lb';
  const target = state.goal?.target ?? null;
  const [entry, setEntry] = useState('');
  const [goalInput, setGoalInput] = useState(target != null ? String(target) : '');

  const stats = useMemo(() => weightStats(state.weights, target), [state.weights, target]);
  const todayVal = (state.weights || []).find((w) => w.date === todayStr())?.value;

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
        <button className="unit-toggle" onClick={() => store.setGoal({ unit: unit === 'lb' ? 'kg' : 'lb' })}>
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
        <WeightChart stats={stats} target={target} unit={unit} height={190} />
      ) : (
        <div className="chart-hint">Log a few days to see your trend line.</div>
      )}

      {stats && (
        <GoalBar start={stats.sorted[0]?.value} current={stats.current} goal={target} unit={unit} />
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
          placeholder={todayVal != null ? `Logged ${todayVal} — update?` : `Today’s weight (${unit})`}
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
        />
        <button type="submit" className="btn-primary">
          {todayVal != null ? 'Update' : 'Log'}
        </button>
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
          <button className="btn-soft inline" onClick={() => store.setGoal({ target: goalInput ? parseFloat(goalInput) : null })}>
            Set
          </button>
        </div>
      </div>
    </section>
  );
}

function WeightChart({ stats, target, unit, height = 160 }) {
  const W = 340;
  const H = height;
  const pad = { l: 8, r: 8, t: 16, b: 12 };
  const pts = stats.pts.map((p, i) => ({ x: p.x, y: p.y, s: stats.smoothed[i] }));

  const ys = stats.smoothed.concat(pts.map((p) => p.y)).concat(target != null ? [target] : []);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (max - min < 2) {
    min -= 1;
    max += 1;
  }
  const xMin = pts[0].x;
  const xMax = pts[pts.length - 1].x;
  const sx = (x) => pad.l + ((x - xMin) / (xMax - xMin || 1)) * (W - pad.l - pad.r);
  const sy = (y) => pad.t + (1 - (y - min) / (max - min || 1)) * (H - pad.t - pad.b);

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.s).toFixed(1)}`).join(' ');
  const baseY = H - pad.b;
  const area = `${line} L${sx(xMax).toFixed(1)},${baseY} L${sx(xMin).toFixed(1)},${baseY} Z`;
  const last = pts[pts.length - 1];
  const goalY = target != null ? sy(target) : null;

  return (
    <svg className="weight-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weight trend">
      <defs>
        <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {goalY != null && goalY > pad.t && goalY < baseY && (
        <>
          <line x1={pad.l} y1={goalY} x2={W - pad.r} y2={goalY} className="goal-line" />
          <text x={W - pad.r} y={goalY - 4} className="goal-tag" textAnchor="end">
            goal {target}
          </text>
        </>
      )}
      <path d={area} fill="url(#wfill)" />
      {pts.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2" className="dot" />
      ))}
      <path d={line} className="trend" fill="none" />
      <circle cx={sx(last.x)} cy={sy(last.s)} r="4.5" className="last-dot" />
      <text x={sx(last.x)} y={sy(last.s) - 9} className="last-tag" textAnchor="middle">
        {last.s.toFixed(1)} {unit}
      </text>
    </svg>
  );
}

function ProgressRing({ pct, size = 60, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - (pct || 0) / 100);
  return (
    <svg width={size} height={size} className="ring" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="ring-fg"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" className="ring-text" textAnchor="middle" dominantBaseline="central">
        {pct == null ? '—' : `${pct}%`}
      </text>
    </svg>
  );
}

function GoalBar({ start, current, goal, unit }) {
  if (goal == null || start == null || current == null || start <= goal) return null;
  const total = start - goal;
  const done = Math.min(Math.max(start - current, 0), total);
  const pct = Math.round((done / total) * 100);
  const toGo = Math.max(current - goal, 0);
  return (
    <div className="goalbar">
      <div className="goalbar-head">
        <span className="accent">{pct}% to goal</span>
        <span>{toGo.toFixed(1)} {unit} to go</span>
      </div>
      <div className="goalbar-track">
        <div className="goalbar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="goalbar-ends">
        <span>start {start.toFixed(1)}</span>
        <span>goal {goal}</span>
      </div>
    </div>
  );
}

function Heatmap({ habits, days = 14 }) {
  if (!habits.length) return null;
  const cols = lastDays(days);
  return (
    <div className="card">
      <div className="card-label">Consistency · last {days} days</div>
      <div className="hm-head">
        <span className="hm-name" />
        <div className="hm-cells">
          {cols.map((d) => (
            <span key={d} className="hm-dow">
              {DOW[new Date(d + 'T00:00').getDay()]}
            </span>
          ))}
        </div>
      </div>
      <div className="heatmap">
        {habits.map((h) => (
          <div className="hm-row" key={h.id}>
            <div className="hm-name">{h.name}</div>
            <div className="hm-cells">
              {cols.map((d) => (
                <span key={d} className={'hm-cell' + (h.history && h.history[d] ? ' on' : '')} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DotStrip({ habit, days = 7 }) {
  const cols = lastDays(days);
  return (
    <div className="dotstrip">
      {cols.map((d) => (
        <span key={d} className={'sdot' + (habit.history && habit.history[d] ? ' on' : '')} />
      ))}
    </div>
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

  if (!state.habits.length && !stats) return null;

  let verdict;
  if (ratePct != null && ratePct >= 80 && losing) verdict = 'Strong week — habits locked in and trending down.';
  else if (losing) verdict = 'Trending down. Tighten the habits to speed it up.';
  else if (ratePct != null && ratePct >= 80) verdict = 'Habits are solid — keep logging weight to confirm the deficit.';
  else verdict = 'Inconsistent week. Pick one habit to nail every day next week.';

  return (
    <div className="card">
      <div className="card-label">This week</div>
      <div className="checkin-row">
        <div className="checkin-stat">
          <ProgressRing pct={ratePct} />
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
              className="ghost danger"
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
            <button className="btn-primary" onClick={() => name.trim() && onSave({ ...habit, name: name.trim(), time })}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
