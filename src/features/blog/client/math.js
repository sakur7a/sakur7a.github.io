import { BLOG_ASSETS } from "../../../config/site.js";
import { copyText } from "./clipboard.js";

export function mountMath() {
  var content = document.getElementById("post-content");
  if (!content || (content.textContent.indexOf("$") === -1 && content.textContent.indexOf("\\[") === -1 && content.textContent.indexOf("\\(") === -1)) return;

  function latexWithDelimiters(item) {
    if (item.display) return "$$\n" + item.math + "\n$$";
    return "$" + item.math + "$";
  }

  function createMathCopyIcon(name) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute(
      "d",
      name === "check"
        ? "M20 6 9 17l-5-5"
        : "M8 8h10v10H8z M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
    );
    svg.appendChild(path);
    return svg;
  }

  function setMathCopyButtonState(button, copied) {
    button.replaceChildren(createMathCopyIcon(copied ? "check" : "copy"));
    button.setAttribute("data-copied", copied ? "true" : "false");
  }


  function enhanceMathCopy() {
    var mathItems = window.MathJax && window.MathJax.startup && window.MathJax.startup.document
      ? Array.from(window.MathJax.startup.document.math || [])
      : [];

    mathItems.forEach(function (item) {
      if (!item.typesetRoot) return;

      var latex = latexWithDelimiters(item);
      item.typesetRoot.setAttribute("data-latex", latex);
      item.typesetRoot.setAttribute("aria-label", latex);

      if (!item.display || item.typesetRoot.closest(".math-copy-wrap")) return;

      var mathNode = item.typesetRoot;
      var wrapper = document.createElement("div");
      wrapper.className = "math-copy-wrap";
      wrapper.setAttribute("data-latex", latex);

      var button = document.createElement("button");
      button.type = "button";
      button.className = "math-copy-button";
      button.setAttribute("aria-live", "polite");
      button.setAttribute("aria-label", "复制 LaTeX 公式");
      button.setAttribute("title", "复制 LaTeX 公式");
      button.setAttribute("data-latex", latex);
      setMathCopyButtonState(button, false);

      button.addEventListener("click", function () {
        copyText(latex).then(function () {
          setMathCopyButtonState(button, true);
          window.setTimeout(function () {
            setMathCopyButtonState(button, false);
          }, 1200);
        });
      });

      mathNode.parentNode.insertBefore(wrapper, mathNode);
      wrapper.appendChild(mathNode);
      wrapper.appendChild(button);
    });
  }


  function scheduleMathCopyEnhancement() {
    var attempts = 0;
    function tryEnhance() {
      attempts += 1;
      enhanceMathCopy();
      if (!document.querySelector(".math-copy-button") && attempts < 20) {
        window.setTimeout(tryEnhance, 120);
      }
    }
    tryEnhance();
  }

  window.MathJax = window.MathJax || {
    tex: {
      inlineMath: [["$", "$"], ["\\(", "\\)"]],
      displayMath: [["$$", "$$"], ["\\[", "\\]"]],
      processEscapes: true
    },
    options: {
      enableMenu: false,
      skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      renderActions: {
        addMenu: []
      }
    },
    startup: {
      ready: function () {
        if (window.MathJax.startup.defaultReady) {
          window.MathJax.startup.defaultReady();
        }
        scheduleMathCopyEnhancement();
      }
    }
  };

  if (document.getElementById("J_mathjax")) return;

  var script = document.createElement("script");
  script.id = "J_mathjax";
  script.async = true;
  script.src = `${BLOG_ASSETS}/vendor/mathjax/tex-chtml-full.js`;
  script.addEventListener("load", scheduleMathCopyEnhancement);
  document.head.appendChild(script);
  window.setTimeout(scheduleMathCopyEnhancement, 600);
}
