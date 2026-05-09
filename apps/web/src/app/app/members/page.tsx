import { apiFromCookies, isOk } from '@/lib/api';
import { redirect } from 'next/navigation';
import { createInvite } from './actions';
import { InvitePanel } from './invite-panel';

interface Member {
	id: string;
	email: string;
	status: string;
	roleId: string | null;
}

interface Role {
	id: string;
	name: string;
}

export default async function MembersPage() {
	const api = await apiFromCookies();
	if (!api.isAuthenticated) redirect('/sign-in');

	const [members, roles] = await Promise.all([
		api.get<Member[]>('/v1/members'),
		api.get<Role[]>('/v1/members/roles'),
	]);
	const memberData = isOk(members) ? members.data : [];
	const roleData = isOk(roles) ? roles.data : [];

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Members</h1>
				<p className="text-sm text-muted-foreground">Invite teammates and manage their roles.</p>
			</div>
			<InvitePanel roles={roleData} action={createInvite} />
			<div className="rounded-md border">
				<table className="w-full text-sm">
					<thead className="bg-muted/50 text-left">
						<tr>
							<th className="px-3 py-2">Email</th>
							<th className="px-3 py-2">Status</th>
							<th className="px-3 py-2">Role</th>
						</tr>
					</thead>
					<tbody>
						{memberData.map((m) => (
							<tr key={m.id} className="border-t">
								<td className="px-3 py-2">{m.email}</td>
								<td className="px-3 py-2">{m.status}</td>
								<td className="px-3 py-2">
									{roleData.find((r) => r.id === m.roleId)?.name ?? '—'}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
