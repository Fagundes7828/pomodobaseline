// POMODO — módulo compartilhado entre popup.js e background.js
// Mantém a definição de estado em um único lugar para os dois contextos
// nunca divergirem sobre o que é "settings" ou "timer".

export const SETTINGS_KEY = 'settings';
export const TIMER_KEY = 'timer';

export const PHASES = /** @type {const} */ (['focus', 'short', 'long']);

export const DEFAULT_SETTINGS = {
    focus: 25,          // minutos — Tempo de Trabalho
    short: 5,            // minutos — Descanso Curto
    long: 15,            // minutos — Descanso Longo (configurável)
    longEvery: 4,         // descanso longo a cada N sessões de foco
    autoStartNext: false, // encadear a próxima fase automaticamente
    soundEnabled: true,
    notifyEnabled: true,
    theme: 'system'        // 'system' | 'dark' | 'light'
};

export const DEFAULT_TIMER = {
    phase: 'focus',
    running: false,
    endAt: null,        // epoch ms — só relevante quando running === true
    remainingMs: null,  // preenchido quando pausado/parado
    cyclesCompleted: 0    // sessões de foco concluídas desde o último descanso longo
};

const MIN_MINUTES = 1;
const MAX_MINUTES = 180;

/** Garante que os valores de configuração sejam números válidos e dentro de limites sãos. */
export function sanitizeSettings(raw) {
    const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
    for (const key of ['focus', 'short', 'long']) {
        const n = Number(s[key]);
        s[key] = Number.isFinite(n) ? Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, n)) : DEFAULT_SETTINGS[key];
    }
    const every = Number(s.longEvery);
    s.longEvery = Number.isFinite(every) ? Math.min(12, Math.max(2, Math.round(every))) : DEFAULT_SETTINGS.longEvery;
    s.autoStartNext = !!s.autoStartNext;
    s.soundEnabled = s.soundEnabled !== false;
    s.notifyEnabled = s.notifyEnabled !== false;
    if (!['system', 'dark', 'light'].includes(s.theme)) s.theme = 'system';
    return s;
}

export function sanitizeTimer(raw) {
    const t = { ...DEFAULT_TIMER, ...(raw || {}) };
    if (!PHASES.includes(t.phase)) t.phase = 'focus';
    t.running = !!t.running;
    t.endAt = typeof t.endAt === 'number' ? t.endAt : null;
    t.remainingMs = typeof t.remainingMs === 'number' ? t.remainingMs : null;
    t.cyclesCompleted = Number.isFinite(t.cyclesCompleted) ? t.cyclesCompleted : 0;
    return t;
}

export function phaseDurationMs(phase, settings) {
    const minutes = phase === 'focus' ? settings.focus : phase === 'short' ? settings.short : settings.long;
    return minutes * 60 * 1000;
}

export function phaseLabel(phase) {
    return phase === 'focus' ? 'Foco' : phase === 'short' ? 'Descanso Curto' : 'Descanso Longo';
}

/** Retorna a fase seguinte e o contador de ciclos atualizado, seguindo o ciclo Pomodoro clássico. */
export function nextPhase(currentPhase, cyclesCompleted, settings) {
    if (currentPhase === 'focus') {
        const completed = cyclesCompleted + 1;
        const phase = completed % settings.longEvery === 0 ? 'long' : 'short';
        return { phase, cyclesCompleted: completed };
    }
    // Depois de qualquer descanso (curto ou longo), volta ao foco.
    return { phase: 'focus', cyclesCompleted };
}

/** Milissegundos restantes na fase atual, considerando se está rodando ou pausada. */
export function computeRemainingMs(timer, settings, now = Date.now()) {
    if (timer.running && timer.endAt) return Math.max(0, timer.endAt - now);
    if (typeof timer.remainingMs === 'number') return Math.max(0, timer.remainingMs);
    return phaseDurationMs(timer.phase, settings);
}

export function formatClock(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
