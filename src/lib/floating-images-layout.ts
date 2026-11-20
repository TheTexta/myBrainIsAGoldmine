import { constrainFloat, gallerySize, type FloatingImage, type FloatRect } from './floating-images';

interface Dimensions { width: number; height: number; }
export function layoutGalleryImages(bounds: Dimensions, previous: Dimensions, aspects: number[], particles: FloatingImage[], expanded: number | null) {
    const { width, height } = bounds;
    return { room: width > 0 && height > 0, particles: particles.map((prior, index) => {
        const particle = { ...prior };
        const size = gallerySize(aspects[index], width, height, expanded === index);
        if (!particle.width) {
            particle.x = (width - size.width) / 2; particle.y = (height - size.height) / 2;
        } else if (width !== previous.width || height !== previous.height || particle.width !== size.width || particle.height !== size.height) {
            const centerX = (particle.x + particle.width / 2) / previous.width * width;
            const centerY = (particle.y + particle.height / 2) / previous.height * height;
            particle.x = centerX - size.width / 2; particle.y = centerY - size.height / 2;
        }
        Object.assign(particle, size); constrainFloat(particle, width, height, []);
        return particle;
    }) };
}

export function layoutFeedImages(bounds: Dimensions, previous: Dimensions, viewportHeight: number, posts: FloatRect[], aspects: number[], particles: FloatingImage[], staticLayout: boolean) {
    const { width, height } = bounds;
    const gutter = posts.length ? Math.max(0, Math.min(...posts.map((rect) => Math.min(rect.x, width - rect.x - rect.width)))) : width / 4;
    const room = gutter >= 28;
    return { room, particles: particles.map((prior, index) => {
        const particle = { ...prior };
        if (!room) return particle;
        const aspect = aspects[index];
        const nextWidth = Math.min(144, gutter - 12, Math.min(176, height * 0.22) * aspect);
        const nextHeight = nextWidth / aspect;
        // Static positions must not depend on font/image load order.
        if (!particle.width || staticLayout) {
            const laneX = index % 2 ? width - gutter : 0;
            particle.x = laneX + 6 + Math.max(0, gutter - nextWidth - 12) * ((index * 0.618 + 0.2) % 1);
            particle.y = index === 0 ? Math.min((height - nextHeight) * 0.03, viewportHeight * 0.3)
                : (height - nextHeight) * ((index + 0.5) / particles.length);
        } else if (width !== previous.width || height !== previous.height) {
            particle.x = particle.x / Math.max(1, previous.width - particle.width) * (width - nextWidth);
            particle.y = particle.y / Math.max(1, previous.height - particle.height) * (height - nextHeight);
        }
        particle.width = nextWidth; particle.height = nextHeight;
        return particle;
    }) };
}
