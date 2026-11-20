import { describe, expect, it } from 'vitest';
import { layoutFeedImages, layoutGalleryImages } from '../../src/lib/floating-images-layout';
import { constrainFloat, overlapsPost, type FloatingImage } from '../../src/lib/floating-images';

const fresh = (): FloatingImage => ({ x: 0, y: 0, width: 0, height: 0, vx: 20, vy: -30 });
describe('measured floating image layouts', () => {
    it('centres new gallery images without mutating prior particles', () => {
        const prior = [fresh(), fresh()];
        const layout = layoutGalleryImages({ width: 1000, height: 800 }, { width: 0, height: 0 }, [1, 2], prior, null);
        expect(layout.room).toBe(true);
        expect(layout.particles[0]).toEqual({ x: 364, y: 264, width: 272, height: 272, vx: 20, vy: -30 });
        expect(layout.particles[1]).toMatchObject({ x: 360, y: 330, width: 280, height: 140 });
        expect(prior).toEqual([fresh(), fresh()]);
    });
    it('expands one gallery image around its centre and preserves velocity', () => {
        const bounds = { width: 1000, height: 800 };
        const initial = layoutGalleryImages(bounds, { width: 0, height: 0 }, [1, 1], [fresh(), fresh()], null);
        const expanded = layoutGalleryImages(bounds, bounds, [1, 1], initial.particles, 0);
        expect(expanded.particles[0]).toMatchObject({ x: 116, y: 16, width: 768, height: 768, vx: 20, vy: -30 });
        expect(expanded.particles[1]).toEqual(initial.particles[1]);
        const collapsed = layoutGalleryImages(bounds, bounds, [1, 1], expanded.particles, null);
        expect(collapsed).toEqual(initial);
    });
    it('rescales gallery centres on resize and clamps enlarged photos to viewport edges', () => {
        const layout = layoutGalleryImages({ width: 400, height: 300 }, { width: 1000, height: 800 }, [2], [{ x: 800, y: 650, width: 200, height: 100, vx: 20, vy: 30 }], 0);
        const photo = layout.particles[0];
        expect(photo.x).toBeGreaterThanOrEqual(0); expect(photo.x + photo.width).toBeLessThanOrEqual(400);
        expect(photo.y).toBeGreaterThanOrEqual(0); expect(photo.y + photo.height).toBeLessThanOrEqual(300);
        expect(photo.vx).toBe(-20); expect(photo.vy).toBe(-30);
        expect(layoutGalleryImages({ width: 0, height: 0 }, { width: 0, height: 0 }, [1], [fresh()], null).room).toBe(false);
    });
    it('uses full document height and measured post coordinates, not viewport rebasing', () => {
        const bounds = { width: 1000, height: 4000 };
        const posts = [{ x: 200, y: 1000, width: 600, height: 2000 }];
        const layout = layoutFeedImages(bounds, { width: 0, height: 0 }, 800, posts, [1, 1], [fresh(), fresh()], false);
        expect(layout.room).toBe(true);
        expect(layout.particles[0]).toMatchObject({ width: 144, height: 144 });
        expect(layout.particles[0].x).toBeCloseTo(14.8); expect(layout.particles[0].y).toBeCloseTo(115.68);
        expect(layout.particles[1].y).toBe(2892);
        for (const photo of layout.particles) {
            expect(constrainFloat(photo, bounds.width, bounds.height, posts)).toBe(true);
            expect(overlapsPost(photo, posts[0])).toBe(false);
        }
        expect(layoutFeedImages(bounds, bounds, 800, posts, [1, 1], layout.particles, false).particles).toEqual(layout.particles);
    });
    it('reseeds static mode independently of prior animation and load order', () => {
        const bounds = { width: 1000, height: 4000 }, posts = [{ x: 200, y: 100, width: 600, height: 3000 }];
        const initial = layoutFeedImages(bounds, { width: 0, height: 0 }, 800, posts, [1], [fresh()], true);
        const moved = [{ ...initial.particles[0], x: 50, y: 3000 }];
        expect(layoutFeedImages(bounds, bounds, 800, posts, [1], moved, true)).toEqual(initial);
    });
    it('rescales feed positions on document resize and preserves particles when gutters disappear', () => {
        const prior = [{ x: 100, y: 200, width: 100, height: 100, vx: 20, vy: -30 }];
        const layout = layoutFeedImages({ width: 1200, height: 2400 }, { width: 1000, height: 2000 }, 800, [], [1], prior, false);
        expect(layout.particles[0].x).toBeCloseTo(100 / 900 * 1056);
        expect(layout.particles[0].y).toBeCloseTo(200 / 1900 * 2256);
        const noRoom = layoutFeedImages({ width: 400, height: 2000 }, { width: 1000, height: 2000 }, 800, [{ x: 20, y: 100, width: 360, height: 1000 }], [1], prior, false);
        expect(noRoom).toEqual({ room: false, particles: prior });
        expect(prior[0]).toMatchObject({ x: 100, y: 200, width: 100, height: 100 });
    });
});
