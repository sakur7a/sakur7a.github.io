import { test, expect } from '@playwright/test';
import baseline from './migration-baseline.json' with { type: 'json' };
import { SITE_ORIGIN, canonicalPostPermalink } from '../src/config/site.js';

test('homepage and blog share theme while homepage stays in English', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lang', 'zh'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Jinzheng Wang', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.lang-toggle-btn, .lang-zh')).toHaveCount(0);
  await page.locator('.dark-toggle-btn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: 'Blog', exact: true }).click();
  await expect(page).toHaveURL(/\/Blog\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#J_theme_toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Jinzheng Wang', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('old homepage theme preference is retained', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dark-mode', 'true'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(32, 33, 43)');
});

test('all original posts keep their heading anchors, images, tables and formulas', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const post of baseline) {
    const response = await page.goto(post.url, { waitUntil: 'commit' });
    expect(response.status(), post.url).toBe(200);
    const canonical = canonicalPostPermalink(post.url);
    await expect(page).toHaveURL(url => url.pathname === canonical);
    const content = page.locator('#post-content');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE_ORIGIN}${canonical}`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${SITE_ORIGIN}${canonical}`);
    const headings = await content.locator('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]').evaluateAll(nodes => nodes.map(node => ({ level: Number(node.tagName[1]), id: node.id })));
    const originalHeadings = post.headings.filter(({ id }) => id !== 'post-toc-title');
    expect(headings, post.url).toEqual(originalHeadings.map(({ level, id }) => ({ level, id })));
    const images = await content.locator('img').evaluateAll(nodes => nodes.map(node => decodeURIComponent(node.getAttribute('src'))));
    expect(images, post.url).toEqual(post.images.map(decodeURIComponent));
    await expect.poll(() => content.locator('img').evaluateAll(nodes => nodes.every(node => node.complete && node.naturalWidth > 0)), { timeout: 15000 }).toBe(true);
    expect(await page.locator('table').count(), post.url).toBe(post.tables);
    if (post.formulas.length) {
      const equations = content.locator('.math-display[data-latex]');
      await expect(equations, post.url).toHaveCount(post.formulas.length);
      const formulas = await equations.evaluateAll(nodes => nodes.map(node => node.dataset.latex.slice(2, -2).replace(/\s+/g, ' ').trim()));
      expect(formulas, post.url).toEqual(post.formulas.map(value => value.replace(/\s+/g, ' ').trim()));
      await expect(content.locator('.katex-error'), post.url).toHaveCount(0);
    }
  }
  expect(errors).toEqual([]);
});

test('an old article URL keeps its query and heading fragment', async ({ page }) => {
  await page.goto('/Blog/2026-06-29/data-lab.html?from=old#3-istmax', { waitUntil: 'commit' });
  await expect(page).toHaveURL(/\/Blog\/2026-06-29\/data-lab\/\?from=old#3-istmax$/);
  await expect(page.locator('#post-content [id="3-istmax"]')).toBeInViewport();
});

test('feed, search and sitemap retain all published articles without source notes', async ({ request }) => {
  const search = await (await request.get('/Blog/search.json')).json();
  const urls = search.map(entry => entry.url);
  expect(urls).toEqual(expect.arrayContaining(baseline.map(entry => canonicalPostPermalink(entry.url))));
  expect(urls.every(url => url.endsWith('/'))).toBe(true);
  expect(new Set(urls).size).toBe(urls.length);
  const feed = await (await request.get('/Blog/feed.xml')).text();
  for (const url of urls) expect(feed).toContain(`<link href="${SITE_ORIGIN}${url}"/>`);
  for (const post of baseline) expect(feed).toContain(`<id>https://sakur7a.github.io${post.url}</id>`);
  expect(feed.match(/<entry>/g)).toHaveLength(urls.length);
  expect(feed).toContain('<content type="html">');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain(`<loc>${SITE_ORIGIN}/</loc>`);
  expect(sitemap).toContain(`<loc>${SITE_ORIGIN}/Blog/archive/</loc>`);
  expect(sitemap).toContain(`<loc>${SITE_ORIGIN}/Blog/about/</loc>`);
  for (const url of urls) expect(sitemap).toContain(`<loc>${SITE_ORIGIN}${url}</loc>`);
  for (const post of baseline) expect(sitemap).not.toContain(`<loc>${SITE_ORIGIN}${post.url}</loc>`);
  for (const url of ['/obsidian/Published/ML.md', '/scripts/obsidian-publish.js', '/tools/obsidian-publisher/plugin/main.js', '/_posts/2026-05-07-ml.md']) {
    expect((await request.get(url)).status()).toBe(404);
  }
});

test('the retired Moments page and notes are no longer public', async ({ page, request }) => {
  const retired = [
    '/Blog/moments.html',
    '/Blog/2026-06-12/2026-6-12.html',
    '/Blog/2026-06-22/2026-6-22.html',
    '/Blog/2026-06-22/2026-6-23.html',
    '/Blog/2026-06-26/2026-6-26.html',
    '/Blog/2026-06-30/2026630.html',
  ];
  await page.goto('/Blog/');
  await expect(page.getByRole('link', { name: 'Moments', exact: true })).toHaveCount(0);
  for (const url of retired) expect((await request.get(url)).status(), url).toBe(404);
  for (const path of ['/sitemap.xml', '/Blog/sitemap.xml']) {
    const sitemap = await (await request.get(path)).text();
    for (const url of retired) expect(sitemap).not.toContain(url);
  }
});

test('article images open in the existing lightbox', async ({ page }) => {
  await page.goto('/Blog/2026-07-16/freely/');
  await page.waitForFunction(() => typeof PhotoSwipeLightbox !== 'undefined');
  await page.locator('#post-content img').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
  // PhotoSwipe reveals its neighboring slides when the opening animation ends.
  await expect(page.locator('.pswp__item').first()).toHaveCSS('display', 'block');
  await page.keyboard.press('Escape');
  await expect(page.locator('.pswp')).not.toBeVisible();
});

test('untagged code gets shared highlighting and copies with an icon button', async ({ page }) => {
  await page.goto('/Blog/2026-06-29/data-lab/');
  const block = page.locator('.highlight').filter({ hasText: 'Tmax + (Tmax + 1)' });
  const pre = block.locator('pre');
  await expect(pre).toHaveAttribute('data-language', 'generic-code');
  const number = pre.getByText('0111...1111', { exact: true }).first();
  await expect(number).toBeVisible();
  const darkColor = await number.evaluate(element => getComputedStyle(element).color);
  await page.locator('#J_theme_toggle').click();
  const lightColor = await number.evaluate(element => getComputedStyle(element).color);
  expect(lightColor).not.toBe(darkColor);
  expect(lightColor).not.toBe(await pre.evaluate(element => getComputedStyle(element).color));

  const copy = block.getByRole('button', { name: '复制代码' });
  await expect(copy.locator('svg')).toBeVisible();
  await expect(copy).toHaveText('');
  await page.evaluate(() => {
    window.copiedCode = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedCode = text; } } });
  });
  const expected = await block.locator('pre code').textContent();
  await copy.click();
  await expect.poll(() => page.evaluate(() => window.copiedCode)).toBe(expected);
});
