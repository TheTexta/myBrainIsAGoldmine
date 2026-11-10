import { parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5';
import { wordpressHost } from './images/settings';

// Descriptions checked against the original media. Presentation metadata only:
// the archived HTML, original files, and saved BlockNote documents stay intact.
const descriptions: Record<string, string> = {
    'so_inspired_thou.png': 'Notes app entry about feeling inspired by a live performer.',
    'img_3134.png': 'Notes app poem beginning “After we part,” about a goodbye and a bedroom mirror.',
    'pen_n_cry.jpg': 'Notes app entry about longing for closeness rather than sex.',
    'Image 3132.png': 'Notes app entry titled “July 30th 4:35,” reflecting on unreturned love.',
    '2025/05/img_2312.jpg?w=768': 'Person with blue hair wearing a green jacket and trousers in a white-framed bedroom mirror.',
    '2025/05/f1f01fc1-f337-4f5e-adb2-27b9feffd73e-1.jpg?w=590': 'Blue barrel with a Pizza Nova label beside a graffiti-covered wall.',
    '2025/06/image.jpg?w=261': 'Person carrying a patterned shoulder bag along a graffiti-covered alley.',
    '2025/05/2df3f1b9-2e49-453c-ae33-61f459d382ee-1.jpg?w=590': 'Weathered cartoon cat poster on a concrete utility pole.',
    '2025/06/77084474462__f2353835-f8b0-47a2-8ca8-719a8ac4fd7f.jpg?w=768': 'Orange cat viewed from below through glass, with a paw beside its face.',
    '2025/05/img_2285-1.png?w=473': 'Airbuds listening recap labeled “Interesting,” about finding songs before they become mainstream.',
    '2025/06/4707726d-c20e-47f3-aa5c-b3d8634cf181-1.jpg?w=576': 'Sideways mirror selfie with a bright camera flash.',
    '2025/05/img_2230.jpg?w=768': 'Concrete column in an art gallery, with a painting on the far wall.',
    '2025/06/image-1.jpg': 'Notes app entry reading “Sharing a bunk bed is an intimate experience.”',
    '2025/06/image-2.jpg': 'Notes app list titled “Things I want to make, devious edition.”',
    '2025/06/image-3.jpg': 'Notes app poem comparing a kiss to sugar and the bitterness of having loved someone.',
    '2025/06/image-4.jpg': 'Notes app passage about feeling seen, being listened to, and a smile filling cracks in the heart.',
    '2025/06/image-5.jpg': 'Notes app entry titled “Blair wench,” describing distress and thoughts of suicide.',
    '2025/06/img_2307.jpg': 'Open tin filled with cigarette butts beneath a graffiti-covered wall, with sneakers at the bottom.',
    '2025/06/img_2448-1.png': 'JPEGMAFIA shop listing for a black cap embroidered “MAKE EXPERIMENTAL RAP SEXY AGAIN.”',
    '2025/06/image-6.jpg': 'Messages about New England vampire folklore, ending with “I ramble” and “I listen.”',
};

export function imageAlternative(source: string, provided = ''): string {
    let known: string | undefined;
    try {
        const url = new URL(source, 'https://local.invalid');
        if (!/^(?:https?:)?\/\//i.test(source)) known = descriptions[decodeURIComponent(url.pathname.slice(1))];
        else if (url.hostname === wordpressHost) known = descriptions[url.pathname.replace(/^\/wp-content\/uploads\//, '') + url.search];
    } catch { /* An unknown URL still retains a supplied meaningful description. */ }
    const text = provided.trim();
    const generic = /^(?:photo|image|picture)$/i.test(text) || /\.(?:png|jpe?g|webp|gif)$/i.test(text);
    if ((!text || generic || /\b(?:photo|image|picture)\b/i.test(text)) && known) return known;
    if (generic) return '';
    return text.replace(/^(?:(?:a|an)\s+)?(?:photo|image|picture)(?:\s+of\s+|\s*:\s*)/i, '').trim();
}

export function accessiblePostMarkup(html: string, title: string): string {
    const fragment = parseFragment(html);
    const visit = (node: DefaultTreeAdapterMap['node']) => {
        if ('tagName' in node && node.tagName === 'img') {
            const source = node.attrs.find((attribute) => attribute.name === 'src')?.value ?? '';
            const alt = node.attrs.find((attribute) => attribute.name === 'alt');
            const value = imageAlternative(source, alt?.value);
            if (alt) alt.value = value;
            else node.attrs.push({ name: 'alt', value });
        }
        if ('tagName' in node && node.tagName === 'iframe' && !node.attrs.find((attribute) => attribute.name === 'title')?.value.trim()) {
            const existing = node.attrs.find((attribute) => attribute.name === 'title');
            const value = `Media player — ${title}`;
            if (existing) existing.value = value;
            else node.attrs.push({ name: 'title', value });
        }
        if ('childNodes' in node) node.childNodes.forEach(visit);
    };
    visit(fragment);
    return serialize(fragment);
}
