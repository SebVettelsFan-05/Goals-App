import { useEffect, useMemo, useState } from 'react';
import { useMomentum } from './store.js';
import { useInstall } from './install.js';
import TrainView from './Train.jsx';
import { addDays, colorForCategory, fmt, gymStats, nowMinutes, streakOf, stepsStats, toMin, todayStr, weightStats, weeklyHabitStats } from './utils.js';

const fmtN = (n) => (n == null ? '—' : Math.round(n).toLocaleString());

const lastDays = (n) => Array.from({ length: n }, (_, i) => addDays(todayStr(), -(n - 1 - i)));
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const greeting = (h) => (h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

export default function App() {
  const store = useMomentum();
  const [tab, setTab] = useState('home');
  const [bodySub, setBodySub] = useState('weight'); // 'weight' | 'steps'
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState(null); // habit object, {} for new, or null
  const [searchOpen, setSearchOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const openBody = (sub) => {
    setBodySub(sub);
    setTab('body');
  };
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
              <div>
                <div className="hero-greet">{greeting(now.getHours())}</div>
                <div className="hero-date">{dateLabel}</div>
              </div>
              <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
                <SearchIcon />
              </button>
            </header>

            <InstallCard />

            <FocusCard current={current} next={next} count={todaysEvents.length} store={store} />

            <Insights store={store} onOpen={() => setInsightsOpen(true)} />

            <WeightCard store={store} onOpen={() => openBody('weight')} />

            <StepsCard store={store} onOpen={() => openBody('steps')} />

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

        {tab === 'train' && <TrainView store={store} />}

        {tab === 'body' && <BodyView store={store} sub={bodySub} setSub={setBodySub} />}
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
          ['train', 'Train'],
          ['body', 'Body'],
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

      {searchOpen && (
        <SearchOverlay
          store={store}
          onClose={() => setSearchOpen(false)}
          go={(t) => {
            setTab(t);
            setSearchOpen(false);
          }}
        />
      )}

      {insightsOpen && <InsightsView store={store} onClose={() => setInsightsOpen(false)} />}

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

/* ---------------- Body tab (weight + steps) ---------------- */

function BodyView({ store, sub, setSub }) {
  return (
    <section className="view">
      <div className="segmented">
        <button className={sub === 'weight' ? 'active' : ''} onClick={() => setSub('weight')}>
          Weight
        </button>
        <button className={sub === 'steps' ? 'active' : ''} onClick={() => setSub('steps')}>
          Steps
        </button>
      </div>
      {sub === 'weight' ? <WeightView store={store} /> : <StepsView store={store} />}
    </section>
  );
}

const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Shared computation for both the Home summary and the full Insights view.
function useInsights(store) {
  const { state } = store;
  const unit = state.goal?.unit || 'lb';
  const target = state.goal?.target ?? null;
  const w = useMemo(() => weightStats(state.weights, target), [state.weights, target]);
  const st = useMemo(() => stepsStats(state.steps, state.stepGoal || 10000), [state.steps, state.stepGoal]);
  const hab = useMemo(() => weeklyHabitStats(state.habits), [state.habits]);
  const gym = useMemo(() => gymStats(state.workouts, state.exercises), [state.workouts, state.exercises]);

  const losing = w && w.ratePerWeek < -0.01;
  const tiles = [
    { key: 'train', value: gym.count7, label: 'workouts/wk' },
    { key: 'weight', value: w ? `${w.ratePerWeek > 0 ? '+' : ''}${w.ratePerWeek.toFixed(1)}` : '—', label: `${unit}/wk`, good: losing },
    { key: 'steps', value: st ? `${(st.weekAvg / 1000).toFixed(1)}k` : '—', label: 'steps/day' },
    { key: 'habits', value: hab.rate == null ? '—' : `${Math.round(hab.rate * 100)}%`, label: 'habits' },
  ];

  const lines = [];
  if (gym.count7) lines.push(`Trained ${gym.count7}× in the last 7 days${gym.topCategory ? ` · most volume on ${gym.topCategory}` : ''}.`);
  else lines.push('No workouts logged in the last 7 days — time to train.');
  if (w && Math.abs(w.ratePerWeek) >= 0.05) lines.push(`Weight ${w.ratePerWeek < 0 ? 'down' : 'up'} ${Math.abs(w.ratePerWeek).toFixed(1)} ${unit}/wk.`);
  if (st) lines.push(`Averaging ${st.weekAvg.toLocaleString()} steps/day (${st.daysHitWeek}/7 days at goal).`);
  if (hab.rate != null) lines.push(`Habits ${Math.round(hab.rate * 100)}% this week${hab.bestStreak ? ` · best streak ${hab.bestStreak}d` : ''}.`);
  if (gym.topDay != null && gym.count30 >= 3) lines.push(`You train most on ${DOWS[gym.topDay]}s.`);

  return { tiles, lines, gym };
}

function MetricTiles({ tiles }) {
  return (
    <div className="metric-tiles">
      {tiles.map((t) => (
        <div className={`metric-tile m-${t.key}`} key={t.key}>
          <div className={'metric-value' + (t.good ? ' good' : '')}>{t.value}</div>
          <div className="metric-label">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

function Insights({ store, onOpen }) {
  const { tiles, lines } = useInsights(store);
  return (
    <button className="card insights-card" onClick={onOpen}>
      <div className="card-head">
        <div className="card-label">The whole picture</div>
        <span className="link-btn">Details ›</span>
      </div>
      <MetricTiles tiles={tiles} />
      {lines[0] && <div className="insight-lead">{lines[0]}</div>}
    </button>
  );
}

function InsightsView({ store, onClose }) {
  const { tiles, lines, gym } = useInsights(store);
  const cats = Object.entries(gym.catSets || {}).sort((a, b) => b[1] - a[1]);
  const maxSets = cats.length ? cats[0][1] : 0;
  const maxDay = Math.max(1, ...gym.byDay);

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card tall" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Insights</h2>
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <MetricTiles tiles={tiles} />

        <div className="card-label section">Training by muscle · 30 days</div>
        {cats.length === 0 ? (
          <div className="chart-hint">No workouts logged yet.</div>
        ) : (
          <div className="cat-bars">
            {cats.map(([cat, n]) => (
              <div className="cat-row" key={cat}>
                <span className="cat-name">
                  <span className="cat-dot" style={{ background: colorForCategory(cat) }} />
                  {cat}
                </span>
                <div className="cat-track">
                  <div
                    className="cat-fill"
                    style={{ width: `${(n / maxSets) * 100}%`, background: colorForCategory(cat) }}
                  />
                </div>
                <span className="cat-n">{n}</span>
              </div>
            ))}
          </div>
        )}

        <div className="card-label section">Workouts by day · 30 days</div>
        <div className="dow-row">
          {gym.byDay.map((n, i) => (
            <div className="dow-col" key={i}>
              <div className="dow-bar-wrap">
                <div className="dow-bar" style={{ height: `${(n / maxDay) * 100}%` }} />
              </div>
              <div className="dow-label">{DOWS[i][0]}</div>
            </div>
          ))}
        </div>

        <div className="card-label section">Notes</div>
        <ul className="insights">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

function SearchOverlay({ store, onClose, go }) {
  const { state } = store;
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const exMatches = query ? state.exercises.filter((e) => e.name.toLowerCase().includes(query)).slice(0, 8) : [];
  const woMatches = query
    ? [...state.workouts].filter((w) => (w.name || '').toLowerCase().includes(query)).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)
    : [];
  const habMatches = query ? state.habits.filter((h) => h.name.toLowerCase().includes(query)) : [];
  const evMatches = query ? state.events.filter((e) => e.title.toLowerCase().includes(query)).slice(0, 6) : [];
  const empty = query && !exMatches.length && !woMatches.length && !habMatches.length && !evMatches.length;

  const startWith = (exId) => {
    if (state.activeWorkout) store.addActiveExercise(exId);
    else store.startWorkout('Workout', [exId]);
    go('train');
  };

  return (
    <div className="search-overlay">
      <div className="search-bar">
        <SearchIcon />
        <input
          autoFocus
          placeholder="Search exercises, workouts, habits…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="ghost" onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className="search-results">
        {!query && <div className="chart-hint">Find an exercise, a past workout, a habit, or a plan.</div>}
        {empty && <div className="chart-hint">No matches for “{q}”.</div>}

        {exMatches.length > 0 && (
          <div className="search-group">
            <div className="picker-cat">Exercises</div>
            {exMatches.map((e) => (
              <button key={e.id} className="search-item" onClick={() => startWith(e.id)}>
                <span>{e.name}</span>
                <span className="search-meta">{e.category} · start</span>
              </button>
            ))}
          </div>
        )}

        {woMatches.length > 0 && (
          <div className="search-group">
            <div className="picker-cat">Workouts</div>
            {woMatches.map((w) => (
              <button key={w.id} className="search-item" onClick={() => go('train')}>
                <span>{w.name}</span>
                <span className="search-meta">{w.date}</span>
              </button>
            ))}
          </div>
        )}

        {habMatches.length > 0 && (
          <div className="search-group">
            <div className="picker-cat">Habits</div>
            {habMatches.map((h) => (
              <button key={h.id} className="search-item" onClick={() => go('habits')}>
                <span>{h.name}</span>
                <span className="search-meta">habit</span>
              </button>
            ))}
          </div>
        )}

        {evMatches.length > 0 && (
          <div className="search-group">
            <div className="picker-cat">Plans</div>
            {evMatches.map((e) => (
              <button key={e.id} className="search-item" onClick={() => go('today')}>
                <span>{e.title}</span>
                <span className="search-meta">{e.time ? fmt(e.time) : 'today'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
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

const kfmt = (n) => (n % 1000 === 0 ? `${n / 1000}k` : `${(n / 1000).toFixed(1)}k`);

function StepsChart({ data, goal, height = 160 }) {
  const W = 340;
  const H = height;
  const pad = { l: 6, r: 6, t: 16, b: 14 };
  const vals = data.map((d) => d.value);
  const top = Math.max(goal, ...vals, 1) * 1.15;
  const innerW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;
  const baseY = H - pad.b;
  const slot = innerW / data.length;
  const bw = Math.min(slot * 0.6, 16);
  const goalY = baseY - (goal / top) * chartH;

  return (
    <svg className="steps-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily steps">
      <line x1={pad.l} y1={goalY} x2={W - pad.r} y2={goalY} className="goal-line" />
      <text x={pad.l} y={goalY - 4} className="goal-tag" textAnchor="start">
        goal {kfmt(goal)}
      </text>
      {data.map((d, i) => {
        const h = (d.value / top) * chartH;
        const x = pad.l + slot * i + (slot - bw) / 2;
        return (
          <rect
            key={d.date}
            x={x}
            y={baseY - h}
            width={bw}
            height={Math.max(h, 0)}
            rx="3"
            className={'bar' + (d.value >= goal ? ' hit' : '')}
          />
        );
      })}
    </svg>
  );
}

function StepsCard({ store, onOpen }) {
  const { state } = store;
  const goal = state.stepGoal || 10000;
  const [entry, setEntry] = useState('');
  const stats = useMemo(() => stepsStats(state.steps, goal), [state.steps, goal]);
  const todayVal = (state.steps || []).find((s) => s.date === todayStr())?.value;
  const hitToday = todayVal != null && todayVal >= goal;

  const submit = (e) => {
    e.preventDefault();
    if (entry.trim()) {
      store.logSteps(entry);
      setEntry('');
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-label">Steps</div>
        <button className="link-btn" onClick={onOpen}>
          Details
        </button>
      </div>

      <div className="weight-hero">
        <div className="weight-now">
          {fmtN(stats?.todayVal ?? null)}
          <span className="unit">today</span>
        </div>
        {stats && <div className={'rate-pill' + (hitToday ? ' good' : '')}>{stats.daysHitWeek}/7 days hit</div>}
      </div>

      {stats ? (
        <StepsChart data={stats.last14} goal={goal} />
      ) : (
        <div className="chart-hint">Log your steps to see your daily bars.</div>
      )}

      <form className="weight-entry" onSubmit={submit}>
        <input
          type="number"
          inputMode="numeric"
          step="100"
          placeholder={todayVal != null ? `Logged ${todayVal.toLocaleString()} — update?` : 'Log today’s steps'}
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

function StepsView({ store }) {
  const { state } = store;
  const goal = state.stepGoal || 10000;
  const [entry, setEntry] = useState('');
  const [goalInput, setGoalInput] = useState(String(goal));
  const stats = useMemo(() => stepsStats(state.steps, goal), [state.steps, goal]);
  const todayVal = (state.steps || []).find((s) => s.date === todayStr())?.value;
  const hitToday = todayVal != null && todayVal >= goal;

  const submit = (e) => {
    e.preventDefault();
    if (entry.trim()) {
      store.logSteps(entry);
      setEntry('');
    }
  };

  let verdict = null;
  if (stats) {
    if (stats.daysHitWeek >= 5) verdict = 'Great movement — consistency is paying off.';
    else if (stats.daysHitWeek >= 2) verdict = 'Solid. Nudge a couple more days over the line.';
    else verdict = 'Get a daily walk in — even 10 minutes adds up.';
  }

  return (
    <section className="view">
      <header className="view-header">
        <h1>Steps</h1>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <div className={'stat-num' + (hitToday ? ' good' : '')}>{fmtN(stats?.todayVal ?? null)}</div>
          <div className="stat-label">Today</div>
        </div>
        <div className="stat">
          <div className="stat-num">{fmtN(stats?.weekAvg ?? null)}</div>
          <div className="stat-label">7-day avg</div>
        </div>
        <div className="stat">
          <div className="stat-num">{fmtN(goal)}</div>
          <div className="stat-label">Goal</div>
        </div>
      </div>

      {stats ? (
        <StepsChart data={stats.last14} goal={goal} height={190} />
      ) : (
        <div className="chart-hint">Log a few days to see your daily bars.</div>
      )}

      {stats && (
        <div className="projection">
          Hit your goal <b>{stats.daysHitWeek}/7</b> days this week
          {stats.streak > 0 ? (
            <>
              {' '}· <b>{stats.streak}-day</b> streak
            </>
          ) : null}
          . {verdict}
        </div>
      )}

      <form className="weight-entry" onSubmit={submit}>
        <input
          type="number"
          inputMode="numeric"
          step="100"
          placeholder={todayVal != null ? `Logged ${todayVal.toLocaleString()} — update?` : 'Today’s steps'}
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
        />
        <button type="submit" className="btn-primary">
          {todayVal != null ? 'Update' : 'Log'}
        </button>
      </form>

      <div className="goal-row">
        <label>Daily step goal</label>
        <div>
          <input
            type="number"
            inputMode="numeric"
            step="500"
            placeholder="e.g. 10000"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
          />
          <button className="btn-soft inline" onClick={() => store.setStepGoal(goalInput)}>
            Set
          </button>
        </div>
      </div>
    </section>
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
