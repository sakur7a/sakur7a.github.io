import { blogPaths } from '../../../config/site.js';
import type { SearchEntry } from '../endpoints';

function resultLink(item: SearchEntry) {
  const link = document.createElement('a');
  link.className = 'search-result';
  link.href = item.url;

  const title = document.createElement('strong');
  title.textContent = item.title;
  const excerpt = document.createElement('span');
  const date = document.createElement('time');
  date.className = 'date-text';
  date.dateTime = item.date;
  date.textContent = `【${item.date}】`;

  excerpt.append(date, item.summary);
  link.append(title, excerpt);
  return link;
}

export function mountSearch() {
  const open = document.getElementById('search-btn');
  const close = document.getElementById('J_search_close');
  const panel = document.getElementById('J_search_panel');
  const input = document.querySelector<HTMLInputElement>('#J_search_input');
  const results = document.getElementById('J_search_results');
  if (!open || !close || !panel || !input || !results) return;

  const url = open.dataset.searchUrl || blogPaths.search;
  let index: SearchEntry[] | undefined;
  let loading: Promise<void> | undefined;

  const render = () => {
    const query = input.value.trim().toLowerCase();
    const matches = (index || []).filter(item => `${item.title} ${item.summary}`.toLowerCase().includes(query));
    if (matches.length) {
      results.replaceChildren(...matches.map(resultLink));
    } else {
      const empty = document.createElement('p');
      empty.className = 'search-empty';
      empty.textContent = '没有找到匹配文章';
      results.replaceChildren(empty);
    }
  };

  const show = () => {
    panel.hidden = false;
    document.body.style.overflow = 'hidden';
    if (index) render();
    else if (!loading) {
      loading = fetch(url)
        .then(async response => {
          if (!response.ok) throw new Error(`Search index returned ${response.status}`);
          index = await response.json();
        })
        .catch(() => { index = undefined; })
        .finally(() => {
          loading = undefined;
          if (!panel.hidden) render();
        });
    }

    window.setTimeout(() => {
      if (!panel.hidden) input.focus();
    }, 20);
  };

  const hide = () => {
    panel.hidden = true;
    document.body.style.overflow = '';
    input.value = '';
  };

  open.addEventListener('click', show);
  close.addEventListener('click', hide);
  input.addEventListener('input', render);
  panel.addEventListener('click', event => {
    if (event.target === panel) hide();
  });
  window.addEventListener('keydown', event => {
    if (event.key === '/' && panel.hidden) {
      event.preventDefault();
      show();
    }
    if (event.key === 'Escape' && !panel.hidden) hide();
  });
}
