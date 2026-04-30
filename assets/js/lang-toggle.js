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
    updateLabel(lang);
  }

  function updateLabel(lang) {
    var label = document.querySelector('.lang-toggle-btn .toggle-label');
    if (label) {
      label.textContent = lang === 'en' ? '中文' : 'English';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.lang-toggle-btn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var current = getLang();
      setLang(current === 'en' ? 'zh' : 'en');
    });

    // Apply saved preference
    applyLang(getLang());
  });
})();
