import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'shanks-theme';

function getSystemTheme(): 'light' | 'dark' {
	if (!browser) return 'dark';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
	if (!browser) return;
	const resolved = theme === 'auto' ? getSystemTheme() : theme;
	document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function createThemeStore() {
	let theme = $state<Theme>('auto');

	function init() {
		if (!browser) return;
		const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
		theme = stored ?? 'auto';
		applyTheme(theme);

		// Watch for system theme changes when in auto mode
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			if (theme === 'auto') applyTheme('auto');
		});
	}

	function set(newTheme: Theme) {
		theme = newTheme;
		if (browser) localStorage.setItem(STORAGE_KEY, newTheme);
		applyTheme(newTheme);
	}

	return {
		get current() {
			return theme;
		},
		init,
		set
	};
}

export const themeStore = createThemeStore();
