import { resolve as dnsResolve } from 'node:dns/promises';
import type { WebhookUrlConfig } from '../config.js';

/**
 * SSRF protection for webhook and automation URLs.
 * Validates that a URL does not target private/internal networks.
 */

const DEFAULT_BLOCKED_HOSTS = [
	'localhost',
	'localhost.localdomain',
	'metadata.google.internal',
	'metadata.goog',
	'169.254.169.254', // AWS/GCP metadata
	'[fd00::1]',
];

export class SsrfError extends Error {
	readonly code = 'SSRF_BLOCKED' as const;
	constructor(message: string) {
		super(message);
		this.name = 'SsrfError';
	}
}

export function isPrivateIp(ip: string): boolean {
	// Handle IPv6 loopback
	if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;

	// Handle IPv6 unique local (fc00::/7)
	if (ip.startsWith('fc') || ip.startsWith('fd')) return true;

	// Handle IPv4-mapped IPv6 (::ffff:a.b.c.d)
	const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
	const ipv4 = v4mapped ? v4mapped[1] : ip;

	// Parse IPv4 octets
	const parts = ipv4.split('.');
	if (parts.length !== 4) return false;

	const octets = parts.map(Number);
	if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return false;

	const [a, b] = octets;

	// 10.0.0.0/8
	if (a === 10) return true;

	// 172.16.0.0/12
	if (a === 172 && b >= 16 && b <= 31) return true;

	// 192.168.0.0/16
	if (a === 192 && b === 168) return true;

	// 127.0.0.0/8 (loopback)
	if (a === 127) return true;

	// 169.254.0.0/16 (link-local)
	if (a === 169 && b === 254) return true;

	// 0.0.0.0/8
	if (a === 0) return true;

	return false;
}

function matchesCidr(ip: string, cidr: string): boolean {
	const [cidrIp, prefixStr] = cidr.split('/');
	const prefix = Number(prefixStr);
	if (isNaN(prefix)) return false;

	const ipParts = ip.split('.').map(Number);
	const cidrParts = cidrIp.split('.').map(Number);
	if (ipParts.length !== 4 || cidrParts.length !== 4) return false;

	const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
	const cidrNum = (cidrParts[0] << 24) | (cidrParts[1] << 16) | (cidrParts[2] << 8) | cidrParts[3];
	const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

	return (ipNum >>> 0 & mask) === (cidrNum >>> 0 & mask);
}

export async function validateWebhookUrl(url: string, config: WebhookUrlConfig): Promise<void> {
	// Parse URL
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new SsrfError(`Invalid URL: ${url}`);
	}

	// Check protocol
	if (parsed.protocol === 'http:' && !config.allowHttp) {
		throw new SsrfError('HTTPS is required for webhook URLs in production');
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new SsrfError(`Unsupported protocol: ${parsed.protocol}`);
	}

	const hostname = parsed.hostname.replace(/^\[|\]$/g, ''); // strip brackets from IPv6

	// Check allowed hosts (if configured, only allow those)
	if (config.allowedHosts.length > 0) {
		if (!config.allowedHosts.includes(hostname)) {
			throw new SsrfError(`Host not in allowed list: ${hostname}`);
		}
		return; // allowed hosts are trusted, skip further checks
	}

	// Check blocked hosts
	const allBlocked = [...DEFAULT_BLOCKED_HOSTS, ...config.blockedHosts];
	if (allBlocked.includes(hostname)) {
		throw new SsrfError(`Blocked host: ${hostname}`);
	}

	// Check if hostname is already an IP
	if (isPrivateIp(hostname)) {
		throw new SsrfError(`Private IP address not allowed: ${hostname}`);
	}

	// DNS resolution check — resolve hostname and check all IPs
	try {
		const addresses = await dnsResolve(hostname);
		for (const addr of addresses) {
			if (isPrivateIp(addr)) {
				throw new SsrfError(`Hostname ${hostname} resolves to private IP: ${addr}`);
			}
			// Check custom blocked CIDRs
			for (const cidr of config.blockedCidrs) {
				if (matchesCidr(addr, cidr)) {
					throw new SsrfError(`IP ${addr} is in blocked CIDR range: ${cidr}`);
				}
			}
		}
	} catch (err) {
		if (err instanceof SsrfError) throw err;
		// DNS resolution failure — allow the request (the fetch will fail anyway)
	}
}
