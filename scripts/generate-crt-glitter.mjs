import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// Added derivatives only: never overwrite the archival GIF.
const source = await readFile('public/glitter.gif');
const metadata = await sharp(source, { animated: true }).metadata();
if (metadata.width !== 400 || metadata.pageHeight !== 400 || metadata.pages !== 3 ||
    metadata.loop !== 0 || metadata.delay?.length !== 3 || metadata.delay.some((delay) => delay !== 100)) {
    throw new Error('The glitter source changed; review frame geometry and timing before regenerating.');
}
await mkdir('public/crt', { recursive: true });
await sharp(source).flatten({ background: '#000' }).png().toFile('public/crt/glitter-still.png');
await writeFile('public/crt/provenance.json', `${JSON.stringify({
    source: 'public/glitter.gif', sha256: createHash('sha256').update(source).digest('hex'),
    width: 400, height: 400,
    processing: 'First composited GIF frame, flattened on the existing black backdrop; lossless reduced-motion fallback. The live background retains the original GIF.',
    regenerate: 'node scripts/generate-crt-glitter.mjs',
}, null, 2)}\n`);
console.log('Generated reduced-motion glitter still; original glitter.gif unchanged.');
