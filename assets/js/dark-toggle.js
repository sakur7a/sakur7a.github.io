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
    if (document.body.classList.contains('dark-mode')) {
      icon.className = 'fa-solid fa-sun';
    } else {
      icon.className = 'fa-solid fa-moon';
    }
  }

  // Apply saved preference on load
  if (isDark()) {
    document.body.classList.add('dark-mode');
  }

  // Insert toggle button after social icons
  document.addEventListener('DOMContentLoaded', function () {
    var socialIcons = document.querySelector('.social-icons');
    if (!socialIcons) return;

    var btn = document.createElement('a');
    btn.href = 'javascript:void(0)';
    btn.className = 'dark-toggle-btn';
    btn.title = 'Toggle dark mode';
    btn.innerHTML = '<i class="fa-solid fa-moon"></i><span class="social-label">Dark Mode</span>';
    btn.style.cssText = 'display:flex;align-items:center;gap:0.8rem;width:100%;background-color:transparent;color:#043361;text-align:left;font-size:1.15rem;line-height:1.4;padding:0.4rem 0;text-decoration:none;cursor:pointer;margin-top:0.5rem;transition:transform 0.2s ease;';

    btn.querySelector('i').style.cssText = 'width:2rem;text-align:center;flex-shrink:0;';

    btn.addEventListener('click', function () {
      setDark(!document.body.classList.contains('dark-mode'));
    });

    btn.addEventListener('mouseenter', function () {
      btn.style.transform = 'translateX(5px)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.transform = '';
    });

    socialIcons.appendChild(btn);

    // Update icon to match current state
    updateIcon();

    // Override dark mode button color
    var style = document.createElement('style');
    style.textContent = '.dark-mode .dark-toggle-btn { color: #3eb7f0 !important; } .dark-mode .dark-toggle-btn .social-label { color: #3eb7f0; }';
    document.head.appendChild(style);
  });
})();
