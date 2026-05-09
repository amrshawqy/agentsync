import { apiFromCookies } from '@/lib/api';
import Link from 'next/link';
import { redirect } from 'next/navigation';

interface Membership {
	teamId: string;
	teamSlug: string;
	teamName: string;
	roleName?: string;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
	const api = await apiFromCookies();
	if (!api.isAuthenticated) redirect('/sign-in?return_to=/app');

	const me = await api.get<{ id: string; primaryEmail?: string }>('/v1/auth/me');
	if ('error' in me) redirect('/sign-in?return_to=/app');

	const memberships = await api.get<Membership[]>('/v1/auth/me');
	void memberships;

	return (
		<div className="flex min-h-screen flex-col">
			<header className="flex items-center justify-between border-b px-6 py-3">
				<div className="flex items-center gap-6">
					<Link href="/app" className="text-base font-semibold">
						AgentSync
					</Link>
					<nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
						<Link href="/app" className="hover:text-foreground">
							Tables
						</Link>
						<Link href="/app/blueprints" className="hover:text-foreground">
							Blueprints
						</Link>
						<Link href="/app/schema" className="hover:text-foreground">
							Schema
						</Link>
						<Link href="/app/members" className="hover:text-foreground">
							Members
						</Link>
						<Link href="/app/suggestions" className="hover:text-foreground">
							Suggestions
						</Link>
					</nav>
				</div>
				<div className="flex items-center gap-3">
					<Link href="/connect" className="text-sm text-muted-foreground hover:text-foreground">
						Connect agent
					</Link>
				</div>
			</header>
			<main className="flex-1 px-6 py-6">{children}</main>
		</div>
	);
}
