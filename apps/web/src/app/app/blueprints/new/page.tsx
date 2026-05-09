import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { deployDraftBlueprint, draftBlueprint } from './actions';
import { DescribeForm } from './describe-form';

export default function DescribePage() {
	return (
		<div className="mx-auto max-w-2xl">
			<Card>
				<CardHeader>
					<CardTitle>Describe what you track</CardTitle>
					<CardDescription>
						Tell AgentSync about your business in a sentence or two and we'll draft a blueprint you
						can review before deploying.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<DescribeForm draft={draftBlueprint} deploy={deployDraftBlueprint} />
				</CardContent>
			</Card>
		</div>
	);
}
