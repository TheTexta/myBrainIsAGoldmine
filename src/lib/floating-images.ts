export interface FloatRect { x: number; y: number; width: number; height: number; }
export interface FloatingImage extends FloatRect { vx: number; vy: number; }

const clearance = 6;
export function overlapsPost(image: FloatRect, post: FloatRect) {
    return image.x + image.width > post.x - clearance + 0.001 && image.x < post.x + post.width + clearance - 0.001 &&
        image.y + image.height > post.y - clearance + 0.001 && image.y < post.y + post.height + clearance - 0.001;
}

// Resolve against all blocks, so a scroll/resize cannot push a photo out of one
// post and into the next contiguous post. Only a clear, on-screen position wins.
export function constrainFloat(image: FloatingImage, width: number, height: number, posts: FloatRect[]) {
    const maxX = width - image.width, maxY = height - image.height;
    if (maxX < 0 || maxY < 0) return false;
    if (image.x < 0) { image.x = 0; image.vx = Math.abs(image.vx); }
    if (image.x > maxX) { image.x = maxX; image.vx = -Math.abs(image.vx); }
    if (image.y < 0) { image.y = 0; image.vy = Math.abs(image.vy); }
    if (image.y > maxY) { image.y = maxY; image.vy = -Math.abs(image.vy); }
    const hits = posts.filter((post) => overlapsPost(image, post));
    if (!hits.length) return true;
    const candidates = hits.flatMap((post) => [
        { x: post.x - image.width - clearance, y: image.y, axis: 'x', direction: -1 },
        { x: post.x + post.width + clearance, y: image.y, axis: 'x', direction: 1 },
        { x: image.x, y: post.y - image.height - clearance, axis: 'y', direction: -1 },
        { x: image.x, y: post.y + post.height + clearance, axis: 'y', direction: 1 },
    ]).filter((point) => point.x >= 0 && point.x <= maxX && point.y >= 0 && point.y <= maxY &&
        !posts.some((post) => overlapsPost({ ...image, ...point }, post)))
        .sort((a, b) => Math.hypot(a.x - image.x, a.y - image.y) - Math.hypot(b.x - image.x, b.y - image.y));
    const next = candidates[0];
    if (!next) return false;
    image.x = next.x; image.y = next.y;
    if (next.axis === 'x') image.vx = Math.abs(image.vx) * next.direction;
    else image.vy = Math.abs(image.vy) * next.direction;
    return true;
}

export function stepFloat(image: FloatingImage, elapsed: number, width: number, height: number, posts: FloatRect[]) {
    const delta = Math.min(0.05, Math.max(0, elapsed));
    image.x += image.vx * delta; image.y += image.vy * delta;
    return constrainFloat(image, width, height, posts);
}

export function gallerySize(aspect: number, width: number, height: number, expanded: boolean) {
    const inset = Math.min(16, width / 8, height / 8);
    const maxWidth = expanded ? Math.min(960, width - inset * 2) : Math.min(280, width * 0.32);
    const maxHeight = expanded ? height - inset * 2 : Math.min(300, height * 0.34);
    const imageWidth = Math.min(maxWidth, maxHeight * aspect);
    return { width: imageWidth, height: imageWidth / aspect };
}
