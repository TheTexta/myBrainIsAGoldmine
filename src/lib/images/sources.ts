import notes from '../../../public/img_3134.png';
import crying from '../../../public/pen_n_cry.jpg';
import messages from '../../../public/Image 3132.png';
import inspired from '../../../public/so_inspired_thou.png';
import mirrorBase from '../../../public/mirror_base.png';
import mirrorScreen from '../../../public/mirror_screen.png';
import collageFront from '../../../public/12-1.png';
import collageBack from '../../../public/12-2.png';
import cafe from '../../../public/3.png';

// Real filesystem imports give Astro metadata without moving/copying originals.
// Keep public URLs as archival/recovery sources; do not change original bytes.
export const localImages = new Map([
    ['img_3134.png', notes], ['pen_n_cry.jpg', crying], ['Image 3132.png', messages],
    ['so_inspired_thou.png', inspired], ['mirror_base.png', mirrorBase],
    ['mirror_screen.png', mirrorScreen], ['12-1.png', collageFront],
    ['12-2.png', collageBack], ['3.png', cafe],
]);
export { mirrorBase, mirrorScreen, collageFront, collageBack, cafe };
