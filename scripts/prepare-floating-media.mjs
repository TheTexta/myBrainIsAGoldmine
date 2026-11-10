import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, access, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';

// Local asset preparation only. Never modify the supplied source directory.
const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error('Usage: node scripts/prepare-floating-media.mjs <source-directory>');
const imageDirectory = 'src/assets/floating-images';
const mediaDirectory = 'public/floating-media';
const files = (await readdir(sourceDirectory)).filter((name) => /\.(jpe?g|png|gif|mov)$/i.test(name)).sort((a, b) => a.localeCompare(b, 'en'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const items = [];
const destinations = new Set();

async function destination(directory, name) {
    const target = path.join(directory, name);
    if (destinations.has(target)) throw new Error(`Duplicate output: ${target}`);
    destinations.add(target);
    try { await access(target); } catch { return target; }
    throw new Error(`Refusing to overwrite existing asset: ${target}`);
}
function ffmpeg(args) {
    const result = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', ...args], { maxBuffer: 20 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw new Error(result.stderr?.toString() || String(result.error));
    return result.stdout;
}
await mkdir(imageDirectory, { recursive: true }); await mkdir(mediaDirectory, { recursive: true });
await destination(imageDirectory, 'provenance.json');
for (const name of files) {
    const source = path.join(sourceDirectory, name);
    const original = await readFile(source);
    const id = path.parse(name).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const sourceSha256 = digest(original);
    let file, kind, animatedFile, videoFile;
    if (/\.mov$/i.test(name)) {
        kind = 'video'; file = `${id}-poster.jpg`; videoFile = `${id}.mp4`;
        const poster = ffmpeg(['-i', source, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1']);
        await sharp(poster).resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toFile(await destination(imageDirectory, file));
        ffmpeg(['-i', source, '-map', '0:v:0', '-vf', 'scale=576:576:force_original_aspect_ratio=decrease:force_divisible_by=2',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-an', '-map_metadata', '-1', '-movflags', '+faststart',
            await destination(mediaDirectory, videoFile)]);
    } else if (/\.gif$/i.test(name)) {
        kind = 'gif'; file = `${id}-still.png`; animatedFile = `${id}.gif`;
        await sharp(original).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).png().toFile(await destination(imageDirectory, file));
        // Preserve every frame and its timing; deliver the small animation directly.
        await sharp(original, { animated: true }).resize({ width: 288, withoutEnlargement: true }).gif().toFile(await destination(mediaDirectory, animatedFile));
    } else {
        kind = 'image'; file = `${id}.jpg`;
        await sharp(original).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toFile(await destination(imageDirectory, file));
    }
    const bytes = await readFile(path.join(imageDirectory, file));
    const metadata = await sharp(bytes).metadata();
    const item = { id, kind, source: name, sourceSha256, file, sha256: digest(bytes), width: metadata.width, height: metadata.height };
    if (animatedFile) {
        const bytes = await readFile(path.join(mediaDirectory, animatedFile));
        const originalMetadata = await sharp(original, { animated: true }).metadata();
        const animation = await sharp(bytes, { animated: true }).metadata();
        if (animation.pages !== originalMetadata.pages || JSON.stringify(animation.delay) !== JSON.stringify(originalMetadata.delay) || animation.loop !== originalMetadata.loop) throw new Error(`GIF animation changed: ${name}`);
        Object.assign(item, { animatedFile, animatedSha256: digest(bytes), frames: animation.pages, delays: animation.delay, loop: animation.loop });
    }
    if (videoFile) Object.assign(item, { videoFile, videoSha256: digest(await readFile(path.join(mediaDirectory, videoFile))), audio: false });
    if (digest(await readFile(source)) !== sourceSha256) throw new Error(`Supplied original changed: ${name}`);
    items.push(item);
    console.log(`${name} → ${file}${animatedFile ? ` + ${animatedFile}` : ''}${videoFile ? ` + ${videoFile}` : ''}`);
}
await writeFile(path.join(imageDirectory, 'provenance.json'), `${JSON.stringify({
    source: 'Owner-supplied mallory site photos folder',
    processing: 'Web copies only: stills auto-oriented, metadata stripped, maximum 1600px edge; native Astro supplies responsive variants. GIF frames/timing retained in a small animated copy. MOV delivered as a muted H.264 MP4 with a still poster. Downloads originals are unchanged.',
    regenerate: 'Run this script against the supplied folder into fresh output paths; existing assets are not overwritten.',
    items,
}, null, 2)}\n`);
