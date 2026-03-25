/**
 * Google Drive cache helper
 */
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

export interface IGoogleDriveCache {
  exists(folderId: string, fileName: string): Promise<boolean>;
  read<T>(folderId: string, fileName: string): Promise<T | null>;
  write<T>(folderId: string, fileName: string, data: T): Promise<boolean>;
  delete(folderId: string, fileName: string): Promise<boolean>;
}

const getDriveClient = (() => {
  let drive: drive_v3.Drive | null = null;

  return (): drive_v3.Drive | null => {
    if (drive) return drive;

    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKeyRaw =
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_PRIVATE_KEY;
    const privateKey = privateKeyRaw
      ?.replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r');

    if (!clientEmail || !privateKey) {
      strapi.log.error(
        '[GoogleDriveCache] Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY/GOOGLE_PRIVATE_KEY environment variables.'
      );
      return null;
    }

    try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
      });

      drive = google.drive({ version: 'v3', auth });
    } catch (error) {
      strapi.log.error(
        '[GoogleDriveCache] Failed to initialize client:',
        error
      );
      drive = null;
    }

    return drive;
  };
})();

const findFileId = async (
  folderId: string,
  fileName: string
): Promise<string | null> => {
  const drive = getDriveClient();
  if (!drive) return null;

  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and name='${fileName}' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const file = response.data.files?.[0];
    return file?.id || null;
  } catch (error) {
    strapi.log.error('[GoogleDriveCache] Failed to search file:', error);
    return null;
  }
};

const exists = async (folderId: string, fileName: string): Promise<boolean> => {
  const fileId = await findFileId(folderId, fileName);
  return Boolean(fileId);
};

const read = async <T>(
  folderId: string,
  fileName: string
): Promise<T | null> => {
  const drive = getDriveClient();
  if (!drive) return null;

  const fileId = await findFileId(folderId, fileName);
  if (!fileId) return null;

  try {
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      { responseType: 'stream' }
    );

    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      response.data.on('data', (chunk) => chunks.push(chunk));
      response.data.on('end', () => resolve());
      response.data.on('error', (err) => reject(err));
    });

    const raw = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    strapi.log.error('[GoogleDriveCache] Failed to read file:', error);
    return null;
  }
};

const write = async <T>(
  folderId: string,
  fileName: string,
  data: T
): Promise<boolean> => {
  const drive = getDriveClient();
  if (!drive) return false;

  const payload = JSON.stringify(data, null, 2);
  const media = {
    mimeType: 'application/json',
    body: Readable.from([payload]),
  };

  try {
    const existingFileId = await findFileId(folderId, fileName);

    if (existingFileId) {
      await drive.files.update({
        fileId: existingFileId,
        media,
        supportsAllDrives: true,
      });
    } else {
      await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media,
        fields: 'id',
        supportsAllDrives: true,
      });
    }

    strapi.log.info(
      `[GoogleDriveCache] Stored ${fileName} in folder ${folderId}`
    );
    return true;
  } catch (error) {
    strapi.log.error('[GoogleDriveCache] Failed to write file:', error);
    return false;
  }
};

const remove = async (folderId: string, fileName: string): Promise<boolean> => {
  const drive = getDriveClient();
  if (!drive) return false;

  const fileId = await findFileId(folderId, fileName);
  if (!fileId) return true;

  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    strapi.log.info(
      `[GoogleDriveCache] Deleted ${fileName} from folder ${folderId}`
    );
    return true;
  } catch (error) {
    strapi.log.error('[GoogleDriveCache] Failed to delete file:', error);
    return false;
  }
};

export const driveCache: IGoogleDriveCache = {
  exists,
  read,
  write,
  delete: remove,
};

export default driveCache;
