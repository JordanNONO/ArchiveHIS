let audioCtx = null;

function getContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

// Les navigateurs bloquent l'audio tant qu'aucune interaction n'a eu lieu sur
// la page — sans ça, une notification qui arrive avant le moindre clic reste
// muette. On "réveille" le contexte dès la toute première interaction, bien
// avant qu'une vraie notification n'arrive, plutôt que d'attendre ce moment-là.
if (typeof window !== 'undefined') {
  const reveiller = () => {
    getContext()?.resume();
    window.removeEventListener('pointerdown', reveiller);
    window.removeEventListener('keydown', reveiller);
  };
  window.addEventListener('pointerdown', reveiller, { once: true });
  window.addEventListener('keydown', reveiller, { once: true });
}

/**
 * Petit carillon à deux notes (navy → or), généré en Web Audio, pas de fichier
 * audio externe à charger — sert de signature sonore propre à l'application.
 */
export function playNotificationSound() {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const notes = [
    { freq: 880, start: 0, duration: 0.14 },
    { freq: 1318.5, start: 0.1, duration: 0.22 },
  ];

  notes.forEach(({ freq, start, duration }) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = freq;

    const startTime = ctx.currentTime + start;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.4, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  });
}
