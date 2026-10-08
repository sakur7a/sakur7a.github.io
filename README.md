# Sakura personal site

One Astro project for Jinzheng Wang's homepage (`/`) and Sakura Blog (`/Blog/`), deployed together to GitHub Pages. The homepage uses an academic profile layout; the blog retains its existing appearance.

## Development

Use Node.js 24 and npm from this repository:

```powershell
npm ci
npm run dev
npm run build
npm run preview
npm test
```

The development server uses port 4321. Visit `http://localhost:4321/` and `http://localhost:4321/Blog/`. Build output is `dist/`. `npm test` runs unit tests, builds the site, checks public output, then runs desktop/mobile Playwright tests. Install the browser once with `npx playwright install --only-shell chromium`.

Astro is pinned to 7.3.6: the 7.3.0 content/image build referenced an unexported internal logger; the patch release fixes that path. Markdown explicitly uses the unified processor with remark-math, preserving TeX for the existing MathJax renderer and LaTeX copy buttons.

Sharp uses the patched 0.35 release line. The transitive KaTeX dependency is overridden to a patched 0.18 release; formulas continue to use MathJax. The lockfile records the reviewed versions, and dependency auditing is part of the cutover checks.

## Content and assets

- `_posts/`: public blog Markdown. Existing `permalink` values retain `/Blog/YYYY-MM-DD/slug.html`; the loader supports the existing front matter.
- `content/pages/`: editable standalone blog pages. Archive, Moments and the blog index are Astro pages.
- `public/Blog/assets/`: existing blog image and vendor URLs. `public/assets/` contains homepage assets and the shared self-hosted Chinese font.
- `obsidian/Published/`: original source snapshots for republishing; never part of `dist/`.
- `src/layouts/`: separate homepage and blog layouts. Both use the same saved theme preference. The homepage is English-only, including for visitors with an old saved Chinese language preference.

The homepage has a fixed header with About/Publications navigation and a theme toggle. Desktop uses a profile/content grid; mobile stacks the profile above the content with a collapsible navigation menu. The four profile links remain GitHub, Home, Blog and Email. Profile text is in `src/config/site.ts`, homepage content in `src/pages/index.astro`, and homepage styles in `src/styles/global.css`.

Published dates use Asia/Shanghai. Republishing preserves the original date and cover. Unknown front-matter fields survive content conversion. GitHub Pages output keeps the nested blog index and all original `.html` article URLs. The migration baseline checks 12 article URLs, heading IDs, images, mathematical expressions and tables. One old Jekyll parsing artifact—a norm expression rendered as an extra table—is intentionally rendered as math.

## Obsidian publishing and management

The plugin is version 0.7.2, under `obsidian/.obsidian/plugins/sakura-blog-publisher/`. It keeps `select-post-to-publish` and `manage-content`, so existing Hearth cards keep their command IDs. The writing vault remains where it is. The manager opens the article list; its Status tab includes publishing connection, repository and deployment actions.

Publishing uses an isolated worktree based on current `origin/main`. Only post/page content, its images and source snapshots can be committed; staged or uncommitted development files stay untouched. The publisher retries once when another content update advances remote main. Image conversion and metadata handling use Node.js; Ruby, Jekyll and PowerShell are not required.

```powershell
npm run post:publish -- "C:\path\to\vault\article.md" --vault-root "C:\path\to\vault"
node scripts/list-posts.js
node scripts/list-posts.js --remote
node scripts/manage-pages.js list
```

The remote listing uses an ignored `.publisher-cache/` for source files; it does not replace local development files. New pages and header edits are prepared locally and submitted through the page manager's push action. Private notes are rejected before any Git operation or public output.

“Submitted” means the content commit was pushed. “Deployed” means the matching main workflow completed successfully. The plugin provides both a status check for its latest submission and the Actions link; a failed status request does not change content or deployment.

The plugin checks remote `main` before changing a Vault note. Until the unified content schema is present there, publishing stops with a migration-pending message. Old saved `D:\MyBlog` settings migrate to `D:\MyHomepage\sakur7a.github.io`; unrelated settings remain intact. A failed submission keeps the editor and selected cover available for retry. Publishing reads the current note body, checks private front matter including UTF-8 BOMs, and article/page deletions retain the matching submission SHA for deployment checks. Legacy notes recover their published slugs, and untitled Moments derive distinct slugs from their note names. All 12 migrated articles explicitly map to their original source snapshots.

## Repository history and production cutover

This repository starts from one reviewed snapshot of the unified Astro project. The previous homepage repository is retained as `sakur7a.github.io-legacy-20261008`, including its template and migration history. The original `sakur7a/Blog` repository also retains its files and history. Source acknowledgements and licenses are preserved separately from Git history in `THIRD_PARTY_NOTICES.md` and `licenses/`.

The canonical repository is `sakur7a/sakur7a.github.io`. Its `main` workflow validates, builds and deploys both `/` and `/Blog/`; pull requests only validate. Deployment is restricted to this canonical repository, so temporary validation repositories and renamed backups do not deploy. The old Blog Pages publishing and deployment workflow are disabled after the unified deployment passes its production checks.

Production cutover completed on 2026-10-08. The unified homepage and blog retain their original URLs. The retained Blog and legacy homepage repositories have Pages and their deployment workflows disabled. Desktop/mobile production checks verified all 12 article addresses, images, RSS, search, formulas and shared theme state. Republishing preserves the currently published cover and crop, including when a Vault original contains older cover metadata; explicitly selecting a new cover or crop replaces it.

The desktop publisher is installed in the existing Vault and targets `D:\MyHomepage\sakur7a.github.io`. For plugin updates, run `npm run plugin:sync` and reload it in Obsidian. The original plugin is backed up at `D:/ProjectBackups/20261008-obsidian-unified/`; repository bundles, reviewed snapshots and cutover records are retained under `D:/ProjectBackups/20261008-clean-site/`.

For rollback, rename the unified repository aside, return the legacy homepage repository to `sakur7a.github.io`, restore its Pages workflow, and re-enable the old Blog Pages/workflow. Restore the previous vault plugin and its `D:\MyBlog` setting. Both retained repositories and the Vault remain available; the archived mobile publisher and private site are not part of this migration.

## References

- [Astro content collections](https://docs.astro.build/en/guides/content-collections/)
- [Astro 7 Markdown processor configuration](https://docs.astro.build/en/guides/upgrade-to/v7/#new-default-markdown-processor-s%C3%A4tteri)
- [GitHub Actions workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow)
