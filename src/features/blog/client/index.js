import { bindThemeToggle } from '../../../shared/theme-toggle.js';
import { mountCodeCopy } from './code-copy.js';
import { mountFireworks } from './fireworks.js';
import { mountImageLightbox } from './lightbox.js';
import { mountMath } from './math.js';
import { mountScrollNavigation } from './navigation.js';
import { mountSearch } from './search';
import { mountTableOfContents } from './toc';

function mountTheme() {
  const toggle = document.getElementById('J_theme_toggle');
  if (!toggle) return;

  const icon = document.querySelector('#J_theme_icon path');
  const moon = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';
  const sun = 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42';
  window.sakuraSetTheme(document.documentElement.dataset.theme || 'light');
  bindThemeToggle(toggle, { toLight: '切换浅色模式', toDark: '切换深色模式' }, dark => {
    icon?.setAttribute('d', dark ? sun : moon);
  });
}

export function mountBlog() {
  mountTheme();
  mountFireworks();
  mountScrollNavigation();
  mountSearch();
  mountTableOfContents();
  mountMath();
  mountCodeCopy();
  mountImageLightbox();
}
