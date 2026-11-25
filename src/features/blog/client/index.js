import { bindThemeToggle } from '../../../shared/theme-toggle.js';

export function mountBlog() {
  const toggle = document.getElementById('J_theme_toggle');
  if (!toggle) return;

  bindThemeToggle(toggle, { toLight: 'Switch to light mode', toDark: 'Switch to dark mode' });
  toggle.hidden = false;
}
