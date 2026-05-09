'use client';

import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function CopyMcpUrl({ url }: { url: string }) {
	const [copied, setCopied] = useState(false);

	return (
		<div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
			<span className="flex-1 truncate">{url}</span>
			<Button
				type="button"
				variant="secondary"
				size="sm"
				onClick={async () => {
					await navigator.clipboard.writeText(url);
					setCopied(true);
					setTimeout(() => setCopied(false), 2000);
				}}
			>
				{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
				{copied ? 'Copied' : 'Copy'}
			</Button>
		</div>
	);
}
