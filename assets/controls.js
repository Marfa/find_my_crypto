import { applyTheme, detectThemeMode } from './theme.js';
import { setLang } from './i18n.js';

const SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
const MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

export function mountToolbar(container, { t }) {
  container.innerHTML = `
    <div class="icon-group" role="group" aria-label="${t('theme')}">
      <button type="button" class="icon-btn" id="theme-light" title="${t('themeLight')}">${SUN}</button>
      <button type="button" class="icon-btn" id="theme-dark" title="${t('themeDark')}">${MOON}</button>
    </div>
    <div class="icon-group" role="group" aria-label="${t('lang')}">
      <button type="button" class="icon-btn lang-btn" id="lang-en" title="English">EN</button>
      <button type="button" class="icon-btn lang-btn" id="lang-ru" title="Русский">RU</button>
    </div>`;

  const btnLight = container.querySelector('#theme-light');
  const btnDark = container.querySelector('#theme-dark');
  const btnEn = container.querySelector('#lang-en');
  const btnRu = container.querySelector('#lang-ru');

  function syncThemeButtons() {
    const mode = detectThemeMode();
    btnLight.classList.toggle('active', mode === 'light');
    btnDark.classList.toggle('active', mode === 'dark');
    btnLight.classList.toggle('auto', mode === 'auto');
    btnDark.classList.toggle('auto', mode === 'auto');
  }

  function syncLangButtons() {
    const saved = localStorage.getItem('fmc-lang');
    btnEn.classList.toggle('active', saved === 'en');
    btnRu.classList.toggle('active', saved === 'ru');
    btnEn.classList.toggle('auto', !saved);
    btnRu.classList.toggle('auto', !saved);
  }

  btnLight.addEventListener('click', () => {
    applyTheme(detectThemeMode() === 'light' ? 'auto' : 'light');
    syncThemeButtons();
  });
  btnDark.addEventListener('click', () => {
    applyTheme(detectThemeMode() === 'dark' ? 'auto' : 'dark');
    syncThemeButtons();
  });
  btnEn.addEventListener('click', () => {
    setLang(localStorage.getItem('fmc-lang') === 'en' ? 'auto' : 'en');
    syncLangButtons();
  });
  btnRu.addEventListener('click', () => {
    setLang(localStorage.getItem('fmc-lang') === 'ru' ? 'auto' : 'ru');
    syncLangButtons();
  });

  document.addEventListener('fmc:langchange', syncLangButtons);
  document.addEventListener('fmc:themechange', syncThemeButtons);

  syncThemeButtons();
  syncLangButtons();
}

export function refreshToolbar({ t }) {
  const root = document.getElementById('toolbar');
  if (!root) return;
  const light = root.querySelector('#theme-light');
  const dark = root.querySelector('#theme-dark');
  if (light) light.title = t('themeLight');
  if (dark) dark.title = t('themeDark');
  root.querySelector('[aria-label]')?.setAttribute('aria-label', t('theme'));
  root.querySelectorAll('[role="group"]')[1]?.setAttribute('aria-label', t('lang'));
}
