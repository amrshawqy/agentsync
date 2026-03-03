import { describe, it, expect } from 'vitest';
import { isPrivateIp, validateWebhookUrl, SsrfError } from '../../src/infra/url-validator.js';
import type { WebhookUrlConfig } from '../../src/config.js';

const defaultConfig: WebhookUrlConfig = {
	allowHttp: true,
	allowedHosts: [],
	blockedHosts: [],
	blockedCidrs: [],
};

const prodConfig: WebhookUrlConfig = {
	allowHttp: false,
	allowedHosts: [],
	blockedHosts: [],
	blockedCidrs: [],
};

// ── isPrivateIp tests ──

describe('isPrivateIp', () => {
	it('detects 10.x.x.x as private', () => {
		expect(isPrivateIp('10.0.0.1')).toBe(true);
		expect(isPrivateIp('10.255.255.255')).toBe(true);
	});

	it('detects 172.16-31.x.x as private', () => {
		expect(isPrivateIp('172.16.0.1')).toBe(true);
		expect(isPrivateIp('172.31.255.255')).toBe(true);
	});

	it('does not flag 172.15.x or 172.32.x', () => {
		expect(isPrivateIp('172.15.0.1')).toBe(false);
		expect(isPrivateIp('172.32.0.1')).toBe(false);
	});

	it('detects 192.168.x.x as private', () => {
		expect(isPrivateIp('192.168.0.1')).toBe(true);
		expect(isPrivateIp('192.168.255.255')).toBe(true);
	});

	it('detects 127.x.x.x as private (loopback)', () => {
		expect(isPrivateIp('127.0.0.1')).toBe(true);
		expect(isPrivateIp('127.255.255.255')).toBe(true);
	});

	it('detects 169.254.x.x as private (link-local)', () => {
		expect(isPrivateIp('169.254.0.1')).toBe(true);
		expect(isPrivateIp('169.254.169.254')).toBe(true);
	});

	it('detects 0.0.0.0/8 as private', () => {
		expect(isPrivateIp('0.0.0.0')).toBe(true);
		expect(isPrivateIp('0.0.0.1')).toBe(true);
	});

	it('detects IPv6 loopback ::1', () => {
		expect(isPrivateIp('::1')).toBe(true);
	});

	it('detects IPv6 unique local fc00::/7', () => {
		expect(isPrivateIp('fc00::1')).toBe(true);
		expect(isPrivateIp('fd00::1')).toBe(true);
	});

	it('does not flag public IPs', () => {
		expect(isPrivateIp('8.8.8.8')).toBe(false);
		expect(isPrivateIp('1.1.1.1')).toBe(false);
		expect(isPrivateIp('142.250.80.46')).toBe(false);
		expect(isPrivateIp('203.0.113.1')).toBe(false);
	});

	it('does not flag public 192.x but not 192.168.x', () => {
		expect(isPrivateIp('192.0.0.1')).toBe(false);
		expect(isPrivateIp('192.169.0.1')).toBe(false);
	});

	it('handles malformed IPs gracefully', () => {
		expect(isPrivateIp('not-an-ip')).toBe(false);
		expect(isPrivateIp('')).toBe(false);
		expect(isPrivateIp('999.999.999.999')).toBe(false);
	});
});

// ── validateWebhookUrl tests ──

describe('validateWebhookUrl', () => {
	it('accepts a valid HTTPS URL', async () => {
		await expect(
			validateWebhookUrl('https://hooks.example.com/webhook', defaultConfig),
		).resolves.not.toThrow();
	});

	it('accepts HTTP in dev mode (allowHttp: true)', async () => {
		await expect(
			validateWebhookUrl('http://hooks.example.com/webhook', defaultConfig),
		).resolves.not.toThrow();
	});

	it('rejects HTTP in production mode (allowHttp: false)', async () => {
		await expect(
			validateWebhookUrl('http://hooks.example.com/webhook', prodConfig),
		).rejects.toThrow(SsrfError);
	});

	it('rejects invalid URLs', async () => {
		await expect(
			validateWebhookUrl('not-a-url', defaultConfig),
		).rejects.toThrow(SsrfError);
	});

	it('rejects non-http protocols', async () => {
		await expect(
			validateWebhookUrl('ftp://example.com/file', defaultConfig),
		).rejects.toThrow(SsrfError);

		await expect(
			validateWebhookUrl('file:///etc/passwd', defaultConfig),
		).rejects.toThrow(SsrfError);
	});

	it('rejects localhost', async () => {
		await expect(
			validateWebhookUrl('http://localhost:8080/hook', defaultConfig),
		).rejects.toThrow(SsrfError);
	});

	it('rejects 127.0.0.1', async () => {
		await expect(
			validateWebhookUrl('http://127.0.0.1:8080/hook', defaultConfig),
		).rejects.toThrow(SsrfError);
	});

	it('rejects private IPs (10.x)', async () => {
		await expect(
			validateWebhookUrl('http://10.0.0.5/hook', defaultConfig),
		).rejects.toThrow(SsrfError);
	});

	it('rejects private IPs (172.16.x)', async () => {
		await expect(
			validateWebhookUrl('http://172.16.0.1/hook', defaultConfig),
		).rejects.toThrow(SsrfError);
	});

	it('rejects private IPs (192.168.x)', async () => {
		await expect(
			validateWebhookUrl('http://192.168.1.1/hook', defaultConfig),
		).rejects.toThrow(SsrfError);
	});

	it('rejects AWS/GCP metadata endpoint', async () => {
		await expect(
			validateWebhookUrl('http://169.254.169.254/latest/meta-data', defaultConfig),
		).rejects.toThrow(SsrfError);
	});

	it('rejects metadata.google.internal', async () => {
		await expect(
			validateWebhookUrl('http://metadata.google.internal/computeMetadata/v1/', defaultConfig),
		).rejects.toThrow(SsrfError);
	});

	it('respects allowedHosts (only allows listed hosts)', async () => {
		const config = { ...defaultConfig, allowedHosts: ['hooks.myapp.com'] };

		await expect(
			validateWebhookUrl('https://hooks.myapp.com/webhook', config),
		).resolves.not.toThrow();

		await expect(
			validateWebhookUrl('https://evil.com/webhook', config),
		).rejects.toThrow(SsrfError);
	});

	it('respects custom blockedHosts', async () => {
		const config = { ...defaultConfig, blockedHosts: ['evil.example.com'] };

		await expect(
			validateWebhookUrl('https://evil.example.com/hook', config),
		).rejects.toThrow(SsrfError);
	});
});
