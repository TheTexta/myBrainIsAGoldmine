import { describe, expect, it } from 'vitest';
import { glitterOffset } from '../../src/lib/glitter-parallax';

describe('glitter parallax', () => {
    it.each([0, 300, 600, -300])('moves the background at two-thirds document speed for scroll %s', (scroll) => {
        expect(-scroll + glitterOffset(scroll, false)).toBeCloseTo(-scroll * 2 / 3, 10);
    });
    it('keeps ordinary scrolling under reduced motion', () => {
        expect(glitterOffset(900, true)).toBe(0);
    });
});
