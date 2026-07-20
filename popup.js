// POMODO — popup.js
// O popup só lê/escreve chrome.storage.local e pede ao service worker para
// resincronizar alarmes ('timer-sync'); a contagem "de verdade" mora no
// background.js, para sobreviver ao popup sendo fechado.
//
// O anel de progresso é uma animação CSS (ring.js) disparada só quando o
// ESTADO muda (iniciar/pausar/pular/trocar de fase) — nunca a cada segundo.
// Já o relógio (texto) e os botões de play/pausa são atualizados em duas
// trilhas: a cada segundo (enquanto rodando) E sempre que o estado muda, de
// modo que play/pausa nunca fique dessincronizado do que está de fato
// acontecendo, mesmo que um tick do timer se atrase.

import * as common from './common.js';
import { createRing } from './ring.js';

const el = {
    app: document.getElementById('app'),
    themeToggle: document.getElementById('theme-toggle'),
    detachToggle: document.getElementById('detach-toggle'),
    clock: document.getElementById('timer-clock'),
    phaseLabel: document.getElementById('timer-phase-label'),
    ring: document.getElementById('ring-progress'),
    btnToggle: document.getElementById('btn-toggle'),
    icoPlay: document.getElementById('ico-play'),
    icoPause: document.getElementById('ico-pause'),
    btnReset: document.getElementById('btn-reset'),
    btnSkip: document.getElementById('btn-skip'),
    cycleCount: document.getElementById('cycle-count'),
    modeCards: Array.from(document.querySelectorAll('.mode-card')),
    settingsToggle: document.getElementById('settings-toggle'),
    settingsPanel: document.getElementById('settings-panel'),
    setFocus: document.getElementById('set-focus'),
    setShort: document.getElementById('set-short'),
    setLong: document.getElementById('set-long'),
    setEvery: document.getElementById('set-every'),
    setAutostart: document.getElementById('set-autostart'),
    setNotify: document.getElementById('set-notify'),
    settingsReset: document.getElementById('settings-reset')
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

async function saveSettings(patch) {
    settings = common.sanitizeSettings({ ...settings, ...patch });
    await chrome.storage.local.set({ [common.SETTINGS_KEY]: settings });
    chrome.runtime.sendMessage({ type: 'timer-sync' }).catch(() => {});
}

function applyTheme() {
    if (settings.theme === 'dark') el.app.ownerDocument.documentElement.setAttribute('data-theme', 'dark');
    else if (settings.theme === 'light') el.app.ownerDocument.documentElement.setAttribute('data-theme', 'light');
    else el.app.ownerDocument.documentElement.removeAttribute('data-theme');
}

/** Texto/estado que muda a cada segundo enquanto roda: relógio, e sempre
 * play/pausa + dataset — barato o bastante pra chamar em todo tick. */
function renderText() {
    el.app.dataset.phase = timer.phase;
    el.app.dataset.running = String(timer.running);

    const remainingMs = common.computeRemainingMs(timer, settings);
    el.clock.textContent = common.formatClock(remainingMs);
    el.phaseLabel.textContent = common.phaseLabel(timer.phase);

    el.icoPlay.hidden = timer.running;
    el.icoPause.hidden = !timer.running;
    el.btnToggle.setAttribute('aria-label', timer.running ? 'Pausar' : 'Iniciar');

    const sessionNumber = timer.cyclesCompleted + (timer.phase === 'focus' ? 1 : 0);
    el.cycleCount.textContent = timer.phase === 'focus'
        ? `Sessão ${timer.cyclesCompleted + 1}`
        : `Depois da sessão ${sessionNumber}`;

    for (const card of el.modeCards) {
        const isActive = card.dataset.phase === timer.phase;
        card.setAttribute('aria-checked', String(isActive));
        const mins = card.dataset.phase === 'focus' ? settings.focus : card.dataset.phase === 'short' ? settings.short : settings.long;
        card.querySelector('[data-role="duration"]').textContent = `${mins} min`;
    }

    el.setFocus.value = settings.focus;
    el.setShort.value = settings.short;
    el.setLong.value = settings.long;
    el.setEvery.value = settings.longEvery;
    el.setAutostart.checked = settings.autoStartNext;
    el.setNotify.checked = settings.notifyEnabled;

    if (remainingMs <= 0 && timer.running) {
        // Fallback caso o popup esteja aberto exatamente quando a fase vira
        // (o background trata a virada real; aqui só evitamos mostrar 00:00 parado).
        loadState().then(syncAll);
    }
}

/** Só roda quando o estado (rodando/pausado/fase) realmente muda — dispara
 * ou pausa a animação CSS do anel, que a partir daí segue sozinha. */
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

async function handleReset() {
    const durationMs = common.phaseDurationMs(timer.phase, settings);
    await saveTimer({ running: false, endAt: null, remainingMs: durationMs });
    syncAll();
}

async function handleSkip() {
    const { phase, cyclesCompleted } = common.nextPhase(timer.phase, timer.cyclesCompleted, settings);
    const durationMs = common.phaseDurationMs(phase, settings);
    await saveTimer({
        phase,
        cyclesCompleted,
        running: settings.autoStartNext,
        endAt: settings.autoStartNext ? Date.now() + durationMs : null,
        remainingMs: settings.autoStartNext ? null : durationMs
    });
    syncAll();
}

async function handleSelectPhase(phase) {
    if (phase === timer.phase) return;
    const durationMs = common.phaseDurationMs(phase, settings);
    await saveTimer({ phase, running: false, endAt: null, remainingMs: durationMs });
    syncAll();
}

const MINI_WIDTH = 230;
const MINI_HEIGHT = 300;

async function openOrFocusMini() {
    const { miniWindowId } = await chrome.storage.local.get('miniWindowId');
    if (typeof miniWindowId === 'number') {
        try {
            await chrome.windows.get(miniWindowId);
            await chrome.windows.update(miniWindowId, { focused: true });
            return;
        } catch {
            // a janela não existe mais — segue para criar uma nova
        }
    }
    const win = await chrome.windows.create({
        url: chrome.runtime.getURL('mini.html'),
        type: 'popup',
        width: MINI_WIDTH,
        height: MINI_HEIGHT,
        focused: true
    });
    await chrome.storage.local.set({ miniWindowId: win.id });
}

function bind() {
    el.btnToggle.addEventListener('click', handleToggle);
    el.btnReset.addEventListener('click', handleReset);
    el.btnSkip.addEventListener('click', handleSkip);
    el.detachToggle.addEventListener('click', openOrFocusMini);

    for (const card of el.modeCards) {
        card.addEventListener('click', () => handleSelectPhase(card.dataset.phase));
    }

    el.themeToggle.addEventListener('click', async () => {
        const current = settings.theme === 'dark' ? 'light' : settings.theme === 'light' ? 'system' : 'dark';
        await saveSettings({ theme: current });
        applyTheme();
    });

    el.settingsToggle.addEventListener('click', () => {
        const expanded = el.settingsToggle.getAttribute('aria-expanded') === 'true';
        el.settingsToggle.setAttribute('aria-expanded', String(!expanded));
        el.settingsPanel.hidden = expanded;
    });

    const numberInputs = [
        [el.setFocus, 'focus'],
        [el.setShort, 'short'],
        [el.setLong, 'long'],
        [el.setEvery, 'longEvery']
    ];
    for (const [input, key] of numberInputs) {
        input.addEventListener('change', async () => {
            await saveSettings({ [key]: Number(input.value) });
            syncAll();
        });
    }

    el.setAutostart.addEventListener('change', () => saveSettings({ autoStartNext: el.setAutostart.checked }));
    el.setNotify.addEventListener('change', () => saveSettings({ notifyEnabled: el.setNotify.checked }));

    el.settingsReset.addEventListener('click', async () => {
        await saveSettings(common.DEFAULT_SETTINGS);
        applyTheme();
        syncAll();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (common.TIMER_KEY in changes) timer = common.sanitizeTimer(changes[common.TIMER_KEY].newValue);
        if (common.SETTINGS_KEY in changes) settings = common.sanitizeSettings(changes[common.SETTINGS_KEY].newValue);
        syncAll();
    });

    chrome.runtime.onMessage.addListener(msg => {
        if (msg?.type === 'timer-updated') loadState().then(syncAll);
    });

    // Rede de segurança: se a aba ficou em segundo plano tempo o bastante pro
    // Chrome atrasar os timers de JS, resincroniza tudo assim que ela volta a
    // ficar visível/em foco, em vez de esperar o próximo tick de 1s.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') loadState().then(syncAll);
    });
    window.addEventListener('focus', () => loadState().then(syncAll));
}

(async function init() {
    await loadState();
    applyTheme();
    bind();
    syncAll();
    startTicking();
})();

