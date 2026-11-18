/**
 * @param {HTMLElement} button
 * @param {{toLight: string; toDark: string}} labels
 * @param {(dark: boolean) => void} [setIcon]
 */
export function bindThemeToggle(button, labels, setIcon) {
  const root = document.documentElement;
  const isDark = () => root.classList.contains('dark-mode');

  function update() {
    const dark = isDark();
    const label = dark ? labels.toLight : labels.toDark;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    setIcon?.(dark);
  }

  button.addEventListener('click', () => {
    window.sakuraSetTheme(isDark() ? 'light' : 'dark');
    update();
  });
  update();
}
