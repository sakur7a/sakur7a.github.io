import { test, expect } from "@playwright/test";

const ML_POST = "2026-05-07/ml/";
const DATA_LAB_POST = "2026-06-29/data-lab/";
const DECOMPOSITION_TITLE = "图层分解：1. 从 qwen-image-layered 开始";

test("home page shows all articles in publication order", async ({ page }) => {
  await page.goto("./");

  const navigation = page.getByRole("navigation", { name: "Blog navigation" });
  await expect(navigation.getByRole("link", { name: "Archive" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "About" })).toHaveAttribute("href", "/Blog/about.html");
  await expect(navigation.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/sakur7a");
  await expect(navigation.getByRole("link", { name: "RSS" })).toHaveAttribute("href", "/Blog/feed.xml");
  await expect(page.getByRole("heading", { name: "Sakura Blog", level: 1 })).toBeVisible();
  await expect(page.getByText("记录技术、生活和一些长期有效的小想法", { exact: true })).toHaveCount(0);
  const list = page.getByRole("region", { name: "文章列表" });
  await expect(list.getByRole("heading").first()).toHaveText("两年前的自己");
  await expect(list.getByRole("link", { name: "随便写写" })).toHaveAttribute("href", "/Blog/2026-07-16/freely/");
  const dates = await list.locator("time").allTextContents();
  expect(dates).toEqual([...dates].sort().reverse());
  await expect(list.locator("img")).toHaveCount(0);
});

test("theme toggle switches and persists the color mode", async ({ page }) => {
  await page.goto("./");

  const toggle = page.locator("#J_theme_toggle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-label", "Switch to light mode");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("a current post starts with the article while its cover remains in link previews", async ({ page }) => {
  await page.goto("2026-07-16/freely/");

  await expect(page.getByRole("heading", { name: "随便写写" })).toBeVisible();
  await expect(page.locator(".post-cover")).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /2026-07-16-freely\/cover\.webp$/);
  await expect(page.getByText("刚考完期末考，有点心烦，来审判下自己吧。图片是文山湖。")).toBeVisible();
  await expect(page.locator('#post-content img[src*="791350730a0e9bb6beac365f247886df.webp"]')).toBeVisible();
});

test("about page displays text with its configured image available to link previews", async ({ page }) => {
  await page.goto("about.html");

  await expect(page.getByRole("heading", { name: "About", level: 1 })).toBeVisible();
  await expect(page.locator(".post-cover")).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /wallhaven-k8kdqm-1778501257207\.png$/);
});

test("search finds a current post", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Search" }).click();
  const query = page.getByRole("searchbox");
  await query.fill("图层分解 QWEN");
  await expect(page.getByRole("heading", { name: DECOMPOSITION_TITLE })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("找到 1 篇文章");
  await query.fill("ZZZnoSuchPost");
  await expect(page.getByRole("status")).toHaveText("没有找到匹配的文章。");
  await query.clear();
  await expect(page.getByRole("heading", { name: "两年前的自己" })).toBeVisible();
});

test("search results are linkable and open the original article", async ({ page }) => {
  await page.goto("search.html");
  await page.getByRole("searchbox").fill("图层分解");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(page).toHaveURL(/search\.html\?q=/);
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue("图层分解");
  const result = page.getByRole("link", { name: DECOMPOSITION_TITLE });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/2026-07-15\/decomposition\/$/);
});

test("archive groups every published post and links to the categories", async ({ page, request }) => {
  const searchIndex = await (await request.get("search.json")).json();
  await page.goto("archive.html");

  await expect(page.locator("#essays")).toContainText("随便写写");
  await expect(page.locator("#study")).toContainText("ML");
  await expect(page.locator("#study")).toContainText("图层分解");
  const links = await page.locator(".archive-list a").evaluateAll(items => items.map(item => item.getAttribute("href")));
  expect(new Set(links)).toEqual(new Set(searchIndex.map(({ url }) => url)));

  for (const list of await page.locator(".archive-list").all()) {
    const dates = await list.locator("time").allTextContents();
    expect(dates).toEqual([...dates].sort().reverse());
  }

  const categories = page.getByRole("navigation", { name: "文章分类" });
  await categories.getByRole("link", { name: /^学习/ }).click();
  await expect(page).toHaveURL(/#study$/);
});

test("ML post supports math and heading navigation", async ({ page }) => {
  await page.goto(ML_POST);

  await expect(page.locator(".post-toc")).toBeAttached();
  await expect(page.locator("#post-toc-title")).toBeAttached();
  await expect(page.locator(".post-toc a", { hasText: "PCA 的核心目的" })).toBeAttached();
  await expect(page.locator("#post-content .math-display .katex-html").first()).toBeVisible();
  const inline = page.locator("#post-content .math-inline .katex").first();
  await expect(inline).toBeVisible({ timeout: 15000 });
  const fontRatio = await inline.evaluate(element =>
    parseFloat(getComputedStyle(element).fontSize) / parseFloat(getComputedStyle(element.parentElement).fontSize)
  );
  expect(fontRatio).toBeCloseTo(1, 2);
  await expect(page.locator("#post-content .math-inline").first()).toHaveCSS("overflow-x", "visible");
  await expect(page.locator(".post-toc .katex").first()).toBeAttached();
  await expect(page.locator(".post-toc .katex-error")).toHaveCount(0);
});

test("long equations stay inside the article on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(DATA_LAB_POST);

  const inline = page.locator('#post-content .math-inline[data-latex*="2147483647 + 2147483648"]');
  await expect(inline).toBeVisible();
  const wideDisplay = page.locator('#post-content .katex-display[data-math-scrollable="true"]').first();
  await expect(wideDisplay).toBeAttached();
  expect(await wideDisplay.evaluate(element => {
    element.scrollLeft = element.scrollWidth;
    return element.scrollLeft;
  })).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("post formulas expose copy buttons for latex source", async ({ page }) => {
  await page.goto(ML_POST);
  await page.waitForSelector(".math-copy-button", { timeout: 15000 });

  const copyButtons = page.locator(".math-copy-button");
  expect(await copyButtons.count()).toBeGreaterThan(10);
  await expect(copyButtons.first()).toHaveAttribute("data-latex", /^\$\$[\s\S]+\$\$$/);

  await page.evaluate(() => {
    window.__copiedLatex = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => { window.__copiedLatex = value; } }
    });
  });
  const latex = await copyButtons.first().getAttribute("data-latex");
  await copyButtons.first().click();
  await expect.poll(() => page.evaluate(() => window.__copiedLatex)).toBe(latex);
});

test("post toc highlights the section currently being read", async ({ page, isMobile }) => {
  await page.goto(ML_POST);
  const toc = page.locator(".post-toc");
  await toc.locator("summary").click();

  if (isMobile) {
    await toc.getByRole("link", { name: "1.1 PCA 的核心目的" }).click();
    await expect(page.getByRole("heading", { name: "1.1 PCA 的核心目的" })).toBeInViewport();
    return;
  }

  const section = page.getByRole("heading", { name: "2.1 总体知识结构" });
  await section.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 80));
  await expect(toc.getByRole("link", { name: "2.1 总体知识结构" })).toHaveAttribute("aria-current", "location");
});

test("post toc includes level-one sections without duplicating the post title", async ({ page }) => {
  await page.goto("2026-07-15/decomposition/");

  const tocLabels = await page.locator(".post-toc a").allTextContents();
  expect(tocLabels).toContain("一、背景");
  expect(tocLabels).toContain("二、发展");
  expect(tocLabels).not.toContain("图层分解：1. 从 qwen-image-layered 开始");
});

test("the reading column uses even leading and separates paragraphs with space", async ({ page }) => {
  await page.goto("2026-07-15/decomposition/");

  const typography = await page.locator("#post-content > p").evaluateAll((paragraphs) =>
    paragraphs.slice(0, 2).map(paragraph => {
      const { fontFamily, fontSize, lineHeight, marginBlockEnd, textAlign, textIndent } = getComputedStyle(paragraph);
      return { fontFamily, fontSize, lineHeight, marginBlockEnd, textAlign, textIndent };
    })
  );
  expect(typography).toHaveLength(2);
  expect(typography[0]).toEqual(typography[1]);
  const style = typography[0];
  expect(style.fontFamily).toContain("Inter Variable");
  expect(parseFloat(style.fontSize)).toBeGreaterThanOrEqual(17);
  expect(parseFloat(style.lineHeight) / parseFloat(style.fontSize)).toBeCloseTo(1.75, 2);
  expect(parseFloat(style.marginBlockEnd)).toBeGreaterThanOrEqual(17);
  expect(style.textAlign).toBe("start");
  expect(style.textIndent).toBe("0px");
});

test("post toc sits to the left of the article body on wide screens", async ({ page, isMobile }) => {
  test.skip(isMobile, "wide-screen placement only");
  for (const width of [1216, 1440, 1600]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(ML_POST);

    const toc = page.locator(".post-toc");
    await toc.locator("summary").click();
    const tocBox = await toc.boundingBox();
    const contentBox = await page.locator("#post-content").boundingBox();
    expect(tocBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(tocBox.x + tocBox.width).toBeLessThan(contentBox.x);
    expect(tocBox.x).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("ML post renders markdown tables", async ({ page }) => {
  await page.goto(ML_POST);

  const table = page.getByRole("table").first();
  await expect(table).toBeVisible();
  await expect(table).toContainText("是否用类别标签");
  await expect(table).toContainText("PCA / Eigenfaces");
});

test.describe("static reading", () => {
  test.use({ javaScriptEnabled: false });

  test("the feed of articles and the native table of contents work without JavaScript", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("link", { name: DECOMPOSITION_TITLE }).click();
    await page.locator(".post-toc summary").click();
    await page.getByRole("link", { name: "二、发展" }).click();
    await expect(page.getByRole("heading", { name: "二、发展" })).toBeInViewport();
    await page.goto("2026-06-29/data-lab.html", { waitUntil: "commit" });
    await expect(page).toHaveURL(/2026-06-29\/data-lab\/$/);
    await expect(page.locator("#post-content .math-display .katex-html").first()).toBeVisible();
    await expect(page.locator("#post-content .math-inline .katex-html").first()).toBeVisible();
  });
});
