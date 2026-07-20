// POMODO — service worker
// A verdade sobre "quanto tempo falta" mora aqui, não no popup: o popup pode ser
// fechado a qualquer momento, mas o alarme 'phase-end' dispara mesmo assim
// (agendado com "when", um timestamp absoluto), e o badge do ícone é atualizado
// a cada minuto por um segundo alarme ('badge-tick') enquanto o timer roda.

import * as common from './common.js';

const ALARM_PHASE_END = 'phase-end';
const ALARM_BADGE_TICK = 'badge-tick';

const BADGE_COLORS = {
    focus: '#ff2d52',
    short: '#2ba640',
    long: '#4696ff'
};

async function getState() {
    const data = await chrome.storage.local.get([common.SETTINGS_KEY, common.TIMER_KEY]);
    return {
        settings: common.sanitizeSettings(data[common.SETTINGS_KEY]),
        timer: common.sanitizeTimer(data[common.TIMER_KEY])
    };
}

async function setTimer(timer) {
    await chrome.storage.local.set({ [common.TIMER_KEY]: timer });
}

async function boot() {
    const { settings, timer } = await getState();
    await chrome.storage.local.set({
        [common.SETTINGS_KEY]: settings,
        [common.TIMER_KEY]: timer
    });
    await rescheduleAlarms();
    await updateBadge();
}

chrome.runtime.onInstalled.addListener(boot);
chrome.runtime.onStartup.addListener(boot);

/** Recria os alarmes a partir do estado atual salvo (chamar sempre após mudar o timer). */
async function rescheduleAlarms() {
    await chrome.alarms.clear(ALARM_PHASE_END);
    await chrome.alarms.clear(ALARM_BADGE_TICK);
    const { timer } = await getState();
    if (timer.running && timer.endAt) {
        chrome.alarms.create(ALARM_PHASE_END, { when: timer.endAt });
        chrome.alarms.create(ALARM_BADGE_TICK, { periodInMinutes: 1 });
    }
}

async function updateBadge() {
    const { settings, timer } = await getState();
    if (!timer.running) {
        chrome.action.setBadgeText({ text: '' });
        return;
    }
    const remainingMs = common.computeRemainingMs(timer, settings);
    const minutes = Math.max(0, Math.ceil(remainingMs / 60000));
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[timer.phase] || BADGE_COLORS.focus });
    chrome.action.setBadgeText({ text: minutes > 0 ? String(minutes) : '<1' });
}

async function notifyPhaseChange(newPhase) {
    const { settings } = await getState();
    if (!settings.notifyEnabled) return;
    const titles = {
        focus: 'Hora de focar 🍅',
        short: 'Descanso curto ☕',
        long: 'Descanso longo 🌿'
    };
    const messages = {
        focus: `${settings.focus} min de foco começando agora.`,
        short: `${settings.short} min para respirar um pouco.`,
        long: `${settings.long} min de descanso — você ganhou.`
    };
    chrome.notifications.create('pomofoco-' + Date.now(), {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: titles[newPhase] || 'POMODO',
        message: messages[newPhase] || '',
        priority: 1
    });
}

/** Fase atual terminou: calcula a próxima, salva e (opcionalmente) já inicia. */
async function handlePhaseEnd() {
    const { settings, timer } = await getState();
    const { phase, cyclesCompleted } = common.nextPhase(timer.phase, timer.cyclesCompleted, settings);
    const durationMs = common.phaseDurationMs(phase, settings);
    const shouldAutoStart = settings.autoStartNext;

    const newTimer = common.sanitizeTimer({
        phase,
        cyclesCompleted,
        running: shouldAutoStart,
        endAt: shouldAutoStart ? Date.now() + durationMs : null,
        remainingMs: shouldAutoStart ? null : durationMs
    });
    await setTimer(newTimer);
    await notifyPhaseChange(phase);
    await rescheduleAlarms();
    await updateBadge();
    chrome.runtime.sendMessage({ type: 'timer-updated' }).catch(() => { /* nenhum popup aberto — ok */ });
}

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM_PHASE_END) handlePhaseEnd();
    else if (alarm.name === ALARM_BADGE_TICK) updateBadge();
});

// O popup nunca mexe em alarmes diretamente — ele só grava o novo estado do
// timer no storage e pede ao service worker para resincronizar os alarmes e o
// badge. Isso evita os dois contextos disputarem a mesma fonte de verdade.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'timer-sync') {
        rescheduleAlarms().then(updateBadge).then(() => sendResponse({ ok: true }));
        return true; // resposta assíncrona
    }
});

// Mantém 'miniWindowId' honesto: se o usuário fechar a mini janela flutuante
// pelo X, o próximo clique em "Destacar" deve criar uma nova, não tentar
// focar um id morto.
chrome.windows.onRemoved.addListener(async closedId => {
    const { miniWindowId } = await chrome.storage.local.get('miniWindowId');
    if (miniWindowId === closedId) await chrome.storage.local.remove('miniWindowId');
});

chrome.commands?.onCommand.addListener(async command => {
    const { settings, timer } = await getState();
    if (command === 'toggle-timer') {
        if (timer.running) {
            const remainingMs = common.computeRemainingMs(timer, settings);
            await setTimer(common.sanitizeTimer({ ...timer, running: false, endAt: null, remainingMs }));
        } else {
            const remainingMs = common.computeRemainingMs(timer, settings);
            await setTimer(common.sanitizeTimer({ ...timer, running: true, endAt: Date.now() + remainingMs, remainingMs: null }));
        }
        await rescheduleAlarms();
        await updateBadge();
    } else if (command === 'skip-phase') {
        await handlePhaseEnd();
    }
});
