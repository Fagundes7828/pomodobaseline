// POMODO — mini.js
// Mesma fonte de verdade que o popup.js (chrome.storage.local + background.js
// via alarms). Esta janela só mostra: relógio, fase e um botão de play/pausa.
//
// O anel usa animação CSS (ring.js), disparada apenas quando o estado muda —
// por isso ele não trava quando esta janela fica em segundo plano e o Chrome
// atrasa os timers de JS da página. Relógio e botão play/pausa também têm uma
// rede de segurança em visibilitychange/focus, pro caso de um tick de 1s
// atrasar enquanto a janela está oculta.

import * as common from './common.js';
import { createRing } from './ring.js';

const el = {
    app: document.getElementById('app'),
    clock: document.getElementById('timer-clock'),
    phaseLabel: document.getElementById('timer-phase-label'),
    ring: document.getElementById('ring-progress'),
    btnToggle: document.getElementById('btn-toggle'),
    icoPlay: document.getElementById('ico-play'),
    icoPause: document.getElementById('ico-pause')
};

const ring = createRing(el.ring);

let settings = common.DEFAULT_SETTINGS;
let timer = common.DEFAULT_TIMER;
let tickHandle = null;

async function loadState() {
    const data = await chrome.storage.local.get([common.SETTINGS_KEY, common.TIMER_KEY]);
    settings = common.sanitizeSettings(data[common.SETTINGS_KEY]);
    timer = common.sanitizeTimer(data[common.TIMER_KEY]);
}

async function saveTimer(patch) {
    timer = common.sanitizeTimer({ ...timer, ...patch });
    await chrome.storage.local.set({ [common.TIMER_KEY]: timer });
    chrome.runtime.sendMessage({ type: 'timer-sync' }).catch(() => {});
}

function applyTheme() {
    if (settings.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (settings.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
}

function renderText() {
    el.app.dataset.phase = timer.phase;
    el.app.dataset.running = String(timer.running);

    const remainingMs = common.computeRemainingMs(timer, settings);
    el.clock.textContent = common.formatClock(remainingMs);
    el.phaseLabel.textContent = common.phaseLabel(timer.phase);

    el.icoPlay.hidden = timer.running;
    el.icoPause.hidden = !timer.running;
    el.btnToggle.setAttribute('aria-label', timer.running ? 'Pausar' : 'Iniciar');

    if (remainingMs <= 0 && timer.running) loadState().then(syncAll);
}

function syncRing() {
    const remainingMs = common.computeRemainingMs(timer, settings);
    const durationMs = common.phaseDurationMs(timer.phase, settings);
    const elapsedFraction = durationMs > 0 ? 1 - remainingMs / durationMs : timer.running ? 0 : 1;
    if (timer.running) ring.animateToFull(elapsedFraction, remainingMs);
    else ring.setStaticFraction(elapsedFraction);
}

function syncAll() {
    renderText();
    syncRing();
}

function startTicking() {
    stopTicking();
    tickHandle = setInterval(() => { if (timer.running) renderText(); }, 1000);
}
function stopTicking() {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;
}

async function handleToggle() {
    if (timer.running) {
        const remainingMs = common.computeRemainingMs(timer, settings);
        await saveTimer({ running: false, endAt: null, remainingMs });
    } else {
        const remainingMs = common.computeRemainingMs(timer, settings);
        await saveTimer({ running: true, endAt: Date.now() + remainingMs, remainingMs: null });
    }
    syncAll();
}

el.btnToggle.addEventListener('click', handleToggle);

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (common.TIMER_KEY in changes) timer = common.sanitizeTimer(changes[common.TIMER_KEY].newValue);
    if (common.SETTINGS_KEY in changes) { settings = common.sanitizeSettings(changes[common.SETTINGS_KEY].newValue); applyTheme(); }
    syncAll();
});

chrome.runtime.onMessage.addListener(msg => {
    if (msg?.type === 'timer-updated') loadState().then(syncAll);
});

// Rede de segurança: resincroniza assim que a janela volta a ficar visível
// ou em foco, em vez de esperar o próximo tick de 1s (que pode ter sido
// atrasado pelo Chrome enquanto a janela estava em segundo plano).
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadState().then(syncAll);
});
window.addEventListener('focus', () => loadState().then(syncAll));

(async function init() {
    await loadState();
    applyTheme();
    syncAll();
    startTicking();
})();
