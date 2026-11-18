import { bindThemeToggle } from '../../shared/theme-toggle.js';

export function mountHomepage() {
  const header = document.querySelector<HTMLElement>('.site-header');
  const navigation = header?.querySelector<HTMLElement>('.site-navigation');
  const menuButton = header?.querySelector<HTMLButtonElement>('.menu-toggle-btn');
  const themeButton = header?.querySelector<HTMLButtonElement>('.dark-toggle-btn');
  if (!header || !navigation || !menuButton || !themeButton) return;

  bindThemeToggle(themeButton, {
    toLight: 'Switch to light mode',
    toDark: 'Switch to dark mode',
  });

  const isMenuOpen = () => menuButton.getAttribute('aria-expanded') === 'true';
  const setMenuOpen = (open: boolean) => {
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    navigation.classList.toggle('is-open', open);
  };

  menuButton.addEventListener('click', () => setMenuOpen(!isMenuOpen()));
  navigation.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a')) setMenuOpen(false);
  });
  document.addEventListener('click', (event) => {
    if (event.target instanceof Node && !header.contains(event.target)) setMenuOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isMenuOpen()) {
      setMenuOpen(false);
      menuButton.focus();
    }
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', () => setMenuOpen(false));

  const links = Array.from(navigation.querySelectorAll('a'), link => ({
    link,
    hash: link.hash,
    section: document.getElementById(link.hash.slice(1)),
  }));

  const updateNavigation = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    const visible = links.filter(({ section }) => section && section.getBoundingClientRect().top <= 120).at(-1);
    const current = atBottom && links.some(({ hash }) => hash === location.hash)
      ? location.hash
      : (visible || links[0])?.hash;
    for (const { link, hash } of links) {
      link.classList.toggle('is-active', hash === current);
      if (hash === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };

  window.addEventListener('scroll', updateNavigation, { passive: true });
  window.addEventListener('hashchange', updateNavigation);
  updateNavigation();
}
