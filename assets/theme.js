export function detectThemeMode() {
  return localStorage.getItem('fmc-theme') || 'auto';
}

export function applyTheme(mode) {
  const resolved = mode === 'auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.documentElement.dataset.theme = resolved;
  if (mode === 'auto') localStorage.removeItem('fmc-theme');
  else localStorage.setItem('fmc-theme', mode);
  document.dispatchEvent(new Event('fmc:themechange'));
}

export function init() {
  applyTheme(detectThemeMode());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (detectThemeMode() === 'auto') applyTheme('auto');
  });
}
