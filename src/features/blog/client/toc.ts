export function mountTableOfContents() {
  const nav = document.querySelector<HTMLElement>('.post-toc nav');
  if (!nav) return;

  const sections = Array.from(nav.querySelectorAll('a'), link => ({
    link,
    heading: document.getElementById(decodeURIComponent(link.hash.slice(1))),
  }));
  let current: HTMLAnchorElement | undefined;
  let scheduled = false;

  function updateCurrentSection() {
    scheduled = false;
    const readingLine = Math.min(128, window.innerHeight * 0.24);
    let active: HTMLAnchorElement | undefined;
    for (const { heading, link } of sections) {
      if (!heading) continue;
      if (heading.getBoundingClientRect().top > readingLine) break;
      active = link;
    }
    if (active === current) return;

    current?.removeAttribute('aria-current');
    active?.setAttribute('aria-current', 'location');
    current = active;
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateCurrentSection);
  }

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate, { once: true });
  scheduleUpdate();
}
