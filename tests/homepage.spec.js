import { test, expect } from '@playwright/test';

test('homepage navigation reaches sections and the mobile menu closes correctly', async ({ page, isMobile }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  const menu = page.locator('.menu-toggle-btn');

  if (isMobile) {
    await expect(navigation).not.toBeVisible();
    const scrollBeforeMenu = await page.evaluate(() => window.scrollY);
    await menu.click();
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeMenu);
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(navigation).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();
    await menu.click();
  }

  for (const section of ['Education', 'Publications']) {
    const hash = `#${section.toLowerCase()}`;
    await navigation.getByRole('link', { name: section, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${hash}$`));
    await expect(page.getByRole('heading', { name: section, exact: true })).toBeInViewport();
    if (isMobile) {
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await expect(navigation).not.toBeVisible();
      await menu.click();
    }
    await expect(navigation.getByRole('link', { name: section, exact: true })).toHaveAttribute('aria-current', 'location');
  }
  await navigation.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page).toHaveURL(/\/#about$/);
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeInViewport();

  const links = page.getByRole('navigation', { name: 'Profile links' });
  expect(await links.getByRole('link').evaluateAll(nodes => nodes.map(node => [node.getAttribute('aria-label'), node.getAttribute('href')]))).toEqual([
    ['GitHub', 'https://github.com/sakur7a'],
    ['Home', '/'],
    ['Blog', '/Blog/'],
    ['Email', 'mailto:sakur7a@outlook.com'],
  ]);
  expect(errors).toEqual([]);
});
