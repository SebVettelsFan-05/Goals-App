import { useEffect, useMemo, useState } from 'react';
import { useMomentum, requestNotifications } from './store.js';
import { fmt, nowMinutes, streakOf, toMin, todayStr } from './utils.js';

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
                    <span className={'streak' + (s >= 3 ? ' hot' : '')}>{s > 0 ? `🔥 ${s}` : 'start'}</span>
                  </div>
                );
              })}
            </div>
            <button className="add-habit-btn" onClick={() => setEditing({})}>
              + New habit
            </button>
          </section>
        )}
      </main>

      <form className="quick-add" onSubmit={submit} autoComplete="off">
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
          <span>◎</span>Now
        </button>
        <button className={'tab' + (tab === 'today' ? ' active' : '')} onClick={() => setTab('today')}>
          <span>▤</span>Today
        </button>
        <button className={'tab' + (tab === 'habits' ? ' active' : '')} onClick={() => setTab('habits')}>
          <span>✓</span>Habits
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
              const r = await requestNotifications();
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
