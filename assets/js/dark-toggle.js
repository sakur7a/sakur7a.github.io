(function () {
  var STORAGE_KEY = 'dark-mode';

  function isDark() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }

  function setDark(dark) {
    document.body.classList.toggle('dark-mode', dark);
    localStorage.setItem(STORAGE_KEY, dark);
    updateIcon();
  }

  function updateIcon() {
    var icon = document.querySelector('.dark-toggle-btn i');
    if (!icon) return;
    icon.className = document.body.classList.contains('dark-mode')
      ? 'fa-solid fa-sun'
      : 'fa-solid fa-moon';
  }

  // Apply saved preference on load
  if (isDark()) {
    document.body.classList.add('dark-mode');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.dark-toggle-btn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      setDark(!document.body.classList.contains('dark-mode'));
    });

    updateIcon();

    // Dark mode style for the toggle bar
    var style = document.createElement('style');
    style.textContent = '.dark-mode .toggle-bar a { color: #3eb7f0 !important; }';
    document.head.appendChild(style);
  });
})();
