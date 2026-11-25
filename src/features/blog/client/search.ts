export function mountSearch() {
  const form = document.querySelector<HTMLFormElement>('#blog-search');
  const input = document.querySelector<HTMLInputElement>('#search-query');
  const status = document.getElementById('search-status');
  if (!form || !input || !status) return;

  const posts = Array.from(document.querySelectorAll<HTMLElement>('.post-list-item'), element => {
    const title = element.querySelector('h2')?.textContent ?? '';
    const excerpt = element.querySelector('.post-excerpt')?.textContent ?? '';
    return { element, text: `${title} ${excerpt}`.toLowerCase() };
  });
  input.value = new URLSearchParams(location.search).get('q') ?? '';

  const filterPosts = () => {
    const words = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let found = 0;
    for (const { element, text } of posts) {
      const matches = words.every(word => text.includes(word));
      element.hidden = !matches;
      if (matches) found++;
    }
    status.textContent = !words.length ? '' : found ? `找到 ${found} 篇文章` : '没有找到匹配的文章。';
  };

  filterPosts();
  input.addEventListener('input', filterPosts);
  form.hidden = false;
}
