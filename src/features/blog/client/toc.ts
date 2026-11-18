function headingSlug(value: string, index: number) {
  const slug = value.trim().toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `heading-${index}`;
}

export function mountTableOfContents() {
  const content = document.getElementById('post-content');
  const toc = document.querySelector<HTMLElement>('.post-toc');
  const nav = document.getElementById('post-toc-nav');
  if (!content || !toc || !nav) return;

  const headings = Array.from(content.querySelectorAll<HTMLElement>('h1:not(.post-title), h2, h3, h4'));
  if (!headings.length) return;

  const headingCounts = new Map<string, number>();
  const links = new Map<HTMLElement, HTMLAnchorElement>();
  const list = document.createElement('ol');

  headings.forEach((heading, index) => {
    const text = heading.textContent || '';
    const baseId = heading.id || headingSlug(text, index + 1);
    const count = (headingCounts.get(baseId) || 0) + 1;
    headingCounts.set(baseId, count);
    heading.id = count === 1 ? baseId : `${baseId}-${count}`;
    heading.tabIndex = -1;

    const item = document.createElement('li');
    item.className = `toc-level-${heading.tagName.slice(1)}`;
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.textContent = text.trim();
    link.addEventListener('click', () => setActive(heading));
    item.append(link);
    list.append(item);
    links.set(heading, link);
  });

  nav.append(list);
  toc.hidden = false;
  document.body.classList.add('has-post-toc');

  function setActive(heading: HTMLElement) {
    const active = links.get(heading);
    for (const link of links.values()) {
      link.classList.toggle('is-active', link === active);
      if (link === active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    active?.scrollIntoView({ block: 'nearest' });
  }

  setActive(headings[0]);

  if ('IntersectionObserver' in window) {
    const visible = new Map<Element, number>();
    const reverseOrder = [...headings].reverse();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.set(entry.target, entry.intersectionRatio);
        else visible.delete(entry.target);
      }

      const active = headings.find(heading => visible.get(heading))
        || reverseOrder.find(heading => heading.getBoundingClientRect().top <= window.innerHeight * 0.32)
        || headings[0];
      setActive(active);
    }, {
      rootMargin: '-18% 0px -68% 0px',
      threshold: [0, 0.2, 0.6, 1],
    });
    for (const heading of headings) observer.observe(heading);
  }

  let ticking = false;
  function updateActiveByScroll() {
    ticking = false;
    const threshold = window.innerHeight * 0.36;
    let active = headings[0];
    let closestDistance = Infinity;

    for (const heading of headings) {
      const top = heading.getBoundingClientRect().top;
      const distance = Math.abs(top - threshold);
      if (top <= threshold || distance < closestDistance) {
        active = heading;
        closestDistance = distance;
      }
    }
    setActive(active);
  }

  function requestActiveUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateActiveByScroll);
  }

  window.addEventListener('scroll', requestActiveUpdate, { passive: true });
  window.addEventListener('resize', requestActiveUpdate);
  window.setTimeout(updateActiveByScroll, 80);
}
