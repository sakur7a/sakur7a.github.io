(() => {
  const root = document.documentElement;
  const stored = () => { try { return localStorage.getItem('sakura-theme') || (localStorage.getItem('dark-mode') === 'true' ? 'dark' : 'light'); } catch { return 'light'; } };
  window.sakuraSetTheme = (theme, persist = true) => {
    root.dataset.theme = theme;
    root.classList.toggle('dark-mode', theme === 'dark');
    if (persist) { try { localStorage.setItem('sakura-theme', theme); localStorage.setItem('dark-mode', String(theme === 'dark')); } catch {} }
  };
  window.sakuraSetTheme(stored(), false);
})();
