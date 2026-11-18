export function mountScrollNavigation() {
  const header = document.getElementById("J_header");
  if (!header) return;

  const isMobile = /Android|iPhone|Windows Phone|iPad|iPod/.test(navigator.userAgent);
  if (isMobile) return;

  let before = document.documentElement.scrollTop;
  window.addEventListener("scroll", function () {
    const after = document.documentElement.scrollTop;
    const delta = after - before;
    if (delta > 0 && after > 0) {
      header.classList.add("header-menu-overflow");
    } else {
      header.classList.remove("header-menu-overflow");
    }
    before = after;
  }, { passive: true });
}
