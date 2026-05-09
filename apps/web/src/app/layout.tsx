import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
	title: 'AgentSync',
	description: 'Shared operational data layer for AI agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="min-h-screen antialiased">
				{children}
				<Toaster position="top-center" />
			</body>
		</html>
	);
}
