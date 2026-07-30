// Manual light/dark toggle, layered on top of the OS-level
// prefers-color-scheme default (see styles.css). No stored preference
// means "follow system"; once toggled, the explicit choice persists.
import { ICONS } from './icons.js';

const STORAGE_KEY = 'naghma-ledger-theme';

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function storedTheme() {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

function effectiveTheme() {
  return storedTheme() || (systemPrefersDark() ? 'dark' : 'light');
}

function applyTheme(theme) {
  if (theme) document.documentElement.setAttribute('data-theme', theme);
  else document.documentElement.removeAttribute('data-theme');
}

function updateButton(btn) {
  const dark = effectiveTheme() === 'dark';
  btn.innerHTML = dark ? ICONS.sun : ICONS.moon;
  btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
}

export function initTheme(toggleBtn) {
  applyTheme(storedTheme());
  updateButton(toggleBtn);

  toggleBtn.addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    updateButton(toggleBtn);
  });
}
