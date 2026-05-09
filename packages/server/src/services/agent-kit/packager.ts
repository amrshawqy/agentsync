import { Writable } from 'node:stream';
import archiver from 'archiver';

export class Packager {
	async packageAsZip(files: Record<string, string>): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			const writable = new Writable({
				write(chunk, _encoding, callback) {
					chunks.push(chunk);
					callback();
				},
			});

			const archive = archiver('zip', { zlib: { level: 9 } });

			archive.on('error', reject);
			writable.on('finish', () => resolve(Buffer.concat(chunks)));

			archive.pipe(writable);

			for (const [filename, content] of Object.entries(files)) {
				archive.append(content, { name: filename });
			}

			archive.finalize();
		});
	}

	packageAsJson(files: Record<string, string>): string {
		return JSON.stringify({ files }, null, 2);
	}
}
