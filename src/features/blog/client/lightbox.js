import { BLOG_ASSETS } from "../../../config/site.js";

export function mountImageLightbox() {
  var zoomImgs = document.querySelectorAll(".entry-content img");
  if (!zoomImgs.length) return;

  const vendorBase = `${BLOG_ASSETS}/vendor/photoswipe/`;

  function loadCSS(href) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src, callback) {
    var script = document.createElement("script");
    script.src = src;
    script.onload = callback;
    document.body.appendChild(script);
  }

  loadCSS(vendorBase + "photoswipe.css");

  loadScript(vendorBase + "photoswipe.umd.min.js", function () {
    loadScript(vendorBase + "photoswipe-lightbox.umd.min.js", function () {
      var lightbox = new window.PhotoSwipeLightbox({
        gallery: ".entry-content",
        children: "img",
        pswpModule: window.PhotoSwipe,
        bgOpacity: 0.92,
        padding: { top: 20, bottom: 20, left: 20, right: 20 },
        mainClass: "pswp--minimal"
      });

      lightbox.addFilter("domItemData", function (itemData, element) {
        if (!element) return itemData;
        if (element.classList.contains("emoji") || element.classList.contains("no-zoom")) return null;
        itemData.src = element.getAttribute("data-pswp-src") || element.currentSrc || element.src;
        itemData.w = element.naturalWidth || window.innerWidth;
        itemData.h = element.naturalHeight || window.innerHeight;
        itemData.msrc = element.src;
        return itemData;
      });

      lightbox.on("uiRegister", function () {
        lightbox.pswp.ui.registerElement({
          name: "custom-caption",
          order: 9,
          isButton: false,
          appendTo: "root",
          html: "",
          onInit: function (el, pswp) {
            pswp.on("change", function () {
              var curr = pswp.currSlide.data.element;
              var alt = curr ? (curr.getAttribute("alt") || "") : "";
              el.replaceChildren();
              if (alt) {
                const caption = document.createElement("div");
                caption.className = "pswp-caption";
                caption.textContent = alt;
                el.appendChild(caption);
              }
            });
          }
        });
      });

      lightbox.init();
    });
  });
}
