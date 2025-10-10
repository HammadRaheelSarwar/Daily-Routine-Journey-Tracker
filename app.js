(function(){
  'use strict';

  const STORAGE_KEY = 'journeytrack_store_v2';
  const CO2_EMISSIONS = {
    'Walk': 0,
    'Cycle': 0,
    'Bus': 0.1,
    'Train': 0.05,
    'Car': 0.2,
    'Other': 0.15
  };

  /** State management **/
  function defaultState() {
    return {
      journeys: [], // {id, date, mode, from, to, distanceKm, timeMin, notes, createdAt}
      routines: [
        { id: uid(), title: 'Morning exercise', completedOn: {} },
        { id: uid(), title: 'Work / Study', completedOn: {} },
        { id: uid(), title: 'Evening walk', completedOn: {} },
      ],
      settings: {
        theme: 'dark',
        units: 'metric',
        notifications: true
      }
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
        settings: { ...defaultState().settings, ...parsed.settings }
      };
    } catch (e) {
      console.warn('Failed to load state, resetting.', e);
      return defaultState();
    }
  }

  function saveState() {
    try { 
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); 
      applyTheme(state.settings.theme);
    }
    catch (e) { 
      showToast('Error', 'Could not save data to your browser.', 'error');
    }
  }

  let state = loadState();

  /** Utilities **/
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function todayISO() { return new Date().toISOString().slice(0,10); }
  function toISODate(d) { return new Date(d).toISOString().slice(0,10); }
  function fmt(n) { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 }); }
  function esc(s) { return String(s ?? '').replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

  function inRange(dateISO, fromISO, toISO) {
    if (fromISO && dateISO < fromISO) return false;
    if (toISO && dateISO > toISO) return false;
    return true;
  }

  function calculateCO2(journeys) {
    return journeys.reduce((total, journey) => {
      const emission = CO2_EMISSIONS[journey.mode] || 0.1;
      return total + (journey.distanceKm * emission);
    }, 0);
  }

  function showToast(title, message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
      </div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.querySelector('#theme-toggle i');
    if (themeIcon) {
      themeIcon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
    }
    const themeSwitch = document.getElementById('theme-switch');
    if (themeSwitch) {
      themeSwitch.checked = theme === 'dark';
    }
  }

  /** DOM refs **/
  const navBtns = document.querySelectorAll('.nav__btn');
  const views = document.querySelectorAll('.view');
  const loadingScreen = document.getElementById('loading-screen');
  const app = document.getElementById('app');

  // Dashboard
  const statJourneysToday = document.getElementById('stat-journeys-today');
  const statDistanceToday = document.getElementById('stat-distance-today');
  const statTimeToday = document.getElementById('stat-time-today');
  const statCO2Saved = document.getElementById('stat-co2-saved');
  const todayRoutineEl = document.getElementById('today-routine');
  const recentJourneysEl = document.getElementById('recent-journeys');
  const routineCompletion = document.getElementById('routine-completion');

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
  const totalRoutines = document.getElementById('total-routines');
  const completedToday = document.getElementById('completed-today');
  const completionRate = document.getElementById('completion-rate');

  // History
  const filterFrom = document.getElementById('filter-from');
  const filterTo = document.getElementById('filter-to');
  const filterMode = document.getElementById('filter-mode');
  const clearFilters = document.getElementById('clear-filters');
  const historyRows = document.getElementById('history-rows');

  // Settings
  const exportBtn = document.getElementById('export-btn');
  const importInput = document.getElementById('import-input');
  const resetBtn = document.getElementById('reset-btn');
  const themeToggle = document.getElementById('theme-toggle');
  const themeSwitch = document.getElementById('theme-switch');
  const notificationsSwitch = document.getElementById('notifications-switch');

  /** Initialization **/
  function init() {
    // Hide loading screen after a short delay
    setTimeout(() => {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
        app.style.display = 'block';
      }, 500);
    }, 1000);

    // Apply saved theme
    applyTheme(state.settings.theme);
    
    // Set initial form values
    journeyDate.value = todayISO();
    
    // Set settings controls
    if (themeSwitch) {
      themeSwitch.checked = state.settings.theme === 'dark';
    }
    
    if (notificationsSwitch) {
      notificationsSwitch.checked = state.settings.notifications;
    }
    
    // Initial render
    renderAll();
  }

  /** Navigation **/
  navBtns.forEach(btn => btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');
    navBtns.forEach(b => b.classList.toggle('is-active', b === btn));
    views.forEach(v => v.classList.toggle('is-active', v.id === target));
    if (target === 'dashboard') renderDashboard();
    if (target === 'history') renderHistory();
    if (target === 'routine') renderRoutine();
  }));

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
    if (!j.from || !j.to) {
      showToast('Missing Information', 'Please enter From and To locations.', 'warning');
      return;
    }

    state.journeys.push(j);
    // sort newest first by date then createdAt
    state.journeys.sort((a,b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    saveState();
    journeyForm.reset();
    journeyDate.value = todayISO();
    renderDashboard();
    if (document.getElementById('history').classList.contains('is-active')) renderHistory();
    showToast('Journey Saved', 'Your journey has been successfully logged.', 'success');
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
    showToast('Routine Added', 'New routine item has been added.', 'success');
  });

  function toggleRoutineForDay(id, dateISO, done) {
    const r = state.routines.find(x => x.id === id);
    if (!r) return;
    if (!r.completedOn) r.completedOn = {};
    if (done) r.completedOn[dateISO] = true; else delete r.completedOn[dateISO];
    saveState();
    renderDashboard();
    renderRoutine();
  }

  function removeRoutine(id) {
    const routine = state.routines.find(r => r.id === id);
    if (!routine) return;
    
    state.routines = state.routines.filter(r => r.id !== id);
    saveState();
    renderRoutine();
    renderDashboard();
    showToast('Routine Removed', `"${routine.title}" has been removed.`, 'info');
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
  
  clearFilters.addEventListener('click', () => {
    filterFrom.value = '';
    filterTo.value = '';
    filterMode.value = '';
    renderHistory();
  });

  function filteredJourneys() {
    const f = filterFrom.value || '';
    const t = filterTo.value || '';
    const m = filterMode.value || '';
    return state.journeys.filter(j => inRange(j.date, f, t) && (!m || j.mode === m));
  }

  function deleteJourney(id) {
    const journey = state.journeys.find(j => j.id === id);
    if (!journey) return;
    
    state.journeys = state.journeys.filter(j => j.id !== id);
    saveState();
    renderDashboard();
    renderHistory();
    showToast('Journey Deleted', 'The journey has been removed from your history.', 'info');
  }

  /** Settings **/
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journeytrack-export-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Data Exported', 'Your data has been downloaded successfully.', 'success');
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object') throw new Error('Invalid file');
      if (!Array.isArray(data.journeys) || !Array.isArray(data.routines)) throw new Error('Missing required fields');
      
      const confirmed = confirm('This will replace all your current data. Are you sure you want to continue?');
      if (!confirmed) {
        importInput.value = '';
        return;
      }
      
      state = {
        journeys: data.journeys,
        routines: data.routines,
        settings: { ...defaultState().settings, ...data.settings }
      };
      saveState();
      renderAll();
      showToast('Data Imported', 'Your data has been successfully imported.', 'success');
    } catch (e) {
      showToast('Import Failed', 'The file is not a valid JourneyTrack export.', 'error');
    } finally {
      importInput.value = '';
    }
  });

  resetBtn.addEventListener('click', () => {
    const ok = confirm('This will permanently delete all your journey and routine data. This action cannot be undone. Continue?');
    if (!ok) return;
    state = defaultState();
    saveState();
    renderAll();
    showToast('Data Reset', 'All data has been reset to default values.', 'info');
  });

  themeToggle.addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    saveState();
  });

  if (themeSwitch) {
    themeSwitch.addEventListener('change', () => {
      state.settings.theme = themeSwitch.checked ? 'dark' : 'light';
      saveState();
    });
  }

  if (notificationsSwitch) {
    notificationsSwitch.addEventListener('change', () => {
      state.settings.notifications = notificationsSwitch.checked;
      saveState();
      showToast(
        'Notifications ' + (notificationsSwitch.checked ? 'Enabled' : 'Disabled'),
        'Your notification preferences have been updated.',
        'info'
      );
    });
  }

  /** Rendering **/
  function renderDashboard() {
    const today = todayISO();
    const todaysJourneys = state.journeys.filter(j => j.date === today);
    const totalDistance = todaysJourneys.reduce((a,b) => a + (Number(b.distanceKm)||0), 0);
    const totalTime = todaysJourneys.reduce((a,b) => a + (Number(b.timeMin)||0), 0);
    const co2Saved = calculateCO2(todaysJourneys.filter(j => j.mode !== 'Car'));

    statJourneysToday.textContent = fmt(todaysJourneys.length);
    statDistanceToday.textContent = fmt(totalDistance);
    statTimeToday.textContent = fmt(totalTime);
    statCO2Saved.textContent = fmt(co2Saved);

    // Today's routine list
    todayRoutineEl.innerHTML = '';
    let completedCount = 0;
    
    state.routines.forEach(r => {
      const isCompleted = !!(r.completedOn && r.completedOn[today]);
      if (isCompleted) completedCount++;
      
      const li = document.createElement('li');
      li.className = 'routine-item';
      
      const checkbox = document.createElement('div');
      checkbox.className = `routine-checkbox ${isCompleted ? 'checked' : ''}`;
      if (isCompleted) {
        checkbox.innerHTML = '<i class="fas fa-check"></i>';
      }
      checkbox.addEventListener('click', () => toggleRoutineForDay(r.id, today, !isCompleted));
      
      const text = document.createElement('div');
      text.className = `routine-text ${isCompleted ? 'completed' : ''}`;
      text.textContent = r.title;
      
      li.appendChild(checkbox);
      li.appendChild(text);
      todayRoutineEl.appendChild(li);
    });
    
    // Calculate completion percentage
    const completionPercentage = state.routines.length > 0 
      ? Math.round((completedCount / state.routines.length) * 100) 
      : 0;
    routineCompletion.textContent = `${completionPercentage}%`;

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
    const today = todayISO();
    let completedCount = 0;
    
    state.routines.forEach(r => {
      const isCompleted = !!(r.completedOn && r.completedOn[today]);
      if (isCompleted) completedCount++;
      
      const li = document.createElement('li');
      
      const content = document.createElement('div');
      content.className = 'routine-item-content';
      
      const checkbox = document.createElement('div');
      checkbox.className = `routine-checkbox ${isCompleted ? 'checked' : ''}`;
      if (isCompleted) {
        checkbox.innerHTML = '<i class="fas fa-check"></i>';
      }
      checkbox.addEventListener('click', () => toggleRoutineForDay(r.id, today, !isCompleted));
      
      const title = document.createElement('input');
      title.type = 'text';
      title.value = r.title;
      title.addEventListener('change', () => {
        const newTitle = title.value.trim();
        if (!newTitle) { 
          title.value = r.title; 
          return; 
        }
        renameRoutine(r.id, newTitle);
      });
      title.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') title.blur();
      });
      
      content.appendChild(checkbox);
      content.appendChild(title);
      
      const actions = document.createElement('div');
      actions.className = 'routine-item-actions';
      
      const del = document.createElement('button');
      del.className = 'btn btn-danger';
      del.innerHTML = '<i class="fas fa-trash"></i>';
      del.addEventListener('click', () => {
        const ok = confirm(`Delete routine "${r.title}"?`);
        if (ok) removeRoutine(r.id);
      });
      
      actions.appendChild(del);
      
      li.appendChild(content);
      li.appendChild(actions);
      routineList.appendChild(li);
    });
    
    // Update routine stats
    totalRoutines.textContent = state.routines.length;
    completedToday.textContent = completedCount;
    completionRate.textContent = state.routines.length > 0 
      ? `${Math.round((completedCount / state.routines.length) * 100)}%` 
      : '0%';
  }

  function renderHistory() {
    const data = filteredJourneys();
    historyRows.innerHTML = '';
    
    if (data.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.style.textAlign = 'center';
      td.style.padding = '40px';
      td.style.color = 'var(--gray)';
      td.innerHTML = `
        <i class="fas fa-inbox" style="font-size: 40px; margin-bottom: 10px; opacity: 0.5;"></i>
        <div>No journeys found matching your filters</div>
      `;
      tr.appendChild(td);
      historyRows.appendChild(tr);
      return;
    }
    
    data.forEach(j => {
      const tr = document.createElement('tr');
      const tdActions = document.createElement('td');
      const del = document.createElement('button');
      del.className = 'btn btn-danger';
      del.innerHTML = '<i class="fas fa-trash"></i>';
      del.title = 'Delete journey';
      del.addEventListener('click', () => {
        const ok = confirm(`Delete journey from ${j.from} to ${j.to} on ${j.date}?`);
        if (ok) deleteJourney(j.id);
      });
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

  // Initialize the app
  init();
})();