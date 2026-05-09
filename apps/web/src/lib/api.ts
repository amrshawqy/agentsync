import { cookies } from 'next/headers';

const API_URL = process.env.AGENTSYNC_API_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'agentsync_session';
const REFRESH_COOKIE = 'agentsync_refresh';

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { error: { code: string; message: string; hint?: string } };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export class ApiClient {
	constructor(private token?: string | null) {}

	get isAuthenticated() {
		return Boolean(this.token);
	}

	async request<T = unknown>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
		const headers = new Headers(init.headers);
		if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
		if (init.body && !headers.has('Content-Type')) {
			headers.set('Content-Type', 'application/json');
		}
		const res = await fetch(`${API_URL}${path}`, {
			...init,
			headers,
			cache: 'no-store',
		});
		const text = await res.text();
		try {
			return JSON.parse(text) as ApiResponse<T>;
		} catch {
			return {
				error: {
					code: res.ok ? 'INVALID_RESPONSE' : `HTTP_${res.status}`,
					message: text || res.statusText,
				},
			};
		}
	}

	get<T = unknown>(path: string) {
		return this.request<T>(path, { method: 'GET' });
	}

	post<T = unknown>(path: string, body?: unknown) {
		return this.request<T>(path, {
			method: 'POST',
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	}

	patch<T = unknown>(path: string, body?: unknown) {
		return this.request<T>(path, {
			method: 'PATCH',
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	}

	delete<T = unknown>(path: string) {
		return this.request<T>(path, { method: 'DELETE' });
	}
}

/** Server Component / Route Handler helper that injects the cookie session. */
export async function apiFromCookies(): Promise<ApiClient> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value ?? null;
	return new ApiClient(token);
}

export const cookieNames = {
	session: SESSION_COOKIE,
	refresh: REFRESH_COOKIE,
};

export function isOk<T>(r: ApiResponse<T>): r is ApiSuccess<T> {
	return (r as ApiSuccess<T>).success === true;
}
