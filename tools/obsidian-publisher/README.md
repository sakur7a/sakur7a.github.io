# Obsidian publisher

This optional package converts Obsidian notes into the site's public Markdown format. Astro builds `_posts/`, standalone pages in `content/pages/`, and assets in `public/`. The publisher also keeps source snapshots in `obsidian/Published/` for republishing.

Install and test from the repository root.

```powershell
npm --prefix tools/obsidian-publisher ci
npm run test:publisher
```

## Plugin and CLI

The plugin source is in `plugin/`. The plugin keeps the `select-post-to-publish` and `manage-content` command IDs used by Hearth. To install updated plugin files into the Vault, run `npm run plugin:sync` and reload the plugin in Obsidian. The sync copies the plugin files and preserves Vault settings.

```powershell
npm run post:publish -- "C:\path\to\vault\article.md" --vault-root "C:\path\to\vault"
node scripts/list-posts.js
node scripts/list-posts.js --remote
node scripts/manage-pages.js list
```

The installed plugin calls the existing `scripts/*.js` entry points. Those files forward to this package. The remote listing caches snapshots in `.publisher-cache/`. Handwritten articles appear in the list with no linked Vault snapshot.

The publisher checks `origin/main` before changing a Vault note. It rejects private front matter and updates content in an isolated worktree based on `origin/main`. It retries once if another publisher advances the branch. Republishing preserves the original publication date, cover, crop, and custom metadata. Edit the body of a handwritten post directly in `_posts/`.

“Submitted” means the content commit was pushed. “Deployed” means the matching Pages workflow completed. The plugin reports both states and keeps failed drafts available for retry.
