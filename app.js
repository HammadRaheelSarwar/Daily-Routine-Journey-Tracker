(function(){
  'use strict';

  const STORAGE_KEY = 'drjt_store_v1';

  /** State management **/
  function defaultState() {
    return {
      journeys: [], // {id, date, mode, from, to, distanceKm, timeMin, notes, createdAt}
      routines: [
        { id: uid(), title: 'Morning exercise', completedOn: {} },
        { id: uid(), title: 'Work / Study', completedOn: {} },
        { id: uid(), title: 'Evening walk', completedOn: {} },
      ],
      settings: {}
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        journeys: Array.isArray(parsed.journeys) ? parsed.journeys : [],
        routines: Array.isArray(parsed.routines) ? parsed.routines : defaultState().routines,
        settings: parsed.settings || {}
      };
    } catch (e) {
      console.warn('Failed to load state, resetting.', e);
      return defaultState();
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { alert('Could not save data to your browser.'); }
  }

  let state = loadState();

  /** Utilities **/
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function todayISO() { return new Date().toISOString().slice(0,10); }
  function toISODate(d) { return new Date(d).toISOString().slice(0,10); }
  function fmt(n) { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 }); }

  function inRange(dateISO, fromISO, toISO) {
    if (fromISO && dateISO < fromISO) return false;
    if (toISO && dateISO > toISO) return false;
    return true;
  }

  /** DOM refs **/
  const navBtns = document.querySelectorAll('.nav__btn');
  const views = document.querySelectorAll('.view');

  // Dashboard
  const statJourneysToday = document.getElementById('stat-journeys-today');
  const statDistanceToday = document.getElementById('stat-distance-today');
  const statTimeToday = document.getElementById('stat-time-today');
  const todayRoutineEl = document.getElementById('today-routine');
  const recentJourneysEl = document.getElementById('recent-journeys');

  // Journey form
  const journeyForm = document.getElementById('journey-form');
  const journeyDate = document.getElementById('journey-date');
  const journeyMode = document.getElementById('journey-mode');
  const journeyFrom = document.getElementById('journey-from');
  const journeyTo = document.getElementById('journey-to');
  const journeyDistance = document.getElementById('journey-distance');
  const journeyTime = document.getElementById('journey-time');
  const journeyNotes = document.getElementById('journey-notes');

  // Routine
  const routineForm = document.getElementById('routine-form');
  const routineTitle = document.getElementById('routine-title');
  const routineList = document.getElementById('routine-list');

  // History
  const filterFrom = document.getElementById('filter-from');
  const filterTo = document.getElementById('filter-to');
  const filterMode = document.getElementById('filter-mode');
  const historyRows = document.getElementById('history-rows');

  // Settings
  const exportBtn = document.getElementById('export-btn');
  const importInput = document.getElementById('import-input');
  const resetBtn = document.getElementById('reset-btn');

  /** Navigation **/
  navBtns.forEach(btn => btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');
    navBtns.forEach(b => b.classList.toggle('is-active', b === btn));
    views.forEach(v => v.classList.toggle('is-active', v.id === target));
    if (target === 'dashboard') renderDashboard();
    if (target === 'history') renderHistory();
    if (target === 'routine') renderRoutine();
  }));

  /** Initial values **/
  journeyDate.value = todayISO();

  /** Journey form logic **/
  journeyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const j = {
      id: uid(),
      date: journeyDate.value || todayISO(),
      mode: journeyMode.value.trim() || 'Other',
      from: journeyFrom.value.trim(),
      to: journeyTo.value.trim(),
      distanceKm: Number(journeyDistance.value || 0),
      timeMin: Number(journeyTime.value || 0),
      notes: journeyNotes.value.trim(),
      createdAt: Date.now(),
    };
    if (!j.from || !j.to) return alert('Please enter From and To.');

    state.journeys.push(j);
    // sort newest first by date then createdAt
    state.journeys.sort((a,b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    saveState();
    journeyForm.reset();
    journeyDate.value = todayISO();
    renderDashboard();
    if (document.getElementById('history').classList.contains('is-active')) renderHistory();
    alert('Journey saved!');
  });

  /** Routine logic **/
  routineForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = routineTitle.value.trim();
    if (!title) return;
    state.routines.push({ id: uid(), title, completedOn: {} });
    saveState();
    routineTitle.value = '';
    renderRoutine();
    renderDashboard();
  });

  function toggleRoutineForDay(id, dateISO, done) {
    const r = state.routines.find(x => x.id === id);
    if (!r) return;
    if (!r.completedOn) r.completedOn = {};
    if (done) r.completedOn[dateISO] = true; else delete r.completedOn[dateISO];
    saveState();
    renderDashboard();
  }

  function removeRoutine(id) {
    state.routines = state.routines.filter(r => r.id !== id);
    saveState();
    renderRoutine();
    renderDashboard();
  }

  function renameRoutine(id, newTitle) {
    const r = state.routines.find(x => x.id === id);
    if (!r) return;
    r.title = newTitle;
    saveState();
    renderRoutine();
    renderDashboard();
  }

  /** History & filters **/
  [filterFrom, filterTo, filterMode].forEach(el => el && el.addEventListener('change', renderHistory));

  function filteredJourneys() {
    const f = filterFrom.value || '';
    const t = filterTo.value || '';
    const m = filterMode.value || '';
    return state.journeys.filter(j => inRange(j.date, f, t) && (!m || j.mode === m));
  }

  function deleteJourney(id) {
    state.journeys = state.journeys.filter(j => j.id !== id);
    saveState();
    renderDashboard();
    renderHistory();
  }

  /** Export / Import / Reset **/
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drjt-export-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object') throw new Error('Invalid file');
      if (!Array.isArray(data.journeys) || !Array.isArray(data.routines)) throw new Error('Missing fields');
      state = {
        journeys: data.journeys,
        routines: data.routines,
        settings: data.settings || {}
      };
      saveState();
      renderAll();
      alert('Data imported successfully.');
    } catch (e) {
      alert('Failed to import file. Make sure it is a valid export.');
    } finally {
      importInput.value = '';
    }
  });

  resetBtn.addEventListener('click', () => {
    const ok = confirm('This will permanently delete all data stored in your browser for this app. Continue?');
    if (!ok) return;
    state = defaultState();
    saveState();
    renderAll();
  });

  /** Rendering **/
  function renderDashboard() {
    const today = todayISO();
    const todays = state.journeys.filter(j => j.date === today);
    const totalDistance = todays.reduce((a,b) => a + (Number(b.distanceKm)||0), 0);
    const totalTime = todays.reduce((a,b) => a + (Number(b.timeMin)||0), 0);

    statJourneysToday.textContent = fmt(todays.length);
    statDistanceToday.textContent = fmt(totalDistance);
    statTimeToday.textContent = fmt(totalTime);

    // Today's routine list
    todayRoutineEl.innerHTML = '';
    state.routines.forEach(r => {
      const li = document.createElement('li');
      const left = document.createElement('div');
      left.className = 'left';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!(r.completedOn && r.completedOn[today]);
      cb.addEventListener('change', () => toggleRoutineForDay(r.id, today, cb.checked));
      const span = document.createElement('span');
      span.textContent = r.title;
      left.appendChild(cb);
      left.appendChild(span);
      li.appendChild(left);
      todayRoutineEl.appendChild(li);
    });

    // Recent journeys (latest 5)
    recentJourneysEl.innerHTML = '';
    state.journeys.slice(0, 5).forEach(j => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${j.date}</td>
        <td>${esc(j.from)}</td>
        <td>${esc(j.to)}</td>
        <td>${esc(j.mode)}</td>
        <td>${fmt(j.distanceKm)}</td>
        <td>${fmt(j.timeMin)}</td>
      `;
      recentJourneysEl.appendChild(tr);
    });
  }

  function renderRoutine() {
    routineList.innerHTML = '';
    state.routines.forEach(r => {
      const li = document.createElement('li');
      const left = document.createElement('div');
      left.className = 'left';

      const title = document.createElement('input');
      title.type = 'text';
      title.value = r.title;
      title.addEventListener('change', () => {
        const newTitle = title.value.trim();
        if (!newTitle) { title.value = r.title; return; }
        renameRoutine(r.id, newTitle);
      });

      left.appendChild(title);

      const actions = document.createElement('div');
      const del = document.createElement('button');
      del.className = 'btn danger';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        const ok = confirm(`Delete routine "${r.title}"?`);
        if (ok) removeRoutine(r.id);
      });

      actions.appendChild(del);

      li.appendChild(left);
      li.appendChild(actions);
      routineList.appendChild(li);
    });
  }

  function renderHistory() {
    const data = filteredJourneys();
    historyRows.innerHTML = '';
    data.forEach(j => {
      const tr = document.createElement('tr');
      const tdActions = document.createElement('td');
      const del = document.createElement('button');
      del.className = 'btn danger';
      del.textContent = 'Delete';
      del.addEventListener('click', () => deleteJourney(j.id));
      tdActions.appendChild(del);

      tr.innerHTML = `
        <td>${j.date}</td>
        <td>${esc(j.from)}</td>
        <td>${esc(j.to)}</td>
        <td>${esc(j.mode)}</td>
        <td>${fmt(j.distanceKm)}</td>
        <td>${fmt(j.timeMin)}</td>
      `;
      tr.appendChild(tdActions);
      historyRows.appendChild(tr);
    });
  }

  function renderAll() {
    renderDashboard();
    renderRoutine();
    renderHistory();
  }

  function esc(s) { return String(s ?? '').replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

  // Initial render
  renderAll();
})();
