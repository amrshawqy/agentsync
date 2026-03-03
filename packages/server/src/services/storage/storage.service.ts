import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

export interface StorageConfig {
	bucket: string;
	region: string;
	endpoint?: string;
	accessKeyId: string;
	secretAccessKey: string;
}

export class StorageService {
	private client: S3Client;
	private bucket: string;

	constructor(config: StorageConfig) {
		this.bucket = config.bucket;
		this.client = new S3Client({
			region: config.region,
			endpoint: config.endpoint,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
			forcePathStyle: !!config.endpoint, // Required for MinIO/R2
		});
	}

	async generateUploadUrl(
		teamId: string,
		fileName: string,
		mimeType: string,
	): Promise<{ uploadUrl: string; storagePath: string; fileId: string }> {
		const fileId = randomUUID();
		const storagePath = `${teamId}/${fileId}/${fileName}`;

		const command = new PutObjectCommand({
			Bucket: this.bucket,
			Key: storagePath,
			ContentType: mimeType,
		});

		const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 });

		return { uploadUrl, storagePath, fileId };
	}

	async generateDownloadUrl(storagePath: string): Promise<string> {
		const command = new GetObjectCommand({
			Bucket: this.bucket,
			Key: storagePath,
		});

		return getSignedUrl(this.client, command, { expiresIn: 3600 });
	}
}
