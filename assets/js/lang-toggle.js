(function () {
  var STORAGE_KEY = 'lang';

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    applyLang(lang);
  }

  function applyLang(lang) {
    var enEls = document.querySelectorAll('.lang-en');
    var zhEls = document.querySelectorAll('.lang-zh');
    for (var i = 0; i < enEls.length; i++) {
      enEls[i].style.display = lang === 'en' ? '' : 'none';
    }
    for (var i = 0; i < zhEls.length; i++) {
      zhEls[i].style.display = lang === 'zh' ? '' : 'none';
    }
    updateBtn(lang);
  }

  function updateBtn(lang) {
    var label = document.querySelector('.lang-toggle-btn .social-label');
    if (label) {
      label.textContent = lang === 'en' ? '中文' : 'English';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var socialIcons = document.querySelector('.social-icons');
    if (!socialIcons) return;

    var btn = document.createElement('a');
    btn.href = 'javascript:void(0)';
    btn.className = 'lang-toggle-btn';
    btn.title = 'Toggle language';
    btn.innerHTML = '<i class="fa-solid fa-language"></i><span class="social-label">中文</span>';
    btn.style.cssText = 'display:flex;align-items:center;gap:0.8rem;width:100%;background-color:transparent;color:#043361;text-align:left;font-size:1.15rem;line-height:1.4;padding:0.4rem 0;text-decoration:none;cursor:pointer;margin-top:0.5rem;transition:transform 0.2s ease;';

    btn.querySelector('i').style.cssText = 'width:2rem;text-align:center;flex-shrink:0;';

    btn.addEventListener('click', function () {
      var current = getLang();
      setLang(current === 'en' ? 'zh' : 'en');
    });

    btn.addEventListener('mouseenter', function () {
      btn.style.transform = 'translateX(5px)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.transform = '';
    });

    socialIcons.appendChild(btn);

    // Apply saved preference
    applyLang(getLang());

    // Dark mode style for the button
    var style = document.createElement('style');
    style.textContent = '.dark-mode .lang-toggle-btn { color: #3eb7f0 !important; } .dark-mode .lang-toggle-btn .social-label { color: #3eb7f0; }';
    document.head.appendChild(style);
  });
})();
