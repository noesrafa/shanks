import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { checkPassword, createSession, validateSession } from '$lib/server/auth';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const token = cookies.get('session');
	if (token && validateSession(token)) {
		const redirectTo = url.searchParams.get('redirect') || '/';
		redirect(303, redirectTo);
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const password = data.get('password') as string;

		if (!password || !checkPassword(password)) {
			return fail(401, { error: 'Contraseña incorrecta' });
		}

		const token = createSession();
		cookies.set('session', token, {
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			path: '/',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		const redirectTo = url.searchParams.get('redirect') || '/';
		redirect(303, redirectTo);
	}
};
