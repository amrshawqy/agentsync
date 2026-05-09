'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState, useTransition } from 'react';

interface Role {
	id: string;
	name: string;
}

export function InvitePanel({
	roles,
	action,
}: {
	roles: Role[];
	action: (data: { email: string; roleId: string }) => Promise<{
		ok: boolean;
		link?: string;
		error?: string;
	}>;
}) {
	const [pending, start] = useTransition();
	const [link, setLink] = useState<string | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const [email, setEmail] = useState('');
	const [roleId, setRoleId] = useState(roles[0]?.id ?? '');

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Invite a teammate</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="grid gap-2 md:grid-cols-3">
					<Input
						type="email"
						placeholder="teammate@yourdomain.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>
					<select
						className="h-10 rounded-md border bg-background px-3 text-sm"
						value={roleId}
						onChange={(e) => setRoleId(e.target.value)}
					>
						{roles.map((r) => (
							<option key={r.id} value={r.id}>
								{r.name}
							</option>
						))}
					</select>
					<Button
						disabled={pending || !email || !roleId}
						onClick={() => {
							setErr(null);
							setLink(null);
							start(async () => {
								const result = await action({ email, roleId });
								if (result.ok && result.link) setLink(result.link);
								else setErr(result.error ?? 'Failed to create invite');
							});
						}}
					>
						{pending ? 'Sending…' : 'Send invite'}
					</Button>
				</div>
				{link ? (
					<p className="text-sm text-muted-foreground">
						Share this link: <code className="rounded bg-muted px-1.5 py-0.5">{link}</code>
					</p>
				) : null}
				{err ? <p className="text-sm text-destructive">{err}</p> : null}
			</CardContent>
		</Card>
	);
}
