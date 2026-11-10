import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { overlayResolution } from '../../src/lib/crt-overlay';

describe('CRT overlay', () => {
    it('caps pixel ratio and total framebuffer area', () => {
        expect(overlayResolution(390, 844, 3)).toEqual([585, 1266]);
        const [width, height] = overlayResolution(3840, 2160, 2);
        expect(width * height).toBeLessThanOrEqual(2_000_000);
        expect(overlayResolution(0, 0, 1)).toEqual([1, 1]);
    });
    it('preserves the original GIF and supplies a matching reduced-motion still', async () => {
        const source = await readFile('public/glitter.gif');
        const provenance = JSON.parse(await readFile('public/crt/provenance.json', 'utf8'));
        expect(createHash('sha256').update(source).digest('hex')).toBe(provenance.sha256);
        const expected = await sharp(source).flatten({ background: '#000' }).raw().toBuffer();
        expect((await sharp('public/crt/glitter-still.png').raw().toBuffer()).equals(expected)).toBe(true);
    });
});
