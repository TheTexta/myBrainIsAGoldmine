import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { constrainFloat, gallerySize, overlapsPost, stepFloat, type FloatingImage } from '../../src/lib/floating-images';
import { floatingMediaDescriptions } from '../../src/lib/floating-media-descriptions';

const particle = (changes: Partial<FloatingImage> = {}): FloatingImage => ({ x: 10, y: 10, width: 30, height: 40, vx: 20, vy: 30, ...changes });
describe('floating image collisions', () => {
    it('reflects at all four document boundaries', () => {
        const left = particle({ x: -1, vx: -20 }), right = particle({ x: 980 });
        const top = particle({ y: -1, vy: -30 }), bottom = particle({ y: 9990 });
        for (const item of [left, right, top, bottom]) expect(constrainFloat(item, 1000, 10000, [])).toBe(true);
        expect([left.x, left.vx, right.x, right.vx]).toEqual([0, 20, 970, -20]);
        expect([top.y, top.vy, bottom.y, bottom.vy]).toEqual([0, 30, 9960, -30]);
    });
    it('bounces off the left and right edges of a post with clearance', () => {
        const post = { x: 100, y: 0, width: 200, height: 1000 };
        const left = particle({ x: 64 }), right = particle({ x: 306, vx: -20 });
        expect(stepFloat(left, 0.05, 500, 1000, [post])).toBe(true);
        expect(stepFloat(right, 0.05, 500, 1000, [post])).toBe(true);
        expect([left.x, left.vx, right.x, right.vx]).toEqual([64, -20, 306, 20]);
        expect(overlapsPost(left, post)).toBe(false); expect(overlapsPost(right, post)).toBe(false);
    });
    it('bounces off the top and bottom edges of a post', () => {
        const post = { x: 0, y: 100, width: 500, height: 200 };
        const top = particle({ y: 54 }), bottom = particle({ y: 306, vy: -30 });
        stepFloat(top, 0.05, 500, 600, [post]); stepFloat(bottom, 0.05, 500, 600, [post]);
        expect([top.y, top.vy, bottom.y, bottom.vy]).toEqual([54, -30, 306, 30]);
    });
    it('does not push an image into an adjacent, zero-margin post', () => {
        const posts = [{ x: 100, y: 0, width: 200, height: 200 }, { x: 100, y: 200, width: 200, height: 200 }];
        const image = particle({ x: 120, y: 190 });
        expect(constrainFloat(image, 500, 600, posts)).toBe(true);
        expect(posts.some((post) => overlapsPost(image, post))).toBe(false);
    });
    it('caps long frame gaps and reports when no clear area exists', () => {
        const image = particle(); stepFloat(image, 100, 1000, 10000, []);
        expect([image.x, image.y]).toEqual([11, 11.5]);
        expect(constrainFloat(particle(), 100, 100, [{ x: 0, y: 0, width: 100, height: 100 }])).toBe(false);
    });
    it('keeps normal and expanded gallery photos proportional and inside viewport bounds', () => {
        for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
            for (const aspect of [0.315, 0.5625, 0.75, 1.5]) {
                const normal = gallerySize(aspect, width, height, false), expanded = gallerySize(aspect, width, height, true);
                expect(normal.width / normal.height).toBeCloseTo(aspect, 10);
                expect(expanded.width / expanded.height).toBeCloseTo(aspect, 10);
                expect(expanded.width).toBeGreaterThan(normal.width);
                expect(expanded.width).toBeLessThanOrEqual(width - 32);
                expect(expanded.height).toBeLessThanOrEqual(height - 32);
            }
        }
    });
    it('does not add peer collisions to gallery movement', () => {
        const a = particle({ x: 100, y: 100, vx: 20, vy: 0 }), b = particle({ x: 100, y: 100, vx: -20, vy: 0 });
        stepFloat(a, 0.05, 500, 500, []); stepFloat(b, 0.05, 500, 500, []);
        expect([a.x, b.x, a.vx, b.vx]).toEqual([101, 99, 20, -20]);
    });
    it('tracks the owner-supplied photos, animated GIF, and muted video web copies', async () => {
        const root = 'src/assets/floating-images';
        const manifest = JSON.parse(await readFile(`${root}/provenance.json`, 'utf8'));
        expect(manifest.source).toMatch(/Owner-supplied/);
        expect(manifest.items).toHaveLength(16);
        expect(manifest.items.filter((item: { kind: string }) => item.kind === 'image')).toHaveLength(14);
        for (const image of manifest.items) {
            expect(floatingMediaDescriptions[image.id]?.length).toBeGreaterThan(15);
            const bytes = await readFile(`${root}/${image.file}`);
            expect(createHash('sha256').update(bytes).digest('hex')).toBe(image.sha256);
            const metadata = await sharp(bytes).metadata();
            expect([metadata.width, metadata.height]).toEqual([image.width, image.height]);
            expect(metadata.exif).toBeUndefined();
            expect(Math.max(metadata.width!, metadata.height!)).toBeLessThanOrEqual(1600);
            if (image.kind === 'gif') {
                const bytes = await readFile(`public/floating-media/${image.animatedFile}`);
                expect(createHash('sha256').update(bytes).digest('hex')).toBe(image.animatedSha256);
                const animation = await sharp(bytes, { animated: true }).metadata();
                expect(animation.pages).toBe(image.frames); expect(animation.delay).toEqual(image.delays); expect(animation.loop).toBe(image.loop);
            }
            if (image.kind === 'video') {
                const bytes = await readFile(`public/floating-media/${image.videoFile}`);
                expect(createHash('sha256').update(bytes).digest('hex')).toBe(image.videoSha256);
                expect(bytes.subarray(4, 8).toString()).toBe('ftyp'); expect(image.audio).toBe(false);
            }
        }
    });
});
