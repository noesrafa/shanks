import type { RequestHandler } from './$types';
import { destroySession } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('session');
	if (token) {
		destroySession(token);
		cookies.delete('session', { path: '/' });
	}
	redirect(303, '/login');
};
