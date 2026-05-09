import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFromCookies, isOk } from '@/lib/api';
import { redirect } from 'next/navigation';
import { acceptInvite } from './actions';

export default async function InvitePage({
	params,
}: {
	params: Promise<{ code: string }>;
}) {
	const { code } = await params;
	const api = await apiFromCookies();

	if (!api.isAuthenticated) {
		redirect(`/sign-in?return_to=${encodeURIComponent(`/invite/${code}`)}`);
	}

	return (
		<main className="container mx-auto max-w-md py-12">
			<Card>
				<CardHeader>
					<CardTitle>Accept team invite</CardTitle>
					<CardDescription>
						You've been invited to join a team on AgentSync. Click below to accept.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						action={async () => {
							'use server';
							const result = await acceptInvite(code);
							if (isOk(result)) redirect('/app');
							redirect(`/invite/${code}?error=${encodeURIComponent(result.error.message)}`);
						}}
					>
						<Button type="submit" className="w-full">
							Accept invite
						</Button>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
