// POMODO — ring.js
// Controla o anel de progresso do timer via animação CSS (@keyframes
// ring-fill, definida em popup.css), em vez de recalcular o stroke-dashoffset
// a cada segundo em JavaScript. Isso evita o anel "travar" quando a janela
// (principalmente a mini janela flutuante) perde o foco e o Chrome atrasa os
// timers de JS da página — a animação CSS continua sendo desenhada pelo
// compositor do navegador independente disso.

const CIRCUMFERENCE = 2 * Math.PI * 90; // r=90 no viewBox do SVG

function clamp01(n) {
    return Math.min(1, Math.max(0, n));
}

/**
 * @param {SVGCircleElement} el - o círculo #ring-progress
 */
export function createRing(el) {
    el.style.strokeDasharray = String(CIRCUMFERENCE);

    /** Mostra uma fração fixa (0 = vazio, 1 = cheio) sem animar — usado quando pausado/parado. */
    function setStaticFraction(elapsedFraction) {
        el.classList.remove('is-animating');
        el.style.animation = 'none';
        el.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - clamp01(elapsedFraction)));
    }

    /**
     * Anima do ponto atual (elapsedFraction) até o anel completo, ao longo de
     * durationMs — ou seja, "termine de preencher exatamente quando a fase acabar".
     */
    function animateToFull(elapsedFraction, durationMs) {
        if (!(durationMs > 0)) { setStaticFraction(1); return; }
        const fromOffset = CIRCUMFERENCE * (1 - clamp01(elapsedFraction));
        el.style.animation = 'none';
        // eslint-disable-next-line no-unused-expressions
        el.offsetWidth; // força reflow para garantir que a próxima animação reinicie do zero
        el.style.setProperty('--ring-from', String(fromOffset));
        el.style.setProperty('--ring-to', '0');
        el.style.animationDuration = `${durationMs}ms`;
        el.classList.add('is-animating');
    }

    return { setStaticFraction, animateToFull, CIRCUMFERENCE };
}
