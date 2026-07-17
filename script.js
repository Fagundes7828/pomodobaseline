(function () {
  "use strict";

  var FOCUS_MIN = 25;
  var SHORT_BREAK_MIN = 10;
  var LONG_BREAK_MIN = 20;
  var CYCLES_BEFORE_LONG_BREAK = 4;

  var TASKS_KEY = "pomodoro-tasks";
  var STREAK_KEY = "pomodoro-streak";
  var STATS_KEY = "pomodoro-stats";
  var SESSION_KEY = "pomodoro-session";

  var FOCUS_CIRCUMFERENCE = 2 * Math.PI * 108;
  var BREAK_CIRCUMFERENCE = 2 * Math.PI * 155;

  var state = {
    tasks: [],
    activeId: null,
    mode: "idle", // idle | focus | short-break | long-break
    remaining: FOCUS_MIN * 60,
    running: false,
    focusCount: 0,
    shortBreakCount: 0,
    longBreakCount: 0,
    streak: { count: 0, lastDate: null },
    justFinished: null,
  };

  var intervalId = null;

  var el = {
    streakCount: document.getElementById("streakCount"),
    focusCount: document.getElementById("focusCount"),
    shortCount: document.getElementById("shortCount"),
    longCount: document.getElementById("longCount"),
    pills: document.querySelectorAll(".pill"),
    taskView: document.getElementById("taskView"),
    timerView: document.getElementById("timerView"),
    taskInput: document.getElementById("taskInput"),
    addBtn: document.getElementById("addBtn"),
    emptyState: document.getElementById("emptyState"),
    taskList: document.getElementById("taskList"),
    timerLabel: document.getElementById("timerLabel"),
    ringFocus: document.getElementById("ringFocus"),
    ringBreak: document.getElementById("ringBreak"),
    ringFocusProgress: document.getElementById("ringFocusProgress"),
    ringBreakProgress: document.getElementById("ringBreakProgress"),
    ringFocusTime: document.getElementById("ringFocusTime"),
    ringBreakTime: document.getElementById("ringBreakTime"),
    justFinished: document.getElementById("justFinished"),
    toggleBtn: document.getElementById("toggleBtn"),
    stopBtn: document.getElementById("stopBtn"),
    modalOverlay: document.getElementById("modalOverlay"),
    backBtn: document.getElementById("backBtn"),
  };

  el.ringFocusProgress.style.strokeDasharray = FOCUS_CIRCUMFERENCE;
  el.ringBreakProgress.style.strokeDasharray = BREAK_CIRCUMFERENCE;

  function formatClock(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function formatSpent(totalSeconds) {
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;
    if (h > 0) return h + "h " + m + "min";
    if (m > 0) return m + "min " + s + "s";
    return s + "s";
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  // ---------- persistence ----------

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function load() {
    state.tasks = safeParse(localStorage.getItem(TASKS_KEY), []);
    state.streak = safeParse(localStorage.getItem(STREAK_KEY), { count: 0, lastDate: null });

    var stats = safeParse(localStorage.getItem(STATS_KEY), { focusCount: 0, shortBreakCount: 0, longBreakCount: 0 });
    state.focusCount = stats.focusCount || 0;
    state.shortBreakCount = stats.shortBreakCount || 0;
    state.longBreakCount = stats.longBreakCount || 0;

    var session = safeParse(localStorage.getItem(SESSION_KEY), null);
    if (session && session.mode && session.mode !== "idle") {
      var taskStillExists = session.activeId && state.tasks.some(function (t) { return t.id === session.activeId; });
      if (taskStillExists && typeof session.remaining === "number" && session.remaining > 0) {
        state.mode = session.mode;
        state.activeId = session.activeId;
        state.remaining = session.remaining;
        state.running = false; // always resume paused; the person presses "retomar"
      }
    }
  }

  function saveTasks() {
    localStorage.setItem(TASKS_KEY, JSON.stringify(state.tasks));
  }

  function saveStreak() {
    localStorage.setItem(STREAK_KEY, JSON.stringify(state.streak));
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify({
      focusCount: state.focusCount,
      shortBreakCount: state.shortBreakCount,
      longBreakCount: state.longBreakCount,
    }));
  }

  function saveSession() {
    if (state.mode === "idle") {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      mode: state.mode,
      activeId: state.activeId,
      remaining: state.remaining,
    }));
  }

  function registerStreakTick() {
    var today = todayKey();
    if (state.streak.lastDate === today) return;
    var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    var continued = state.streak.lastDate === yesterday;
    state.streak = { count: continued ? state.streak.count + 1 : 1, lastDate: today };
    saveStreak();
  }

  // ---------- core logic ----------

  function getActiveTask() {
    for (var i = 0; i < state.tasks.length; i++) {
      if (state.tasks[i].id === state.activeId) return state.tasks[i];
    }
    return null;
  }

  function tick() {
    state.remaining -= 1;

    if (state.remaining <= 0) {
      clearInterval(intervalId);
      intervalId = null;

      if (state.mode === "focus") {
        state.focusCount += 1;
        saveStats();

        var task = getActiveTask();
        if (task) {
          task.cycles += 1;
          state.justFinished = { title: task.title, spent: task.spent };
          saveTasks();
        }
        registerStreakTick();

        var goLong = state.focusCount % CYCLES_BEFORE_LONG_BREAK === 0;
        state.mode = goLong ? "long-break" : "short-break";
        state.remaining = (goLong ? LONG_BREAK_MIN : SHORT_BREAK_MIN) * 60;
        saveSession();
        render();
        startInterval();
      } else if (state.mode === "short-break" || state.mode === "long-break") {
        if (state.mode === "short-break") state.shortBreakCount += 1;
        else state.longBreakCount += 1;
        saveStats();
        state.running = false;
        saveSession();
        showModal();
        render();
      }
      return;
    }

    if (state.mode === "focus") {
      var activeTask = getActiveTask();
      if (activeTask) {
        activeTask.spent += 1;
        saveTasks();
      }
    }
    saveSession();
    render();
  }

  function startInterval() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(tick, 1000);
  }

  function stopInterval() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  function addTask() {
    var title = el.taskInput.value.trim();
    if (!title) return;
    state.tasks.push({ id: Date.now().toString(), title: title, spent: 0, cycles: 0 });
    el.taskInput.value = "";
    saveTasks();
    render();
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    if (state.activeId === id) {
      state.activeId = null;
      state.mode = "idle";
      state.running = false;
      state.remaining = FOCUS_MIN * 60;
      stopInterval();
      saveSession();
    }
    saveTasks();
    render();
  }

  function startFocus(id) {
    state.activeId = id;
    state.mode = "focus";
    state.remaining = FOCUS_MIN * 60;
    state.running = true;
    state.justFinished = null;
    hideModal();
    saveSession();
    startInterval();
    render();
  }

  function toggleRunning() {
    if (state.mode === "idle") return;
    state.running = !state.running;
    if (state.running) startInterval();
    else stopInterval();
    saveSession();
    render();
  }

  function resetTimer() {
    stopInterval();
    state.running = false;
    state.mode = "idle";
    state.activeId = null;
    state.remaining = FOCUS_MIN * 60;
    state.justFinished = null;
    hideModal();
    saveSession();
    render();
  }

  function backToTasks() {
    resetTimer();
  }

  function showModal() {
    el.modalOverlay.classList.remove("hidden");
  }
  function hideModal() {
    el.modalOverlay.classList.add("hidden");
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- rendering ----------

  function render() {
    el.streakCount.textContent = state.streak.count;
    el.focusCount.textContent = state.focusCount;
    el.shortCount.textContent = state.shortBreakCount;
    el.longCount.textContent = state.longBreakCount;

    el.pills.forEach(function (pill) {
      var key = pill.getAttribute("data-pill");
      pill.classList.remove("active-focus", "active-break");
      if (key === "focus" && state.mode === "focus") pill.classList.add("active-focus");
      if (key === "short-break" && state.mode === "short-break") pill.classList.add("active-break");
      if (key === "long-break" && state.mode === "long-break") pill.classList.add("active-break");
    });

    var isIdle = state.mode === "idle";
    var isFocus = state.mode === "focus";
    var isBreak = state.mode === "short-break" || state.mode === "long-break";

    el.taskView.classList.toggle("hidden", !isIdle);
    el.timerView.classList.toggle("hidden", isIdle);
    el.ringFocus.classList.toggle("hidden", !isFocus);
    el.ringBreak.classList.toggle("hidden", !isBreak);

    if (isIdle) {
      el.emptyState.classList.toggle("hidden", state.tasks.length > 0);
      el.taskList.innerHTML = "";
      state.tasks.forEach(function (t) {
        var row = document.createElement("div");
        row.className = "task";
        row.innerHTML =
          '<div>' +
            '<p class="task-title"></p>' +
            '<p class="task-meta"></p>' +
          '</div>' +
          '<div class="task-actions">' +
            '<button class="btn start-btn">Iniciar</button>' +
            '<button class="btn btn-icon del-btn" aria-label="Excluir tarefa">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>' +
            '</button>' +
          '</div>';
        row.querySelector(".task-title").textContent = t.title;
        row.querySelector(".task-meta").textContent =
          formatSpent(t.spent) + " gastos \u00B7 " + t.cycles + (t.cycles === 1 ? " ciclo" : " ciclos");
        row.querySelector(".start-btn").addEventListener("click", function () { startFocus(t.id); });
        row.querySelector(".del-btn").addEventListener("click", function () { deleteTask(t.id); });
        el.taskList.appendChild(row);
      });
    }

    if (isFocus) {
      var task = getActiveTask();
      el.timerLabel.innerHTML = 'Trabalhando em <strong>' + (task ? escapeHtml(task.title) : "") + '</strong>';
      var focusProgress = 1 - state.remaining / (FOCUS_MIN * 60);
      el.ringFocusProgress.style.strokeDashoffset = FOCUS_CIRCUMFERENCE * (1 - focusProgress);
      el.ringFocusTime.textContent = formatClock(state.remaining);
    }

    if (isBreak) {
      el.timerLabel.textContent = state.mode === "long-break" ? "Pausa longa" : "Pausa curta";
      var totalBreak = (state.mode === "long-break" ? LONG_BREAK_MIN : SHORT_BREAK_MIN) * 60;
      var breakProgress = 1 - state.remaining / totalBreak;
      el.ringBreakProgress.style.strokeDashoffset = BREAK_CIRCUMFERENCE * (1 - breakProgress);
      el.ringBreakTime.textContent = formatClock(state.remaining);
    }

    if (state.justFinished && isBreak) {
      el.justFinished.classList.remove("hidden");
      el.justFinished.innerHTML =
        "Tarefa conclu\u00EDda \u00B7 " + formatSpent(state.justFinished.spent) + " registrados" +
        '<span class="jf-title"></span>';
      el.justFinished.querySelector(".jf-title").textContent = state.justFinished.title;
    } else {
      el.justFinished.classList.add("hidden");
    }

    el.toggleBtn.textContent = state.running ? "Pausar" : "Retomar";
  }

  // ---------- wiring ----------

  el.addBtn.addEventListener("click", addTask);
  el.taskInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") addTask();
  });
  el.toggleBtn.addEventListener("click", toggleRunning);
  el.stopBtn.addEventListener("click", resetTimer);
  el.backBtn.addEventListener("click", backToTasks);

  load();
  render();
  // A session restored from a closed tab always resumes paused (never silently
  // running in the background), so "Retomar" is what kicks the interval back off.
})();
