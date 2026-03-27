import confetti from 'canvas-confetti';

export function triggerConfetti() {
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'],
  });
}

export function triggerMiniConfetti(x, y) {
  confetti({
    particleCount: 30,
    spread: 40,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
    colors: ['#6366f1', '#8b5cf6', '#a78bfa'],
  });
}
