import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function HomePage() {
	return (
		<main className="container flex min-h-screen flex-col items-center justify-center gap-8 py-12 text-center">
			<div className="max-w-2xl">
				<h1 className="text-4xl font-semibold tracking-tight md:text-5xl">AgentSync</h1>
				<p className="mt-4 text-lg text-muted-foreground">
					One operational data layer for your AI agents — secure, schema-first, and built for teams.
				</p>
			</div>
			<div className="flex gap-3">
				<Button asChild size="lg">
					<Link href="/sign-in">Sign in</Link>
				</Button>
				<Button asChild size="lg" variant="ghost">
					<Link href="/connect">Connect an agent</Link>
				</Button>
			</div>
			<p className="text-xs text-muted-foreground">
				Self-hosted by your team. Your data stays in your infrastructure.
			</p>
		</main>
	);
}
