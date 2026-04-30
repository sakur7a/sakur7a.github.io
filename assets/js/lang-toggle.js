(function () {
  var STORAGE_KEY = 'lang';

  function getLang() {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    applyLang(lang);
  }

  function isInHeader(el) {
    return !!el.closest('header');
  }

  function applyLang(lang) {
    var enEls = document.querySelectorAll('.lang-en');
    var zhEls = document.querySelectorAll('.lang-zh');

    for (var i = 0; i < enEls.length; i++) {
      if (isInHeader(enEls[i])) {
        enEls[i].style.visibility = lang === 'en' ? 'visible' : 'hidden';
        enEls[i].style.position = lang === 'en' ? '' : 'absolute';
      } else {
        enEls[i].style.display = lang === 'en' ? '' : 'none';
      }
    }

    for (var i = 0; i < zhEls.length; i++) {
      if (isInHeader(zhEls[i])) {
        zhEls[i].style.visibility = lang === 'zh' ? 'visible' : 'hidden';
        zhEls[i].style.position = lang === 'zh' ? '' : 'absolute';
      } else {
        zhEls[i].style.display = lang === 'zh' ? '' : 'none';
      }
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
