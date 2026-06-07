import { useMemo, useState } from 'react';
import { EXERCISE_CATEGORIES } from './store.js';
import { colorForCategory, workoutSetCount, workoutVolume, workoutsToCSV } from './utils.js';

const formatDate = (ds) =>
  new Date(ds + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export default function TrainView({ store }) {
  const { state } = store;
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [viewWorkout, setViewWorkout] = useState(null);

  const exById = useMemo(
    () => Object.fromEntries((state.exercises || []).map((e) => [e.id, e])),
    [state.exercises]
  );
  const history = useMemo(
    () => [...(state.workouts || [])].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [state.workouts]
  );

  const exportCSV = () => {
    const csv = workoutsToCSV(state.workouts, state.exercises);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'momentum-workouts.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (state.activeWorkout) return <ActiveWorkout store={store} exById={exById} />;

  return (
    <section className="view">
      <header className="view-header">
        <h1>Train</h1>
        <button className="link-btn" onClick={exportCSV} disabled={!history.length}>
          Export CSV
        </button>
      </header>

      <button className="btn-primary wide" onClick={() => store.startWorkout('Workout', [])}>
        Start empty workout
      </button>

      <div className="card-label section">Routines</div>
      <div className="routine-list">
        {(state.routines || []).map((r) => (
          <div key={r.id} className="routine-card">
            <button className="routine-main" onClick={() => store.startRoutine(r.id)}>
              <div className="routine-name">{r.name}</div>
              <div className="routine-meta">{r.exerciseIds.length} exercises · tap to start</div>
            </button>
            <button className="routine-edit" onClick={() => setEditingRoutine(r)}>
              Edit
            </button>
          </div>
        ))}
        <button className="btn-outline" onClick={() => setEditingRoutine({ name: '', exerciseIds: [] })}>
          + New routine
        </button>
      </div>

      <div className="card-label section">History</div>
      {history.length === 0 && <div className="chart-hint">No workouts yet. Start one above.</div>}
      <div className="history-list">
        {history.slice(0, 30).map((w) => (
          <button key={w.id} className="hist-row" onClick={() => setViewWorkout(w)}>
            <div className="hist-info">
              <div className="hist-name">{w.name}</div>
              <div className="hist-meta">
                {formatDate(w.date)} · {workoutSetCount(w)} sets · {workoutVolume(w).toLocaleString()} vol
              </div>
            </div>
            <span
              className="repeat-btn"
              onClick={(e) => {
                e.stopPropagation();
                store.repeatWorkout(w.id);
              }}
            >
              Repeat
            </span>
          </button>
        ))}
      </div>

      {editingRoutine && (
        <RoutineEditor
          store={store}
          routine={editingRoutine}
          exById={exById}
          onClose={() => setEditingRoutine(null)}
        />
      )}
      {viewWorkout && (
        <WorkoutDetail store={store} workout={viewWorkout} exById={exById} onClose={() => setViewWorkout(null)} />
      )}
    </section>
  );
}

function ActiveWorkout({ store, exById }) {
  const a = store.state.activeWorkout;
  const unit = store.state.goal?.unit || 'lb';
  const [picker, setPicker] = useState(false);

  return (
    <section className="view active-workout">
      <header className="aw-header">
        <button
          className="ghost"
          onClick={() => {
            if (confirm('Discard this workout?')) store.cancelWorkout();
          }}
        >
          Cancel
        </button>
        <input className="aw-name" value={a.name} onChange={(e) => store.setActiveName(e.target.value)} />
        <button className="btn-primary sm" onClick={() => store.finishWorkout()}>
          Finish
        </button>
      </header>

      {a.entries.length === 0 && <div className="chart-hint">Add an exercise to begin.</div>}

      {a.entries.map((entry, ei) => {
        const ex = exById[entry.id] || { name: 'Exercise', category: '' };
        return (
          <div className="ex-block" key={entry.id + ei}>
            <div className="ex-head">
              <div>
                <div className="ex-name">{ex.name}</div>
                <div className="ex-cat">{ex.category}</div>
              </div>
              <button className="btn-x" onClick={() => store.removeActiveExercise(ei)}>
                ✕
              </button>
            </div>
            <div className="set-grid set-head">
              <span>Set</span>
              <span>{unit}</span>
              <span>Reps</span>
              <span />
              <span />
            </div>
            {entry.sets.map((s, si) => (
              <div className={'set-grid set-row' + (s.done ? ' done' : '')} key={si}>
                <span className="set-n">{si + 1}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={s.weight}
                  onChange={(e) => store.updateSet(ei, si, 'weight', e.target.value)}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={s.reps}
                  onChange={(e) => store.updateSet(ei, si, 'reps', e.target.value)}
                />
                <button className={'check' + (s.done ? ' on' : '')} onClick={() => store.toggleSet(ei, si)} />
                <button className="set-x" onClick={() => store.removeSet(ei, si)}>
                  ✕
                </button>
              </div>
            ))}
            <button className="add-set" onClick={() => store.addSet(ei)}>
              + Add set
            </button>
          </div>
        );
      })}

      <button className="btn-soft" onClick={() => setPicker(true)}>
        + Add exercise
      </button>

      {picker && (
        <ExercisePicker store={store} onClose={() => setPicker(false)} onAdd={(id) => store.addActiveExercise(id)} />
      )}
    </section>
  );
}

function ExercisePicker({ store, onClose, onAdd }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [cat, setCat] = useState('Chest');

  const filtered = (store.state.exercises || []).filter((e) =>
    e.name.toLowerCase().includes(q.toLowerCase())
  );
  const byCat = {};
  filtered.forEach((e) => {
    (byCat[e.category] = byCat[e.category] || []).push(e);
  });

  const create = () => {
    const ex = store.addExercise(name, cat);
    if (ex) {
      onAdd(ex.id);
      onClose();
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card tall" onClick={(e) => e.stopPropagation()}>
        <h2>Add exercise</h2>
        <input className="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="picker-list">
          {Object.keys(byCat)
            .sort()
            .map((c) => (
              <div key={c}>
                <div className="picker-cat">
                  <span className="cat-dot" style={{ background: colorForCategory(c) }} />
                  {c}
                </div>
                {byCat[c].map((e) => (
                  <button
                    key={e.id}
                    className="picker-item"
                    onClick={() => {
                      onAdd(e.id);
                      onClose();
                    }}
                  >
                    {e.name}
                  </button>
                ))}
              </div>
            ))}
          {filtered.length === 0 && <div className="chart-hint">No matches.</div>}
        </div>

        {adding ? (
          <div className="new-ex">
            <input placeholder="New exercise name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              {EXERCISE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button className="btn-primary sm" onClick={create}>
              Add
            </button>
          </div>
        ) : (
          <button className="btn-outline" onClick={() => setAdding(true)}>
            + New exercise
          </button>
        )}

        <div className="modal-actions">
          <span />
          <div>
            <button className="ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoutineEditor({ store, routine, exById, onClose }) {
  const [name, setName] = useState(routine.name || '');
  const [ids, setIds] = useState(routine.exerciseIds || []);
  const [picker, setPicker] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    store.saveRoutine({ ...routine, name: name.trim(), exerciseIds: ids });
    onClose();
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card tall" onClick={(e) => e.stopPropagation()}>
        <h2>{routine.id ? 'Edit routine' : 'New routine'}</h2>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Push Day" autoFocus />
        </label>
        <div className="card-label" style={{ margin: '4px 0 8px' }}>
          Exercises
        </div>
        <div className="routine-ex-list">
          {ids.map((id, i) => (
            <div className="routine-ex" key={id + i}>
              <span>{exById[id]?.name || '?'}</span>
              <button className="btn-x" onClick={() => setIds(ids.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          {ids.length === 0 && <div className="chart-hint">No exercises yet.</div>}
        </div>
        <button className="btn-outline" onClick={() => setPicker(true)}>
          + Add exercise
        </button>

        <div className="modal-actions">
          {routine.id ? (
            <button
              className="ghost danger"
              onClick={() => {
                if (confirm('Delete this routine?')) {
                  store.deleteRoutine(routine.id);
                  onClose();
                }
              }}
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
            <button className="btn-primary" onClick={save}>
              Save
            </button>
          </div>
        </div>

        {picker && (
          <ExercisePicker
            store={store}
            onClose={() => setPicker(false)}
            onAdd={(id) => setIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
          />
        )}
      </div>
    </div>
  );
}

function WorkoutDetail({ store, workout, exById, onClose }) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card tall" onClick={(e) => e.stopPropagation()}>
        <h2>{workout.name}</h2>
        <div className="detail-sub">
          {formatDate(workout.date)} · {workoutSetCount(workout)} sets · {workoutVolume(workout).toLocaleString()} volume
        </div>
        <div className="detail-list">
          {workout.entries.map((e, i) => (
            <div key={i} className="detail-ex">
              <div className="ex-name">{exById[e.id]?.name || 'Exercise'}</div>
              <div className="detail-sets">
                {e.sets.map((s, j) => (
                  <span key={j} className="set-chip">
                    {s.weight || 0}×{s.reps || 0}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button
            className="ghost danger"
            onClick={() => {
              if (confirm('Delete this workout?')) {
                store.deleteWorkout(workout.id);
                onClose();
              }
            }}
          >
            Delete
          </button>
          <div>
            <button className="ghost" onClick={onClose}>
              Close
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                store.repeatWorkout(workout.id);
                onClose();
              }}
            >
              Repeat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
