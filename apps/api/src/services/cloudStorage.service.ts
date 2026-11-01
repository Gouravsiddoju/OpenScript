import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, HeadBucketCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

export interface CloudStorageConfig {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
}

export interface BackupItem {
  key: string;
  filename: string;
  projectId: string;
  size: number;
  lastModified: Date;
  provider: 's3' | 'r2' | 'minio' | 'local';
  url?: string;
  metadata?: Record<string, string>;
}

export class CloudStorageService {
  private static client: S3Client | null = null;
  private static config: CloudStorageConfig | null = null;
  private static localBackupDir: string = process.env.DATA_DIR 
    ? path.join(process.env.DATA_DIR, 'backups') 
    : path.join(process.cwd(), 'backups');

  public static initialize(): void {
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || process.env.AWS_REGION || 'auto';
    const publicUrl = process.env.S3_PUBLIC_URL;

    // Ensure local directory exists for fallback
    try {
      if (!fs.existsSync(this.localBackupDir)) {
        fs.mkdirSync(this.localBackupDir, { recursive: true });
      }
    } catch (e) {
      this.localBackupDir = path.join('/tmp', 'openscript-backups');
      if (!fs.existsSync(this.localBackupDir)) {
        fs.mkdirSync(this.localBackupDir, { recursive: true });
      }
    }

    if (bucket && accessKeyId && secretAccessKey) {
      this.config = {
        endpoint,
        region,
        bucket,
        accessKeyId,
        secretAccessKey,
        publicUrl,
      };

      this.client = new S3Client({
        region,
        endpoint: endpoint || undefined,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: Boolean(endpoint && !endpoint.includes('amazonaws.com')),
      });
      console.log(`[CloudStorage] S3/R2 client initialized for bucket '${bucket}' (endpoint: ${endpoint || 'AWS S3'})`);
    } else {
      console.log(`[CloudStorage] S3 credentials not set. Using local persistent storage fallback at: ${this.localBackupDir}`);
    }
  }

  public static getStatus(): {
    configured: boolean;
    provider: 's3' | 'r2' | 'minio' | 'local';
    bucket?: string;
    endpoint?: string;
    localPath?: string;
  } {
    if (this.client && this.config) {
      const isR2 = this.config.endpoint?.includes('r2.cloudflarestorage.com');
      const isMinio = this.config.endpoint?.includes('minio') || this.config.endpoint?.includes(':9000');
      const provider = isR2 ? 'r2' : isMinio ? 'minio' : 's3';
      return {
        configured: true,
        provider,
        bucket: this.config.bucket,
        endpoint: this.config.endpoint,
      };
    }
    return {
      configured: false,
      provider: 'local',
      localPath: this.localBackupDir,
    };
  }

  /**
   * Saves a screenplay snapshot or document backup to cloud or local storage
   */
  public static async saveBackup(
    projectId: string,
    filename: string,
    content: string | Buffer,
    contentType = 'application/json',
    metadata?: Record<string, string>
  ): Promise<BackupItem> {
    const timestamp = new Date();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `projects/${projectId}/${timestamp.getTime()}_${safeFilename}`;
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;

    if (this.client && this.config) {
      try {
        await this.client.send(
          new PutObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            Metadata: {
              projectId,
              filename: safeFilename,
              ...metadata,
            },
          })
        );

        const url = this.config.publicUrl 
          ? `${this.config.publicUrl.replace(/\/$/, '')}/${key}` 
          : undefined;

        const isR2 = this.config.endpoint?.includes('r2.cloudflarestorage.com');
        return {
          key,
          filename: safeFilename,
          projectId,
          size: buffer.length,
          lastModified: timestamp,
          provider: (isR2 ? 'r2' : 's3') as 's3' | 'r2' | 'minio' | 'local',
          url,
          metadata,
        };
      } catch (err) {
        console.error('[CloudStorage] S3 PutObject failed, falling back to local file storage:', err);
      }
    }

    // Local file fallback
    const projectFolder = path.join(this.localBackupDir, projectId);
    if (!fs.existsSync(projectFolder)) {
      fs.mkdirSync(projectFolder, { recursive: true });
    }
    const localFilePath = path.join(projectFolder, `${timestamp.getTime()}_${safeFilename}`);
    fs.writeFileSync(localFilePath, buffer);

    return {
      key: `${projectId}/${timestamp.getTime()}_${safeFilename}`,
      filename: safeFilename,
      projectId,
      size: buffer.length,
      lastModified: timestamp,
      provider: 'local',
      metadata,
    };
  }

  /**
   * Lists all cloud or local backups for a project
   */
  public static async listBackups(projectId: string): Promise<BackupItem[]> {
    if (this.client && this.config) {
      try {
        const prefix = `projects/${projectId}/`;
        const res = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.config.bucket,
            Prefix: prefix,
          })
        );

        if (res.Contents) {
          const isR2 = this.config.endpoint?.includes('r2.cloudflarestorage.com');
          return res.Contents.map((obj) => {
            const key = obj.Key || '';
            const filename = key.replace(prefix, '').replace(/^\d+_/, '');
            const url = this.config?.publicUrl 
              ? `${this.config.publicUrl.replace(/\/$/, '')}/${key}` 
              : undefined;

            return {
              key,
              filename,
              projectId,
              size: obj.Size || 0,
              lastModified: obj.LastModified || new Date(),
              provider: (isR2 ? 'r2' : 's3') as 's3' | 'r2' | 'minio' | 'local',
              url,
            };
          }).sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
        }
      } catch (err) {
        console.error('[CloudStorage] S3 ListObjects failed, checking local storage:', err);
      }
    }

    // Local directory scan
    const projectFolder = path.join(this.localBackupDir, projectId);
    if (!fs.existsSync(projectFolder)) {
      return [];
    }

    const files = fs.readdirSync(projectFolder);
    return files.map((file) => {
      const fullPath = path.join(projectFolder, file);
      const stat = fs.statSync(fullPath);
      return {
        key: `${projectId}/${file}`,
        filename: file.replace(/^\d+_/, ''),
        projectId,
        size: stat.size,
        lastModified: stat.mtime,
        provider: 'local' as const,
      };
    }).sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  /**
   * Retrieves a specific backup content by key
   */
  public static async getBackupContent(key: string): Promise<Buffer | null> {
    if (this.client && this.config) {
      try {
        const fullKey = key.startsWith('projects/') ? key : `projects/${key}`;
        const res = await this.client.send(
          new GetObjectCommand({
            Bucket: this.config.bucket,
            Key: fullKey,
          })
        );
        if (res.Body) {
          const streamToBuffer = async (stream: any): Promise<Buffer> => {
            const chunks: any[] = [];
            for await (const chunk of stream) chunks.push(chunk);
            return Buffer.concat(chunks);
          };
          return await streamToBuffer(res.Body);
        }
      } catch (err) {
        console.error('[CloudStorage] S3 GetObject failed, checking local:', err);
      }
    }

    const localPath = path.join(this.localBackupDir, key);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
    return null;
  }
}
