import { apiFromCookies } from '@/lib/api';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const api = await apiFromCookies();
	if (!api.isAuthenticated) redirect('/sign-in?return_to=/admin');

	// The /v1/admin/diagnostics endpoint is super-admin gated; if forbidden, kick out.
	const probe = await api.get('/v1/admin/diagnostics');
	if ('error' in probe) redirect('/app');

	return (
		<div className="flex min-h-screen flex-col">
			<header className="flex items-center justify-between border-b px-6 py-3">
				<div className="flex items-center gap-6">
					<Link href="/admin" className="text-base font-semibold">
						AgentSync · Admin
					</Link>
					<nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
						<Link href="/admin" className="hover:text-foreground">
							Health
						</Link>
						<Link href="/admin/usage" className="hover:text-foreground">
							Usage
						</Link>
						<Link href="/admin/teams" className="hover:text-foreground">
							Teams
						</Link>
					</nav>
				</div>
				<Link href="/app" className="text-sm text-muted-foreground hover:text-foreground">
					Back to app
				</Link>
			</header>
			<main className="flex-1 px-6 py-6">{children}</main>
		</div>
	);
}
