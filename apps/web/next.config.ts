import type { NextConfig } from 'next';

const apiUrl = process.env.AGENTSYNC_API_URL ?? 'http://localhost:3000';

const config: NextConfig = {
	output: 'standalone',
	transpilePackages: ['@agentsync/sdk', '@agentsync/types'],
	async rewrites() {
		return [
			{ source: '/v1/:path*', destination: `${apiUrl}/v1/:path*` },
			{ source: '/oauth/:path*', destination: `${apiUrl}/oauth/:path*` },
			{ source: '/mcp', destination: `${apiUrl}/mcp` },
			{ source: '/.well-known/:path*', destination: `${apiUrl}/.well-known/:path*` },
			{ source: '/health', destination: `${apiUrl}/health` },
		];
	},
};

export default config;
