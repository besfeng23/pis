import {initializeApp} from 'firebase-admin/app';
import {getFirestore, Timestamp} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {logger} from 'firebase-functions';
import {setGlobalOptions} from 'firebase-functions/v2';
import {onObjectFinalized} from 'firebase-functions/v2/storage';

setGlobalOptions({region: 'us-central1', maxInstances: 20});

initializeApp();

const firestore = getFirestore();
const storage = getStorage();

const RAW_INTEL_PREFIX = 'raw-intel/';
const MAX_SEGMENTS = 2000;
const CHUNK_SIZE = 50;

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const persistSegments = async (filename: string, segments: string[], ownerUid: string | null) => {
  const chunks = chunkArray(segments, CHUNK_SIZE);
  await Promise.all(
    chunks.map(async chunk => {
      const batch = firestore.batch();
      chunk.forEach(content => {
        const segmentRef = firestore.collection('intel_segments').doc();
        batch.set(segmentRef, {
          filename,
          content,
          ownerUid,
          createdAt: Timestamp.now(),
        });
      });
      await batch.commit();
    })
  );
};

export const processRawIntelUpload = onObjectFinalized(
  {memory: '512MiB', timeoutSeconds: 540},
  async event => {
    const object = event.data;
    if (!object.name || !object.bucket) {
      logger.warn('Skipping upload with missing metadata.');
      return;
    }

    if (!object.name.startsWith(RAW_INTEL_PREFIX)) {
      logger.info('Ignoring non-intel upload', {filename: object.name});
      return;
    }

    const ownerUid = object.metadata?.ownerUid ?? null;
    const logRef = firestore.collection('ingestion_logs').doc();

    await logRef.set({
      filename: object.name,
      status: 'PROCESSING',
      interceptCount: 0,
      ownerUid,
      createdAt: Timestamp.now(),
    });

    try {
      const file = storage.bucket(object.bucket).file(object.name);
      const [buffer] = await file.download();
      const content = buffer.toString('utf-8');
      const segments = content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, MAX_SEGMENTS);

      logger.info('Processing raw intel upload', {
        filename: object.name,
        segments: segments.length,
      });

      await persistSegments(object.name, segments, ownerUid);

      await logRef.update({
        status: 'COMPLETED',
        interceptCount: segments.length,
        completedAt: Timestamp.now(),
      });
    } catch (error) {
      logger.error('Failed to process raw intel upload', error);
      await logRef.update({
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: Timestamp.now(),
      });
    }
  }
);
