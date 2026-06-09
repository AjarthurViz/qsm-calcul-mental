/* ============================================================
   QSM — Entraînement au calcul mental
   Pas de dépendances. Données en localStorage.
   ============================================================ */

(function () {
  "use strict";

  // ---- Constantes ----
  const STORAGE_HISTORY = "qsm_history_v1";
  const STORAGE_SETTINGS = "qsm_settings_v1";
  const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const COUNTS = [10, 20, 30, 50];
  const K_MAX = 10;          // deuxième opérande (1..10)
  const REVEAL_MS = 4000;    // affichage de la réponse en cas d'échec
  const ADVANCE_MS = 280;    // petite pause d'animation après une bonne réponse
  const RETRY_MS = 420;      // pause après une 1re erreur (shake)

  const OP_SIGNS = { mul: "×", add: "+", sub: "−" };

  // ---- État ----
  const sel = { mul: new Set(), add: new Set(), sub: new Set() };
  let count = 20;

  const game = {
    problems: [],
    index: 0,
    current: null,
    attempt: 0,      // 0 = 1er essai, 1 = 2e essai
    startTime: 0,
    locked: true,
    results: [],     // { score, time, status: 'first'|'second'|'fail' }
  };

  // ---- Raccourcis DOM ----
  const $ = (id) => document.getElementById(id);
  const body = document.body;

  // ============================================================
  //  PERSISTANCE
  // ============================================================
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_SETTINGS));
      if (s) {
        ["mul", "add", "sub"].forEach((op) => {
          if (Array.isArray(s[op])) s[op].forEach((n) => sel[op].add(n));
        });
        if (COUNTS.includes(s.count)) count = s.count;
        return;
      }
    } catch (_) { /* ignore */ }
    // Valeurs par défaut
    [2, 3, 4, 5, 6, 7, 8, 9].forEach((n) => sel.mul.add(n));
  }

  function saveSettings() {
    const data = {
      mul: [...sel.mul], add: [...sel.add], sub: [...sel.sub], count,
    };
    try { localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(data)); } catch (_) {}
  }

  function loadHistory() {
    try {
      const h = JSON.parse(localStorage.getItem(STORAGE_HISTORY));
      return Array.isArray(h) ? h : [];
    } catch (_) { return []; }
  }

  function saveHistoryEntry(entry) {
    const h = loadHistory();
    h.push(entry);
    try { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(h)); } catch (_) {}
    return h;
  }

  // ============================================================
  //  CONSTRUCTION DU MENU
  // ============================================================
  function buildChips(containerId, op) {
    const box = $(containerId);
    box.innerHTML = "";
    TABLES.forEach((n) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = n;
      b.setAttribute("aria-pressed", sel[op].has(n) ? "true" : "false");
      b.addEventListener("click", () => {
        if (sel[op].has(n)) sel[op].delete(n);
        else sel[op].add(n);
        b.setAttribute("aria-pressed", sel[op].has(n) ? "true" : "false");
        hideWarn();
        saveSettings();
      });
      box.appendChild(b);
    });
  }

  function buildCountChips() {
    const box = $("chips-count");
    box.innerHTML = "";
    COUNTS.forEach((c) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = c;
      b.setAttribute("aria-pressed", c === count ? "true" : "false");
      b.addEventListener("click", () => {
        count = c;
        [...box.children].forEach((ch) =>
          ch.setAttribute("aria-pressed", ch === b ? "true" : "false"));
        saveSettings();
      });
      box.appendChild(b);
    });
  }

  function refreshChipStates() {
    ["mul", "add", "sub"].forEach((op) => {
      const box = $("chips-" + op);
      [...box.children].forEach((b, i) =>
        b.setAttribute("aria-pressed", sel[op].has(TABLES[i]) ? "true" : "false"));
    });
  }

  function setupQuickButtons() {
    document.querySelectorAll("[data-all]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const op = btn.dataset.all;
        TABLES.forEach((n) => sel[op].add(n));
        refreshChipStates(); hideWarn(); saveSettings();
      });
    });
    document.querySelectorAll("[data-none]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const op = btn.dataset.none;
        sel[op].clear();
        refreshChipStates(); saveSettings();
      });
    });
  }

  function hideWarn() { $("warn").hidden = true; }

  // ============================================================
  //  GÉNÉRATION DES CALCULS
  // ============================================================
  function buildPool() {
    const pool = [];
    ["mul", "add", "sub"].forEach((op) => {
      sel[op].forEach((n) => pool.push({ op, n }));
    });
    return pool;
  }

  function rand(max) { return 1 + Math.floor(Math.random() * max); }

  function makeProblem(pool) {
    const { op, n } = pool[Math.floor(Math.random() * pool.length)];
    const k = rand(K_MAX);
    if (op === "mul") return { text: `${n} × ${k}`, answer: n * k };
    if (op === "add") return { text: `${n} + ${k}`, answer: n + k };
    // soustraction : on retranche n d'un nombre juste au-dessus (résultat = k)
    return { text: `${n + k} − ${n}`, answer: k };
  }

  function generateProblems(pool) {
    const list = [];
    let lastText = null;
    for (let i = 0; i < count; i++) {
      let p = makeProblem(pool);
      let guard = 0;
      while (p.text === lastText && guard++ < 6) p = makeProblem(pool);
      lastText = p.text;
      list.push(p);
    }
    return list;
  }

  // ============================================================
  //  DÉROULEMENT DU JEU
  // ============================================================
  function startGame() {
    const pool = buildPool();
    if (pool.length === 0) { $("warn").hidden = false; return; }

    game.problems = generateProblems(pool);
    game.index = 0;
    game.results = [];
    body.dataset.view = "game";
    showProblem();
  }

  function showProblem() {
    const p = game.problems[game.index];
    game.current = p;
    game.attempt = 0;
    game.locked = true;

    $("counter").textContent = `${game.index + 1} / ${game.problems.length}`;
    $("bar-fill").style.width = `${(game.index / game.problems.length) * 100}%`;

    const input = $("answer");
    input.value = "";
    input.classList.remove("shake");
    // On garde le focus en continu : le clavier mobile ne se ferme jamais
    input.focus();

    const fb = $("feedback");
    fb.className = "feedback";
    fb.innerHTML = "";

    const prob = $("problem");
    prob.classList.remove("correct", "enter");
    prob.textContent = p.text;
    // relance l'animation d'entrée
    void prob.offsetWidth;
    prob.classList.add("enter");

    // Démarrage du chrono + déverrouillage en synchrone (sans dépendre de
    // requestAnimationFrame, qui peut être throttlé sur mobile pendant
    // l'animation d'ouverture du clavier — ce qui bloquerait la saisie).
    game.startTime = performance.now();
    game.locked = false;
  }

  function onInput() {
    const input = $("answer");
    // Pendant les animations / la révélation : on ignore et on efface la frappe
    // (sans jamais désactiver le champ, pour garder le clavier mobile ouvert)
    if (game.locked) { input.value = ""; return; }
    const ansStr = String(game.current.answer);
    const val = input.value.replace(/[^0-9]/g, "");
    if (val !== input.value) input.value = val;
    if (val.length === 0) return;

    if (val === ansStr) { handleCorrect(); return; }
    // Assez de chiffres saisis mais résultat faux -> tentative ratée
    if (val.length >= ansStr.length) handleWrong();
  }

  function handleCorrect() {
    game.locked = true;
    const elapsed = (performance.now() - game.startTime) / 1000;
    const status = game.attempt === 0 ? "first" : "second";
    const mult = game.attempt === 0 ? 1 : 0.4;
    const score = (1000 / (1 + elapsed)) * mult;
    game.results.push({ score, time: elapsed, status });

    const prob = $("problem");
    prob.classList.remove("enter");
    void prob.offsetWidth;
    prob.classList.add("correct");

    setTimeout(nextProblem, ADVANCE_MS);
  }

  function handleWrong() {
    if (game.attempt === 0) {
      // 1re erreur -> second essai
      game.attempt = 1;
      game.locked = true;
      const input = $("answer");
      input.classList.remove("shake");
      void input.offsetWidth;
      input.classList.add("shake");

      const fb = $("feedback");
      fb.className = "feedback retry";
      fb.textContent = "Pas tout à fait… essaie encore";

      setTimeout(() => {
        input.value = "";
        input.classList.remove("shake");
        game.locked = false;
        input.focus();
      }, RETRY_MS);
    } else {
      // 2e erreur -> on révèle la réponse
      revealAnswer();
    }
  }

  function revealAnswer() {
    game.locked = true;
    game.results.push({ score: 0, time: 0, status: "fail" });

    const input = $("answer");
    input.value = "";
    input.classList.remove("shake");
    input.focus(); // on garde le clavier ouvert pendant la révélation

    const fb = $("feedback");
    fb.className = "feedback reveal";
    fb.innerHTML = `Réponse <span class="reveal-ans">${game.current.answer}</span>`;

    setTimeout(nextProblem, REVEAL_MS);
  }

  function nextProblem() {
    game.index++;
    if (game.index >= game.problems.length) endGame();
    else showProblem();
  }

  function quitGame() {
    body.dataset.view = "menu";
    renderProgress();
  }

  // ============================================================
  //  FIN DE PARTIE
  // ============================================================
  function endGame() {
    $("bar-fill").style.width = "100%";

    const total = game.results.length;
    const solved = game.results.filter((r) => r.status !== "fail").length;
    const firsts = game.results.filter((r) => r.status === "first").length;
    const solvedTimes = game.results.filter((r) => r.status !== "fail").map((r) => r.time);
    const avgTime = solvedTimes.length
      ? solvedTimes.reduce((a, b) => a + b, 0) / solvedTimes.length : 0;
    const score = Math.round(game.results.reduce((a, r) => a + r.score, 0) / total);

    // Comparaison avec la meilleure partie précédente
    const prevHistory = loadHistory();
    const prevBest = prevHistory.reduce((m, e) => Math.max(m, e.score), 0);

    saveHistoryEntry({
      t: Date.now(), score, count: total, solved,
      first: firsts, avgTime: Math.round(avgTime * 100) / 100,
    });

    // Affichage
    body.dataset.view = "result";
    $("r-solved").textContent = `${solved}/${total}`;
    $("r-first").textContent = `${Math.round((firsts / total) * 100)}%`;
    $("r-time").textContent = `${avgTime.toFixed(1)}s`;

    const delta = $("result-delta");
    if (prevHistory.length === 0) {
      delta.textContent = "Première partie enregistrée 🎉";
      delta.className = "result__delta up";
    } else if (score > prevBest) {
      delta.textContent = `Nouveau record ! (+${score - prevBest})`;
      delta.className = "result__delta up";
    } else {
      delta.textContent = `Meilleur score : ${prevBest}`;
      delta.className = "result__delta down";
    }

    animateValue($("result-score"), 0, score, 700);
  }

  function animateValue(el, from, to, dur) {
    const t0 = performance.now();
    function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ============================================================
  //  PROGRESSION + GRAPHIQUE
  // ============================================================
  function renderProgress() {
    const h = loadHistory();
    const best = h.reduce((m, e) => Math.max(m, e.score), 0);
    const avg = h.length ? Math.round(h.reduce((a, e) => a + e.score, 0) / h.length) : 0;

    $("stat-best").textContent = h.length ? best : "—";
    $("stat-games").textContent = h.length;
    $("stat-avg").textContent = h.length ? avg : "—";

    renderChart(h);
  }

  function renderChart(history) {
    const box = $("chart-box");
    const data = history.slice(-20);

    if (data.length < 2) {
      box.innerHTML =
        `<div class="chart-empty">Joue au moins deux parties pour voir ta progression.</div>`;
      return;
    }

    const W = 700, H = 160, padX = 14, padY = 18;
    const scores = data.map((e) => e.score);
    let min = Math.min(...scores), max = Math.max(...scores);
    if (min === max) { min -= 1; max += 1; }
    const range = max - min;

    const x = (i) => padX + (i / (data.length - 1)) * (W - padX * 2);
    const y = (v) => padY + (1 - (v - min) / range) * (H - padY * 2);

    const pts = data.map((e, i) => [x(i), y(e.score)]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = `M${pts[0][0].toFixed(1)} ${(H - padY).toFixed(1)} `
      + pts.map((p) => "L" + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ")
      + ` L${pts[pts.length - 1][0].toFixed(1)} ${(H - padY).toFixed(1)} Z`;

    const dots = pts.map((p, i) =>
      `<circle class="chart-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === pts.length - 1 ? 4.5 : 3}"/>`
    ).join("");

    const midY = y((min + max) / 2);

    box.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <line class="chart-grid" x1="${padX}" y1="${midY.toFixed(1)}" x2="${W - padX}" y2="${midY.toFixed(1)}"/>
        <path class="chart-area" d="${area}"/>
        <path class="chart-line" d="${line}" id="chart-path"/>
        ${dots}
      </svg>`;

    // Animation de tracé
    const path = $("chart-path");
    if (path && path.getTotalLength) {
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.getBoundingClientRect(); // reflow
      path.style.transition = "stroke-dashoffset .9s ease";
      path.style.strokeDashoffset = "0";
    }
  }

  // ============================================================
  //  THÈME (clair / sombre)
  // ============================================================
  function currentTheme() {
    const explicit = document.documentElement.getAttribute("data-theme");
    if (explicit === "light" || explicit === "dark") return explicit;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("qsm_theme", next); } catch (_) {}
  }

  function setupTheme() {
    $("theme-toggle").addEventListener("click", toggleTheme);
    // Si l'utilisateur n'a pas choisi, on suit les changements du système
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSysChange = (e) => {
      let stored = null;
      try { stored = localStorage.getItem("qsm_theme"); } catch (_) {}
      if (stored !== "light" && stored !== "dark") {
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      }
    };
    if (mq.addEventListener) mq.addEventListener("change", onSysChange);
    else if (mq.addListener) mq.addListener(onSysChange);
  }

  // ============================================================
  //  INITIALISATION
  // ============================================================
  function init() {
    loadSettings();
    buildChips("chips-mul", "mul");
    buildChips("chips-add", "add");
    buildChips("chips-sub", "sub");
    buildCountChips();
    setupQuickButtons();
    setupTheme();
    renderProgress();

    $("start").addEventListener("click", startGame);
    $("replay").addEventListener("click", startGame);
    $("back-menu").addEventListener("click", quitGame);
    $("quit").addEventListener("click", quitGame);

    const input = $("answer");
    input.addEventListener("input", onInput);
    // On évite la soumission / on garde le focus
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
    // Filet de sécurité : un tap dans la zone de jeu redonne le focus au champ
    $("view-game").addEventListener("click", () => {
      if (body.dataset.view === "game") input.focus();
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
