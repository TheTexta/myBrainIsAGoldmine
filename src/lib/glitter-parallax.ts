// A scrolling background already moves by -scrollY. Adding scrollY / 3 to
// its local position makes the net viewport movement exactly -2 * scrollY / 3.
export function glitterOffset(scrollY: number, reducedMotion: boolean) {
    return reducedMotion ? 0 : scrollY / 3;
}

export function mountGlitterParallax() {
    const body = document.body;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let animation = 0;
    let paused = false;
    let disposed = false;

    function stop() { cancelAnimationFrame(animation); animation = 0; }
    function update() {
        animation = 0;
        if (!disposed && !paused && !document.hidden) body.style.setProperty('--glitter-scroll-offset', `${glitterOffset(window.scrollY, reducedMotion.matches)}px`);
    }
    function schedule() {
        if (!disposed && !paused && !document.hidden && !animation) animation = requestAnimationFrame(update);
    }
    function visibility() { stop(); if (!document.hidden) update(); }
    function motionChanged() { stop(); update(); }
    function pageHide(event: PageTransitionEvent) {
        stop();
        if (event.persisted) paused = true;
        else dispose();
    }
    function pageShow() { paused = false; update(); }
    function dispose() {
        if (disposed) return;
        disposed = true; stop(); body.style.removeProperty('--glitter-scroll-offset');
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('pagehide', pageHide); window.removeEventListener('pageshow', pageShow);
        document.removeEventListener('visibilitychange', visibility); reducedMotion.removeEventListener('change', motionChanged);
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('pagehide', pageHide); window.addEventListener('pageshow', pageShow);
    document.addEventListener('visibilitychange', visibility); reducedMotion.addEventListener('change', motionChanged);
    update();
    return dispose;
}
