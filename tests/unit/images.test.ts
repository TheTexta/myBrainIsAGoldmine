import { describe, expect, it } from 'vitest';
import { responsiveWidths, wordpressImages } from '../../src/lib/images/settings';

describe('responsive image settings', () => {
    it('offers bounded widths without upscaling small sources', () => {
        expect(responsiveWidths(96)).toEqual([96]);
        expect(responsiveWidths(924)).toEqual([160, 240, 320, 480, 640, 924]);
        expect(responsiveWidths(5712)).toEqual([160, 240, 320, 480, 640, 960, 1280, 1920]);
    });
    it('uses measured dimensions for exactly the existing sixteen remote images', () => {
        expect(wordpressImages.size).toBe(16);
        for (const [url, dimensions] of wordpressImages) {
            expect(url).toMatch(/^https:\/\/uwannastealmgswag\.art\.blog\/wp-content\/uploads\//);
            expect(dimensions.width).toBeGreaterThan(0);
            expect(dimensions.height).toBeGreaterThan(0);
        }
    });
});
