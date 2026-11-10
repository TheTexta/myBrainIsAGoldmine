// Spatial CRT treatment adapted from TVM Archive's lib/crt-screen.ts.
// Timothy Lottes' PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER:
// https://www.shadertoy.com/view/XsjSzR
// https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl
// The foreground stays native DOM: this is a transparent scanline/phosphor
// overlay, not footage reconstruction or a capture/warp of the whole document.
export const crtVertexShader = `#version 300 es
in vec2 position;
out vec2 screenUv;
void main() {
    screenUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}`;

export const crtFragmentShader = `#version 300 es
precision highp float;
uniform vec2 viewport;
in vec2 screenUv;
out vec4 outputColor;
float gaussian(float distance, float hardness) { return exp2(hardness * distance * distance); }
vec3 displayLight(vec3 value) {
    return mix(value * 12.92, 1.055 * pow(value, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), value));
}
void main() {
    vec2 aperture = vec2(screenUv.x, 1.0 - screenUv.y) * 2.0 - 1.0;
    vec2 warped = aperture * (1.0 + vec2(0.008, 0.012) * aperture.yx * aperture.yx);
    vec2 pixel = (warped * 0.5 + 0.5) * viewport;
    float raster = pixel.y / 2.0;
    float visibility = 1.0 - smoothstep(0.4, 1.0, fwidth(raster));
    float distance = 0.5 - fract(raster);
    float beam = 1.05 * (gaussian(distance - 1.0, -5.0)
        + gaussian(distance, -5.0) + gaussian(distance + 1.0, -5.0));
    float lines = mix(1.0, min(1.0, beam), visibility * 0.8);
    float maskVisibility = 1.0 - smoothstep(0.5, 1.0, fwidth(pixel.x / 2.0));
    vec3 mask = 1.0 + 0.12 * cos(6.2831853 * (
        pixel.x / 6.0 + vec3(0.0, -1.0 / 3.0, -2.0 / 3.0)));
    // Multiply blending attenuates the real page instead of covering it with
    // opaque glitter. Nothing is sampled from or substituted for its content.
    // Match the browser compositor's premultiplied backing store. Converting a
    // straight-alpha accelerated surface is unreliable in some Safari versions.
    vec3 color = displayLight(clamp(lines * mix(vec3(1.0), mask, maskVisibility), 0.0, 1.0));
    outputColor = vec4(color * 0.8, 0.8);
}`;

export function overlayResolution(width: number, height: number, pixelRatio: number) {
    const scale = Math.min(pixelRatio || 1, 1.5, Math.sqrt(2_000_000 / Math.max(1, width * height)));
    return [Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale))] as const;
}
