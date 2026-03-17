import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession } from '$lib/server/auth';

const PUBLIC_PATHS = ['/login'];

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
		return resolve(event);
	}

	const token = event.cookies.get('session');

	if (!token || !validateSession(token)) {
		const redirectTo = path !== '/' ? `?redirect=${encodeURIComponent(path)}` : '';
		redirect(303, `/login${redirectTo}`);
	}

	event.locals.authenticated = true;
	return resolve(event);
};
