import { cookieNames } from '@/lib/api';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function SsoCompletePage({
	searchParams,
}: {
	searchParams: Promise<{ access_token?: string; refresh_token?: string; expires_in?: string }>;
}) {
	const params = await searchParams;
	if (!params.access_token) redirect('/sign-in?error=Missing+token');

	const store = await cookies();
	const expiresIn = Number(params.expires_in ?? '3600');
	store.set(cookieNames.session, params.access_token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: expiresIn,
		path: '/',
	});
	if (params.refresh_token) {
		store.set(cookieNames.refresh, params.refresh_token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30,
			path: '/',
		});
	}
	redirect('/app');
}
