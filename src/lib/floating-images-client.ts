import { constrainFloat, stepFloat, type FloatingImage, type FloatRect } from './floating-images';

export function mountFloatingImages(layer: HTMLElement) {
    const photos = [...layer.querySelectorAll<HTMLElement>('[data-floating-image]')];
    const blocks = [...document.querySelectorAll<HTMLElement>('.feed-container > .content')];
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const dataSaver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const animated = photos.map((photo) => ({ photo, video: photo.querySelector<HTMLVideoElement>('video'), still: photo.querySelector<HTMLSourceElement>('[data-animated-still]') }))
        .filter((item) => item.video || item.still);
    const visible = new Set<HTMLElement>();
    const playback = new WeakMap<HTMLVideoElement, boolean>();
    const particles: FloatingImage[] = photos.map((_, index) => ({ x: 0, y: 0, width: 0, height: 0, vx: (index % 2 ? -1 : 1) * (12 + index * 2), vy: (index % 3 ? 1 : -1) * (14 + index * 2) }));
    let width = 0, height = 0;
    let posts: FloatRect[] = [];
    let room = false, dirty = true, disposed = false, paused = false;
    let staticLayout = reducedMotion.matches || Boolean(dataSaver);
    let animation = 0, previous = 0;

    function syncMedia() {
        const canAnimate = room && !disposed && !paused && !document.hidden && !reducedMotion.matches && !dataSaver && !document.querySelector('dialog[open]');
        for (const { photo, video, still } of animated) {
            const active = Boolean(canAnimate && visible.has(photo) && !photo.hidden);
            if (still) {
                const media = active ? '(prefers-reduced-motion: reduce)' : 'all';
                if (still.media !== media) still.media = media;
            }
            if (video && playback.get(video) !== active) {
                playback.set(video, active); video.muted = true;
                if (active) void video.play().catch(() => { /* Decorative poster remains if autoplay is unavailable. */ });
                else video.pause();
            }
        }
    }
    const mediaVisibility = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target as HTMLElement);
            else visible.delete(entry.target as HTMLElement);
        }
        syncMedia();
    });

    function stop() { cancelAnimationFrame(animation); animation = 0; previous = 0; }
    function requestFrame() {
        if (!disposed && !paused && !document.hidden && !animation) animation = requestAnimationFrame(paint);
    }
    function layoutChanged() { dirty = true; requestFrame(); }
    function measure() {
        dirty = false;
        const oldWidth = width, oldHeight = height;
        width = document.documentElement.clientWidth;
        // The absolutely positioned layer is out of flow: body height measures
        // content, without feeding the layer's own height back into its bounds.
        height = Math.max(window.innerHeight, document.body.offsetHeight);
        layer.style.height = `${height}px`; layer.style.width = `${width}px`;
        const rectangles = blocks.map((block) => { const rect = block.getBoundingClientRect(); return { x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height }; });
        posts = rectangles;
        const gutter = rectangles.length ? Math.max(0, Math.min(...rectangles.map((rect) => Math.min(rect.x, width - rect.x - rect.width)))) : width / 4;
        room = gutter >= 28;
        if (!room) { syncMedia(); return; }
        particles.forEach((particle, index) => {
            const aspect = Number(photos[index].dataset.aspect);
            const nextWidth = Math.min(144, gutter - 12, Math.min(176, height * 0.22) * aspect);
            const nextHeight = nextWidth / aspect;
            // A deliberate static layout must not depend on font/image load order.
            if (!particle.width || staticLayout) {
                const laneX = index % 2 ? width - gutter : 0;
                particle.x = laneX + 6 + Math.max(0, gutter - nextWidth - 12) * ((index * 0.618 + 0.2) % 1);
                particle.y = index === 0 ? Math.min((height - nextHeight) * 0.03, window.innerHeight * 0.3)
                    : (height - nextHeight) * ((index + 0.5) / particles.length);
            } else if (width !== oldWidth || height !== oldHeight) {
                particle.x = particle.x / Math.max(1, oldWidth - particle.width) * (width - nextWidth);
                particle.y = particle.y / Math.max(1, oldHeight - particle.height) * (height - nextHeight);
            }
            particle.width = nextWidth; particle.height = nextHeight;
            photos[index].style.width = `${nextWidth}px`; photos[index].style.height = `${nextHeight}px`;
        });
    }
    function paint(now: number) {
        animation = 0;
        if (disposed || paused || document.hidden) return;
        // The media query can change before its change event is delivered.
        // Seed the static layout before exposing the first static frame.
        const nextStaticLayout = reducedMotion.matches || Boolean(dataSaver);
        if (nextStaticLayout !== staticLayout) { staticLayout = nextStaticLayout; dirty = true; }
        if (dirty) measure();
        const moving = !staticLayout && !document.querySelector('dialog[open]');
        const delta = previous ? (now - previous) / 1000 : 0; previous = now;
        layer.hidden = !room;
        const state = !room ? 'no-room' : moving ? 'moving' : 'static';
        if (layer.dataset.motion !== state) layer.dataset.motion = state;
        if (!room) return;
        particles.forEach((particle, index) => {
            const clear = moving ? stepFloat(particle, delta, width, height, posts) : constrainFloat(particle, width, height, posts);
            photos[index].hidden = !clear;
            photos[index].style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0)`;
        });
        syncMedia();
        if (moving) requestFrame();
    }
    function visibility() {
        stop();
        if (document.hidden) layer.dataset.motion = 'paused';
        else layoutChanged();
        syncMedia();
    }
    function motionChanged() { stop(); layoutChanged(); syncMedia(); }
    function pageHide(event: PageTransitionEvent) {
        if (event.persisted) { paused = true; stop(); syncMedia(); } else dispose();
    }
    function pageShow(event: PageTransitionEvent) {
        if (event.persisted) { paused = false; layoutChanged(); }
    }
    const sizes = new ResizeObserver(layoutChanged);
    const dialogs = new MutationObserver((records) => {
        if (records.some((record) => record.target instanceof HTMLDialogElement)) motionChanged();
    });
    function dispose() {
        if (disposed) return;
        disposed = true; stop(); sizes.disconnect(); dialogs.disconnect(); mediaVisibility.disconnect(); syncMedia();
        window.removeEventListener('resize', layoutChanged);
        window.removeEventListener('pagehide', pageHide); window.removeEventListener('pageshow', pageShow);
        document.removeEventListener('visibilitychange', visibility); reducedMotion.removeEventListener('change', motionChanged);
    }
    blocks.forEach((block) => sizes.observe(block));
    sizes.observe(document.body);
    animated.forEach(({ photo }) => mediaVisibility.observe(photo));
    dialogs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
    window.addEventListener('resize', layoutChanged);
    window.addEventListener('pagehide', pageHide); window.addEventListener('pageshow', pageShow);
    document.addEventListener('visibilitychange', visibility); reducedMotion.addEventListener('change', motionChanged);
    paint(performance.now());
    return dispose;
}
