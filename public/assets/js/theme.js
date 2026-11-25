(() => {
  const root = document.documentElement;
  const defaultTheme = root.dataset.theme === 'dark' ? 'dark' : 'light';
  const stored = () => {
    try {
      const theme = localStorage.getItem('sakura-theme');
      if (theme === 'dark' || theme === 'light') return theme;
      const legacy = localStorage.getItem('dark-mode');
      if (legacy === 'true' || legacy === 'false') return legacy === 'true' ? 'dark' : 'light';
    } catch {}
    return defaultTheme;
  };
  window.sakuraSetTheme = (theme, persist = true) => {
    root.dataset.theme = theme;
    root.classList.toggle('dark-mode', theme === 'dark');
    if (persist) { try { localStorage.setItem('sakura-theme', theme); localStorage.setItem('dark-mode', String(theme === 'dark')); } catch {} }
  };
  window.sakuraSetTheme(stored(), false);
})();
