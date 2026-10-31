import { createHash } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { MAX_IMAGE_BYTES, mediaPath } from './documents';
import { databaseError, HttpError, privilegedSupabase } from './server';

export interface Media {
    id: string; upload_key: string; object_key: string; content_type: string;
    size_bytes: number; sha256: string | null; state: 'pending' | 'ready';
}

function storage() {
    const endpoint = import.meta.env.R2_ENDPOINT || process.env.R2_ENDPOINT;
    const bucket = import.meta.env.R2_BUCKET || process.env.R2_BUCKET;
    const accessKeyId = import.meta.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = import.meta.env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new HttpError(503, 'Image storage is not configured yet.');
    return { bucket, client: new S3Client({ endpoint, region: 'auto', forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } }) };
}

export function imageType(bytes: Uint8Array): string | null {
    const buffer = Buffer.from(bytes);
    if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (/^GIF8[79]a$/.test(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif';
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
    return null;
}

export async function getMedia(client: SupabaseClient, id: string): Promise<Media> {
    const { data, error } = await client.from('mybrain_media').select('*').eq('id', id).maybeSingle();
    databaseError(error);
    if (!data) throw new HttpError(404, 'Image not found.');
    return data as Media;
}

export async function uploadUrl(media: Media): Promise<string> {
    // Check server-only completion credentials before issuing any upload capability.
    privilegedSupabase();
    const { client, bucket } = storage();
    return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: media.upload_key,
        ContentType: media.content_type, ContentLength: media.size_bytes }), { expiresIn: 600 });
}

export async function privateImageUrl(client: SupabaseClient, url: string): Promise<string> {
    const match = mediaPath.exec(url);
    if (!match) return url;
    const media = await getMedia(client, match[1]!);
    if (media.state !== 'ready') throw new HttpError(409, 'This image is still uploading.');
    const store = storage();
    return getSignedUrl(store.client, new GetObjectCommand({ Bucket: store.bucket, Key: media.object_key }), { expiresIn: 300 });
}

export async function completeUpload(media: Media): Promise<void> {
    if (media.state === 'ready') return;
    const privileged = privilegedSupabase();
    const { client, bucket } = storage();
    const uploaded = await client.send(new GetObjectCommand({ Bucket: bucket, Key: media.upload_key }));
    if (!uploaded.Body || uploaded.ContentLength !== media.size_bytes || media.size_bytes > MAX_IMAGE_BYTES) {
        throw new HttpError(400, 'The uploaded image size does not match. Upload it again.');
    }
    const bytes = await uploaded.Body.transformToByteArray();
    if (bytes.length !== media.size_bytes || imageType(bytes) !== media.content_type) throw new HttpError(400, 'The file bytes do not match the selected image type.');
    try {
        const metadata = await sharp(bytes, { limitInputPixels: 100_000_000 }).metadata();
        if (!metadata.width || !metadata.height || metadata.width * metadata.height * (metadata.pages ?? 1) > 100_000_000) throw new Error('Image dimensions are too large.');
    } catch { throw new HttpError(400, 'Choose a valid image with at most 100 million total pixels, including GIF frames.'); }
    const checksum = createHash('sha256').update(bytes).digest('hex');
    // Seal verified bytes under a key that was never included in a browser PUT URL.
    // Retrying an old signed upload can no longer overwrite a published original.
    try {
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: media.object_key, Body: bytes,
            ContentType: media.content_type, IfNoneMatch: '*', Metadata: { sha256: checksum } }));
    } catch (error) {
        if (!(error && typeof error === 'object' && '$metadata' in error &&
            (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 412)) throw error;
    }
    const sealed = await client.send(new GetObjectCommand({ Bucket: bucket, Key: media.object_key }));
    const readback = await sealed.Body?.transformToByteArray();
    if (!readback || createHash('sha256').update(readback).digest('hex') !== checksum) {
        throw new HttpError(409, 'Original verification failed. Keep the draft and retry with a new upload.');
    }
    const { error } = await privileged.from('mybrain_media').update({ state: 'ready', sha256: checksum }).eq('id', media.id).eq('state', 'pending');
    databaseError(error);
    // Pending/incoming objects are intentionally retained; cleanup is a separate operation.
}

export async function publicImage(objectKey: string) {
    const { client, bucket } = storage();
    return client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
}
