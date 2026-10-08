import { test, expect } from '@playwright/test';
import baseline from './migration-baseline.json' with { type: 'json' };

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
    const response = await page.goto(post.url);
    expect(response.status(), post.url).toBe(200);
    const headings = await page.locator('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]').evaluateAll(nodes => nodes.map(node => ({ level: Number(node.tagName[1]), id: node.id })));
    expect(headings, post.url).toEqual(post.headings.map(({ level, id }) => ({ level, id })));
    const images = await page.locator('img').evaluateAll(nodes => nodes.map(node => decodeURIComponent(node.getAttribute('src'))));
    expect(images, post.url).toEqual(post.images.map(decodeURIComponent));
    await expect.poll(() => page.locator('img').evaluateAll(nodes => nodes.every(node => node.complete && node.naturalWidth > 0)), { timeout: 15000 }).toBe(true);
    expect(await page.locator('table').count(), post.url).toBe(post.tables);
    if (post.formulas.length) {
      await expect.poll(() => page.evaluate(() => window.MathJax?.startup?.document?.math ? Array.from(window.MathJax.startup.document.math).filter(item => item.display).length : 0), { timeout: 15000 }).toBe(post.formulas.length);
      const formulas = await page.evaluate(() => Array.from(window.MathJax.startup.document.math).filter(item => item.display).map(item => item.math.replace(/\s+/g, ' ').trim()));
      expect(formulas, post.url).toEqual(post.formulas.map(value => value.replace(/\s+/g, ' ').trim()));
    }
  }
  expect(errors).toEqual([]);
});

test('feed, search and sitemap retain all published articles without source notes', async ({ request }) => {
  const search = await (await request.get('/Blog/search.json')).json();
  expect(search.map(entry => entry.url).sort()).toEqual(baseline.map(entry => entry.url).sort());
  const feed = await (await request.get('/Blog/feed.xml')).text();
  for (const post of baseline) expect(feed).toContain(`https://sakur7a.github.io${post.url}`);
  expect(feed.match(/<entry>/g)).toHaveLength(baseline.length);
  expect(feed).toContain('<content type="html">');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('<loc>https://sakur7a.github.io/</loc>');
  for (const post of baseline) expect(sitemap).toContain(`https://sakur7a.github.io${post.url}`);
  for (const url of ['/obsidian/Published/ML.md', '/scripts/obsidian-publish.js', '/_posts/2026-05-07-ml.md']) expect((await request.get(url)).status()).toBe(404);
});

test('article images open in the existing lightbox', async ({ page }) => {
  // Observe the library lifecycle without changing its behavior or adding production test hooks.
  await page.route('**/Blog/assets/js/site.js', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('lightbox.init();', "lightbox.on('openingAnimationEnd', () => { window.lightboxReady = true; }); lightbox.init();");
    await route.fulfill({ response, body });
  });
  await page.goto('/Blog/2026-07-16/freely.html');
  await page.waitForFunction(() => typeof PhotoSwipeLightbox !== 'undefined');
  await page.locator('#post-content img').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
  await page.waitForFunction(() => window.lightboxReady === true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.pswp')).not.toBeVisible();
});

test('syntax highlighted code retains its copy action', async ({ page }) => {
  await page.goto('/Blog/2026-06-29/data-lab.html');
  const block = page.locator('.highlighter-rouge > .highlight').first();
  await expect(block.locator('.copy-btn')).toBeVisible();
  await page.evaluate(() => {
    window.copiedCode = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedCode = text; } } });
  });
  const expected = await block.locator('pre').innerText();
  await block.locator('.copy-btn').click();
  await expect.poll(() => page.evaluate(() => window.copiedCode)).toBe(expected);
});
