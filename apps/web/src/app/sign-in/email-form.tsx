'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useTransition } from 'react';

export function EmailForm({
	action,
}: {
	action: (formData: FormData) => Promise<{ error?: string; sent?: boolean }>;
}) {
	const [pending, start] = useTransition();
	const [message, setMessage] = useState<string | null>(null);

	return (
		<form
			className="space-y-3"
			action={(formData) => {
				setMessage(null);
				start(async () => {
					const result = await action(formData);
					if (result.error) setMessage(`Error: ${result.error}`);
					else if (result.sent) setMessage('We sent you a verification code. Check your inbox.');
				});
			}}
		>
			<Input name="email" type="email" required placeholder="you@yourdomain.com" />
			<Button type="submit" className="w-full" disabled={pending}>
				{pending ? 'Sending…' : 'Send verification code'}
			</Button>
			{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
		</form>
	);
}
