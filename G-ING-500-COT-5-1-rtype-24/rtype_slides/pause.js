// Shared pause support for animated slides.
// Press P (in the slide, or in main.html which forwards it) to freeze / resume
// every CSS + Web Animation and every sleep() timer on the slide.

let paused = false;

// Pause-aware sleep: only counts time while the slide is running.
function sleep(ms) {
    return new Promise(resolve => {
        let left = ms;
        let last = performance.now();
        (function tick(now) {
            if (!paused) left -= now - last;
            last = now;
            if (left <= 0) resolve();
            else requestAnimationFrame(tick);
        })(last);
    });
}

function togglePause() {
    paused = !paused;
    document.getAnimations().forEach(a => (paused ? a.pause() : a.play()));
    badge.style.display = paused ? 'flex' : 'none';
}

const badge = document.createElement('div');
badge.textContent = '❚❚ paused';
Object.assign(badge.style, {
    position: 'fixed', top: '3vh', left: '50%', transform: 'translateX(-50%)',
    display: 'none', alignItems: 'center', padding: '0.6vh 1.2vw',
    background: '#FF4400', color: '#fff', borderRadius: '6px', zIndex: 100,
    font: '700 1.1vw "JetBrains Mono", monospace', letterSpacing: '0.1em',
});
document.addEventListener('DOMContentLoaded', () => document.body.appendChild(badge));

document.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;   // typing in a field
    if (e.key === 'p' || e.key === 'P') togglePause();
    // focus is inside the slide (e.g. after a click): hand navigation back to main.html
    if (e.key === 'ArrowRight' || e.key === ' ') parent.postMessage({ nav: 1 }, '*');
    if (e.key === 'ArrowLeft') parent.postMessage({ nav: -1 }, '*');
});
window.addEventListener('message', e => {
    if (e.data === 'toggle-pause') togglePause();
});
