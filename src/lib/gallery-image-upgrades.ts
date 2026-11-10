interface PendingImage { image: HTMLImageElement; pixels: number; frame: number; }
interface ImageState { srcset: string; fallback: string; loadedPixels: number; pending?: PendingImage; }

export function createGalleryImageUpgrades(isSelected: (photo: HTMLElement) => boolean) {
    const states = new Map<HTMLElement, ImageState>();
    let disposed = false;

    function cancel(state: ImageState) {
        const pending = state.pending;
        if (!pending) return;
        state.pending = undefined;
        cancelAnimationFrame(pending.frame);
        pending.image.remove();
        pending.image.removeAttribute('srcset'); pending.image.removeAttribute('src');
    }

    function update(photo: HTMLElement, width: number) {
        if (disposed) return;
        let state = states.get(photo);
        if (!isSelected(photo)) { if (state) cancel(state); return; }
        const current = photo.querySelector('img');
        // GIF/video keep their existing animation and still-fallback handling.
        if (!current || (!state && !current.srcset)) return;
        if (!state) {
            state = { srcset: current.srcset, fallback: current.src, loadedPixels: 0 };
            states.set(photo, state);
        }
        const pixels = Math.ceil(width * window.devicePixelRatio);
        if (pixels <= state.loadedPixels || (state.pending && pixels <= state.pending.pixels)) return;
        cancel(state);
        const next = current.cloneNode(false) as HTMLImageElement;
        next.decoding = 'sync'; next.sizes = `${Math.ceil(width)}px`;
        next.srcset = state.srcset; next.src = state.fallback;
        const pending: PendingImage = { image: next, pixels, frame: 0 };
        state.pending = pending;
        const valid = () => !disposed && state!.pending === pending && isSelected(photo) && photo.isConnected && current.isConnected;
        const abandon = () => { if (state!.pending === pending) cancel(state!); };

        void (async () => {
            try {
                // Never mutate sizes/srcset on the visible image: WebKit can
                // briefly discard its bitmap while an uncached candidate loads.
                await next.decode();
                if (!valid()) { abandon(); return; }
                const source = next.currentSrc || next.src;
                if (source === current.currentSrc && !current.srcset) {
                    state!.loadedPixels = pixels; abandon(); return;
                }
                // Lock the decoded candidate so a later responsive selection
                // cannot start another unguarded swap on the visible element.
                next.removeAttribute('srcset'); next.removeAttribute('sizes'); next.src = source;
                await next.decode();
                if (!valid()) { abandon(); return; }
                next.style.position = 'absolute'; next.style.inset = '0';
                photo.append(next);
                // Retain the previous bitmap beneath the decoded replacement
                // through a presentation frame; no opacity/fade or motion pause.
                pending.frame = requestAnimationFrame(() => {
                    pending.frame = requestAnimationFrame(() => {
                        if (!valid()) { abandon(); return; }
                        current.remove(); state!.loadedPixels = pixels; state!.pending = undefined;
                    });
                });
            } catch { abandon(); /* Keep the displayed bitmap on load/decode failure. */ }
        })();
    }

    return {
        update,
        dispose() { disposed = true; states.forEach(cancel); states.clear(); },
    };
}
