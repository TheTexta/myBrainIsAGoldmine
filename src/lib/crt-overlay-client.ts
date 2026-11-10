import { crtFragmentShader, crtVertexShader, overlayResolution } from './crt-overlay';

export function mountCrtOverlay(canvas: HTMLCanvasElement) {
    const hints = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (hints.connection?.saveData || new URLSearchParams(location.search).get('crt') === 'off') {
        canvas.dataset.crt = 'off'; return;
    }
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) { canvas.dataset.crt = 'off'; return; }
    const shaders: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let viewport: WebGLUniformLocation | null = null;
    let disposed = false;
    let ready = false;
    let paused = false;
    let animation = 0;

    function stop() { cancelAnimationFrame(animation); animation = 0; }
    function requestDraw() {
        if (ready && !disposed && !paused && !document.hidden && !animation) animation = requestAnimationFrame(draw);
    }
    function draw() {
        animation = 0;
        if (!ready || disposed || paused || document.hidden) return;
        const bounds = canvas.getBoundingClientRect();
        const [width, height] = overlayResolution(bounds.width, bounds.height, devicePixelRatio);
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        gl!.viewport(0, 0, width, height);
        gl!.uniform2f(viewport, bounds.width, bounds.height);
        gl!.drawArrays(gl!.TRIANGLES, 0, 3);
        canvas.dataset.crt = 'lottes';
    }
    function bringToFront() {
        if (disposed || !ready) return;
        // Safari can composite accelerated popovers without their multiply
        // backdrop. Keep the canvas in the page's ordinary compositing group;
        // move it into a native dialog when that dialog owns the top layer.
        const host = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1) ?? document.body;
        if (canvas.parentElement !== host) host.append(canvas);
        requestDraw();
    }
    const dialogs = new MutationObserver((records) => {
        if (records.some((record) => record.target instanceof HTMLDialogElement)) bringToFront();
    });
    function visibility() { stop(); if (!document.hidden) requestDraw(); }
    function pageHide(event: PageTransitionEvent) {
        if (event.persisted) { paused = true; stop(); } else dispose();
    }
    function pageShow(event: PageTransitionEvent) {
        if (event.persisted) { paused = false; bringToFront(); }
    }
    function contextLost(event: Event) { event.preventDefault(); dispose(); }
    function dispose() {
        if (disposed) return;
        disposed = true; stop(); dialogs.disconnect();
        canvas.hidden = true; canvas.dataset.crt = 'off';
        window.removeEventListener('resize', requestDraw);
        window.removeEventListener('pagehide', pageHide);
        window.removeEventListener('pageshow', pageShow);
        document.removeEventListener('visibilitychange', visibility);
        document.removeEventListener('fullscreenchange', bringToFront);
        canvas.removeEventListener('webglcontextlost', contextLost);
        shaders.forEach((shader) => gl!.deleteShader(shader));
        gl!.deleteProgram(program); gl!.deleteBuffer(buffer);
    }
    try {
        for (const [type, source] of [[gl.VERTEX_SHADER, crtVertexShader], [gl.FRAGMENT_SHADER, crtFragmentShader]] as const) {
            const shader = gl.createShader(type);
            if (!shader) throw new Error('Shader unavailable.');
            shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader could not compile.');
        }
        program = gl.createProgram(); buffer = gl.createBuffer();
        if (!program || !buffer) throw new Error('Graphics resources unavailable.');
        shaders.forEach((shader) => gl.attachShader(program!, shader)); gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader could not link.');
        gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        viewport = gl.getUniformLocation(program, 'viewport');
        ready = true; canvas.hidden = false; bringToFront(); stop(); draw();
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Overlay drawing unavailable.');
        dialogs.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
        window.addEventListener('resize', requestDraw);
        window.addEventListener('pagehide', pageHide);
        window.addEventListener('pageshow', pageShow);
        document.addEventListener('visibilitychange', visibility);
        document.addEventListener('fullscreenchange', bringToFront);
        canvas.addEventListener('webglcontextlost', contextLost);
    } catch { dispose(); }
    return dispose;
}
