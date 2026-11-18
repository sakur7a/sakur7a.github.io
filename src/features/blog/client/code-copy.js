import { copyText } from "./clipboard.js";

export function mountCodeCopy() {
  var highlights = document.querySelectorAll(".highlighter-rouge > div.highlight");
  if (!highlights.length) return;

  highlights.forEach(function (highlight) {
    if (highlight.querySelector(".highlight-header")) return;

    var code = highlight.querySelector("code");
    var language = "";

    if (code) {
      language = code.getAttribute("data-lang") || "";
      if (!language && code.className) {
        var match = code.className.match(/language-([a-z0-9_+.-]+)/i);
        language = match ? match[1] : "";
      }
    }

    var header = document.createElement("div");
    header.className = "highlight-header";
    header.innerHTML =
      '<div class="highlight-dots">' +
      '<span class="dot-red"></span><span class="dot-yellow"></span><span class="dot-green"></span>' +
      "</div>" +
      '<span class="highlight-lang"></span>' +
      '<span class="copy-btn">Copy</span>';
    header.querySelector(".highlight-lang").textContent = language;
    highlight.insertBefore(header, highlight.firstChild);

    var copyBtn = header.querySelector(".copy-btn");
    copyBtn.addEventListener("click", function () {
      var pre = highlight.querySelector("pre");
      if (!pre) return;
      copyText(pre.innerText).then(function () {
        copyBtn.textContent = "✓ Copied";
        copyBtn.style.color = "#27c93f";
        setTimeout(function () {
          copyBtn.textContent = "Copy";
          copyBtn.style.color = "";
        }, 2000);
      }).catch(function () {
        copyBtn.textContent = "✗ Failed";
        setTimeout(function () {
          copyBtn.textContent = "Copy";
        }, 2000);
      });
    });
  });
}
