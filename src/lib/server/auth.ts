import { AUTH_PASSWORD, AUTH_SECRET } from '$env/static/private';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

interface Session {
	createdAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function createSession(): string {
	const token = randomBytes(32).toString('hex');
	const mac = sign(token);
	sessions.set(token, { createdAt: Date.now() });
	return `${token}.${mac}`;
}

export function validateSession(cookie: string): boolean {
	const dot = cookie.lastIndexOf('.');
	if (dot === -1) return false;
	const token = cookie.slice(0, dot);
	const mac = cookie.slice(dot + 1);
	if (!verifyMac(token, mac)) return false;
	const session = sessions.get(token);
	if (!session) return false;
	if (Date.now() - session.createdAt > SESSION_TTL_MS) {
		sessions.delete(token);
		return false;
	}
	return true;
}

export function destroySession(cookie: string): void {
	const dot = cookie.lastIndexOf('.');
	if (dot === -1) return;
	const token = cookie.slice(0, dot);
	sessions.delete(token);
}

export function checkPassword(password: string): boolean {
	const expected = Buffer.from(AUTH_PASSWORD);
	const provided = Buffer.from(password);
	if (expected.length !== provided.length) return false;
	return timingSafeEqual(expected, provided);
}

function sign(value: string): string {
	return createHmac('sha256', AUTH_SECRET).update(value).digest('hex');
}

function verifyMac(value: string, mac: string): boolean {
	const expected = sign(value);
	try {
		return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(mac, 'hex'));
	} catch {
		return false;
	}
}

