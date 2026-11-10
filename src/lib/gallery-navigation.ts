export function mountGalleryNavigation() {
    function navigate(event: MouseEvent) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || window.getSelection()?.type === 'Range') return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        // The inert floating media let clicks through to these exact background
        // surfaces. Never hijack post content, links, header, cat or dialog clicks.
        if (target === document.body || target === document.documentElement || target.matches('.feed-container, body.reading-page > footer')) {
            window.location.assign('/gallery');
        }
    }
    function dispose(event: PageTransitionEvent) {
        if (!event.persisted) { document.removeEventListener('click', navigate); window.removeEventListener('pagehide', dispose); }
    }
    document.addEventListener('click', navigate);
    window.addEventListener('pagehide', dispose);
}
