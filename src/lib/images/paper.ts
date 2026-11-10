import { getImage } from 'astro:assets';
import paper from '../../assets/textures/white-recycle-paper-texture.jpg';

export async function postPaperUrl() {
    return (await getImage({ src: paper, width: 1320, format: 'webp', quality: 85 })).src;
}
