const { Modal, Notice, Plugin, PluginSettingTab, Setting, MarkdownRenderer, Component, FuzzySuggestModal, parseYaml } = require("obsidian");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
let electronShell = null;
try {
  electronShell = require("electron").shell;
} catch (error) {
  electronShell = null;
}

const DEFAULT_SETTINGS = {
  blogRoot: "D:\\MyHomepage\\sakur7a.github.io",
};

const CATEGORIES = ["随笔", "学习", "moments"];
const VISIBILITIES = ["public", "private"];
const SITE_URL = "https://sakur7a.github.io/Blog/";
const ACTIONS_URL = "https://github.com/sakur7a/sakur7a.github.io/actions/workflows/pages.yml";

function splitFrontMatter(content) {
  content = String(content).replace(/^\uFEFF/, "");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { yaml: "", body: content };
  return { yaml: match[1], body: match[2] };
}

function readYamlValue(yaml, key) {
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m");
  const match = yaml.match(pattern);
  if (!match) return "";
  const value = match[1].trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch (error) {}
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function writeYamlValue(yaml, key, value) {
  const line = `${key}: ${value}`;
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*.+?$`, "m");
  if (pattern.test(yaml)) return yaml.replace(pattern, () => line);
  return yaml.trim() ? `${yaml.trimEnd()}\n${line}` : line;
}

function quoteYaml(value) {
  return JSON.stringify(String(value || ""));
}

function firstSummary(body) {
  const plain = body
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/[#>*_`\[\]-]/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!plain) return "";
  return plain.length > 80 ? plain.slice(0, 80) : plain;
}

function hasMath(body) {
  return /(?<!\\)(?:\$\$|\\\[|\\\(|\$(?!\s)(?:[^$\n]|\\.)+\$)/m.test(String(body || ""));
}

function titleToSlug(title) {
  const slug = (title || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (slug) return slug;
  // Non-ASCII titles (e.g. Chinese) strip to nothing; use a stable hash so
  // different articles never collide on the same fallback slug.
  const hash = require("crypto").createHash("sha1").update(title || "post").digest("hex").slice(0, 6);
  return `post-${hash}`;
}

function fileTitle(filePath) {
  const name = String(filePath || "新文章.md").split(/[\\/]/).pop().replace(/\.md$/i, "");
  return name || "新文章";
}

function extractMetadata(content, filePath) {
  const { yaml, body } = splitFrontMatter(content);
  const categories = readYamlValue(yaml, "categories") || "[随笔]";
  const categoryMatch = categories.match(/[\[\s,]([^,\]\s]+)[,\]\s]?/);
  const category = categoryMatch ? categoryMatch[1] : "随笔";
  const isMoments = category === "moments";
  const title = readYamlValue(yaml, "title") || (isMoments ? "" : fileTitle(filePath));
  const summary = readYamlValue(yaml, "summary") || (isMoments ? "" : firstSummary(body));
  const coverPosition = readYamlValue(yaml, "cover_position") || "50% 50%";
  const slug = readYamlValue(yaml, "slug") || "";
  const declaredVisibility = parseYaml(yaml)?.visibility;
  const visibility = declaredVisibility == null ? "public" : String(declaredVisibility).trim().toLowerCase();
  if (!VISIBILITIES.includes(visibility)) throw new Error("可见性必须明确设置为 public 或 private。");
  return { title, summary, category, coverPosition, slug, visibility };
}

function applyMetadata(content, metadata) {
  const { yaml, body } = splitFrontMatter(content);
  let nextYaml = yaml;
  const isMoments = metadata.category === "moments";
  if (!isMoments && metadata.title) {
    nextYaml = writeYamlValue(nextYaml, "title", quoteYaml(metadata.title));
  }
  nextYaml = writeYamlValue(nextYaml, "categories", `[${metadata.category}]`);
  if (!isMoments && metadata.summary) {
    nextYaml = writeYamlValue(nextYaml, "summary", quoteYaml(metadata.summary));
    nextYaml = writeYamlValue(nextYaml, "description", quoteYaml(metadata.summary));
  }
  if (!isMoments && metadata.coverPosition) {
    nextYaml = writeYamlValue(nextYaml, "cover_position", quoteYaml(metadata.coverPosition));
  }
  if (metadata.slug) {
    nextYaml = writeYamlValue(nextYaml, "slug", metadata.slug);
  }
  nextYaml = writeYamlValue(nextYaml, "visibility", metadata.visibility === "private" ? "private" : "public");
  nextYaml = writeYamlValue(nextYaml, "math", hasMath(body) ? "true" : "false");
  return `---\n${nextYaml.trim()}\n---\n\n${body.trimStart()}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseCoverPosition(value) {
  const parts = String(value || "").match(/-?\d+(?:\.\d+)?/g) || [];
  return {
    x: clampPercent(Number(parts[0] ?? 50)),
    y: clampPercent(Number(parts[1] ?? 50))
  };
}

function formatCoverPosition(x, y) {
  return `${clampPercent(Number(x))}% ${clampPercent(Number(y))}%`;
}

function pathToFileUrl(filePath) {
  if (!filePath) return "";
  return `file:///${String(filePath).replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

function safeFileName(fileName) {
  const extension = path.extname(fileName || "cover.png").toLowerCase() || ".png";
  const baseName = path.basename(fileName || "cover", extension).replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${baseName || "cover"}-${Date.now()}${extension}`;
}

const COVER_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function stagedCoverDirectory(blogRoot) {
  return blogRoot ? path.resolve(blogRoot, ".obsidian-cover-upload") : "";
}

function isStagedCover(filePath, blogRoot) {
  const uploadDir = stagedCoverDirectory(blogRoot);
  if (!filePath || !uploadDir) return false;
  const relative = path.relative(uploadDir, path.resolve(filePath));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative) && path.dirname(relative) === ".";
}

function removeStagedCover(filePath, blogRoot) {
  if (!isStagedCover(filePath, blogRoot)) return false;
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const uploadDir = stagedCoverDirectory(blogRoot);
  if (fs.existsSync(uploadDir) && fs.readdirSync(uploadDir).length === 0) {
    fs.rmdirSync(uploadDir);
  }
  return true;
}

function cleanupStagedCovers(blogRoot, now = Date.now()) {
  const uploadDir = stagedCoverDirectory(blogRoot);
  if (!uploadDir || !fs.existsSync(uploadDir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(uploadDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const filePath = path.join(uploadDir, entry.name);
    if (now - fs.statSync(filePath).mtimeMs > COVER_UPLOAD_MAX_AGE_MS) {
      fs.unlinkSync(filePath);
      removed += 1;
    }
  }
  if (fs.readdirSync(uploadDir).length === 0) fs.rmdirSync(uploadDir);
  return removed;
}

async function stageCoverFile(file, blogRoot) {
  cleanupStagedCovers(blogRoot);
  const uploadDir = stagedCoverDirectory(blogRoot);
  fs.mkdirSync(uploadDir, { recursive: true });

  const targetPath = path.join(uploadDir, safeFileName(file.name));
  const bytes = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(targetPath, bytes);
  return targetPath;
}

module.exports = class SakuraBlogPublisher extends Plugin {
  async onload() {
    const saved = await this.loadData() || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    const legacyRoot = saved.blogRoot && path.win32.normalize(saved.blogRoot).replace(/[\\/]+$/, "").toLowerCase() === "d:\\myblog";
    if (legacyRoot) {
      this.settings.blogRoot = DEFAULT_SETTINGS.blogRoot;
      delete this.settings.lastSubmission;
    }
    if (!saved.blogRoot || legacyRoot) await this.saveSettings();
    try {
      cleanupStagedCovers(this.settings.blogRoot);
    } catch (error) {
      console.warn("Could not clean staged covers", error);
    }
    this.injectStyles();

    this.addRibbonIcon("send", "Sakura Blog", () => {
      this.openManageContentModal();
    });

    this.addCommand({
      id: "publish-current-post",
      name: "发布当前文章",
      callback: () => this.openPublishModal()
    });

    this.addCommand({
      id: "select-post-to-publish",
      name: "选择文章发布",
      callback: () => new PublishFileSuggestModal(this.app, (file) => this.openPublishModal(file)).open()
    });

    this.addCommand({
      id: "manage-content",
      name: "管理文章和页面",
      callback: () => this.openManageContentModal()
    });



    this.addSettingTab(new SakuraPublisherSettingTab(this.app, this));
  }

  async openPublishModal(file = null) {
    new ManageContentModal(this.app, this, { defaultTab: "publish", file }).open();
  }

  async getActiveDraft(file = this.app.workspace.getActiveFile()) {
    if (!file || file.extension !== "md") {
      new Notice("请先打开一篇 Markdown 草稿。");
      return null;
    }

    const adapter = this.app.vault.adapter;
    const vaultRoot = adapter.getBasePath ? adapter.getBasePath() : "";
    const absoluteDraftPath = path.join(vaultRoot, file.path);
    const relativeDraftPath = path.relative(this.settings.blogRoot, absoluteDraftPath);
    const isInsideBlog = !relativeDraftPath.startsWith("..") && !path.isAbsolute(relativeDraftPath);
    const publishPath = isInsideBlog ? relativeDraftPath : absoluteDraftPath;
    const displayPath = isInsideBlog ? relativeDraftPath : file.path;

    const content = await this.app.vault.read(file);
    const metadata = extractMetadata(content, file.path);
    if (metadata.visibility === "public" && !metadata.slug) {
      try {
        const posts = await this.listPublishedPosts();
        const existing = posts.find(post => post.sourcePath && path.basename(post.sourcePath) === path.basename(file.path));
        if (existing) metadata.slug = existing.slug;
      } catch (error) {
        metadata.slugLookupFailed = true;
        console.warn("Could not read the published slug", error);
      }
    }
    return {
      file,
      content,
      absoluteDraftPath,
      displayPath,
      publishPath,
      relativeDraftPath,
      metadata
    };
  }

  async publishDraft(draft, metadata) {
    const stagedCoverPath = metadata.coverPath;
    let submitted = false;
    try {
      if (!VISIBILITIES.includes(metadata.visibility)) throw new Error("请选择明确的 public 或 private 可见性。");
      if (metadata.visibility === "private") {
        new Notice("私密文章保留在 Vault 中，不会提交到公开站点。");
        return false;
      }
      await this.ensurePublishingReady();
      if (draft.metadata?.slugLookupFailed && !metadata.slugEdited) {
        const posts = await this.listPublishedPosts();
        const existing = posts.find(post => post.sourcePath && path.basename(post.sourcePath) === path.basename(draft.file.path));
        if (existing) metadata.slug = existing.slug;
      }
      const currentContent = await this.app.vault.read(draft.file);
      if (extractMetadata(currentContent, draft.file.path).visibility === "private" && draft.metadata?.visibility !== "private") {
        throw new Error("笔记已被标记为私密，请重新选择文章。");
      }
      await this.app.vault.modify(draft.file, applyMetadata(currentContent, metadata));
      const args = ["scripts/obsidian-publish.js", "--draft", draft.publishPath];
      const adapter = this.app.vault.adapter;
      const vaultRoot = adapter.getBasePath ? adapter.getBasePath() : "";
      if (vaultRoot) args.push("--vault-root", vaultRoot);
      if (metadata.coverPath) args.push("--cover", metadata.coverPath, "--cover-position", metadata.coverPosition || "50% 50%");
      if (metadata.slug) args.push("--slug-override", metadata.slug);
      if (metadata.dateOverride) args.push("--date", metadata.dateOverride);
      new Notice("正在提交文章...");
      const output = await this.runNode(args);
      await this.showDeploymentNotice(output, "文章已提交，GitHub 正在检查并部署。");
      submitted = true;
      return true;
    } catch (error) {
      console.error(error);
      new Notice(`发布失败：${error.message}`);
      return false;
    } finally {
      if (submitted) {
        removeStagedCover(stagedCoverPath, this.settings.blogRoot);
        metadata.coverPath = "";
      }
    }
  }

  async openManageContentModal() {
    new ManageContentModal(this.app, this, { defaultTab: "posts" }).open();
  }

  async listPublishedPosts() {
    const output = await this.runNode(["scripts/list-posts.js", "--remote"]);
    return JSON.parse(output || "[]");
  }

  async copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  async openManagedPost(post) {
    const target = post.sourcePath || post.postPath;
    if (!target) {
      new Notice("没有可打开的文章路径。");
      return;
    }
    const fullPath = path.join(this.settings.blogRoot, target);
    if (electronShell && electronShell.openPath) {
      await electronShell.openPath(fullPath);
      return;
    }
    new Notice(`文章路径：${fullPath}`);
  }

  async republishManagedPost(post) {
    if (!post.sourcePath) {
      new Notice("没有找到发布源稿，无法一键重新发布。");
      return;
    }
    new Notice(`开始重新发布：${post.title}`);
    try {
      const output = await this.runNode([
        "scripts/obsidian-publish.js",
        "--draft",
        post.sourcePath,
        "--date",
        post.dateValue || post.date,
        "--slug",
        post.slug
      ]);
      await this.showDeploymentNotice(output, "文章已重新提交，GitHub 正在检查并部署。");
    } catch (error) {
      console.error(error);
      new Notice(`重新发布失败：${error.message}`);
    }
  }

  async replaceCoverForPost(post, coverPath, coverPosition) {
    new Notice(`开始更换封面：${post.title}`);
    try {
      const args = [
        "scripts/replace-cover.js",
        "--post",
        post.postPath,
        "--cover",
        coverPath
      ];
      if (coverPosition) {
        args.push("--cover-position", coverPosition);
      }
      const output = await this.runNode(args);
      await this.showDeploymentNotice(output, "封面已提交，等待检查和部署。");
    } catch (error) {
      console.error(error);
      new Notice(`更换封面失败：${error.message}`);
    } finally {
      removeStagedCover(coverPath, this.settings.blogRoot);
    }
  }

  async deleteManagedPost(post, { deleteAssets }) {
    new Notice(`开始删除：${post.title}`);
    try {
      const output = await this.runNode([
        "scripts/manage-post.js",
        "delete",
        "--post",
        post.postPath,
        ...(deleteAssets ? ["--assets"] : [])
      ]);
      await this.showDeploymentNotice(output, "删除已提交，等待检查和部署。");
    } catch (error) {
      console.error(error);
      new Notice(`删除失败：${error.message}`);
    }
  }

  runNode(args) {
    return new Promise((resolve, reject) => {
      const child = spawn("node", args, {
        cwd: this.settings.blogRoot,
        shell: false,
        windowsHide: true
      });

      let output = "";
      child.stdout.on("data", (data) => {
        output += data.toString();
        console.log(data.toString());
      });
      child.stderr.on("data", (data) => {
        output += data.toString();
        console.error(data.toString());
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(output.trim() || `命令退出码：${code}`));
        }
      });
    });
  }

  async checkDeploymentStatus() {
    const commit = this.settings.lastSubmission;
    if (!commit) { new Notice("还没有本次插件提交的记录，请查看 GitHub Actions。"); return; }
    try {
      const output = await this.runNode(["scripts/deployment-status.js", "--commit", commit]);
      const status = JSON.parse(output);
      new Notice(status.message, 10000);
    } catch (error) { new Notice(`无法读取部署状态：${error.message}`); }
  }

  async ensurePublishingReady() {
    const status = JSON.parse(await this.runNode(["scripts/publisher-status.js"]));
    if (!status.ready) throw new Error(status.message);
    return status;
  }

  async checkPublishingStatus() {
    try {
      const status = JSON.parse(await this.runNode(["scripts/publisher-status.js"]));
      new Notice(status.message, 10000);
    } catch (error) { new Notice(`无法连接发布仓库：${error.message}`); }
  }

  async showDeploymentNotice(output, message) {
    const commit = String(output).match(/^Commit:\s+([a-f0-9]{40})$/m);
    if (commit) { this.settings.lastSubmission = commit[1]; await this.saveSettings(); }
    if (String(output).includes("No content changes to publish.")) { new Notice("没有需要提交的内容改动。"); return; }
    const match = String(output || "").match(/^GitHub Actions:\s+(https:\/\/\S+)$/m);
    const actionsUrl = match ? match[1] : ACTIONS_URL;
    if (typeof document === "undefined") {
      new Notice(message);
      return;
    }

    const fragment = document.createDocumentFragment();
    fragment.append(`${message} `);
    const link = document.createElement("a");
    link.href = actionsUrl;
    link.textContent = "查看部署状态";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      this.openWebUrl(actionsUrl);
    });
    fragment.append(link);
    new Notice(fragment, 12000);
  }

  openWebUrl(url) {
    if (electronShell && electronShell.openExternal) {
      electronShell.openExternal(url);
    } else if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  }


  async listPages() {
    const output = await this.runNode(["scripts/manage-pages.js", "list"]);
    return JSON.parse(output || "[]");
  }

  async createPage(title) {
    const output = await this.runNode(["scripts/manage-pages.js", "create", "--title", title]);
    return JSON.parse(output);
  }

  async pushPages() {
    return (await this.runNode(["scripts/manage-pages.js", "push"])).trim();
  }

  async setPageHeaderImage(pagePath, imageUrl, position) {
    const args = ["scripts/manage-pages.js", "set-header-image", "--page", pagePath, "--image", imageUrl];
    if (position) {
      args.push("--position", position);
    }
    await this.runNode(args);
  }

  async deletePage(pagePath, pageTitle) {
    new Notice(`开始删除页面：${pageTitle}`);
    try {
      const output = await this.runNode(["scripts/manage-pages.js", "delete", "--page", pagePath]);
      if (output.includes("Local page draft deleted")) new Notice(`本地页面草稿已删除：${pageTitle}`);
      else await this.showDeploymentNotice(output, `删除已提交，等待检查和部署：${pageTitle}`);
    } catch (error) {
      console.error(error);
      new Notice(`删除页面失败：${error.message}`);
    }
  }

  async openPageFile(pagePath) {
    const fullPath = path.join(this.settings.blogRoot, pagePath);
    if (electronShell && electronShell.openPath) {
      await electronShell.openPath(fullPath);
      return;
    }
    new Notice(`页面路径：${fullPath}`);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  injectStyles() {
    this.styleEl = document.createElement("style");
    this.styleEl.textContent = `
      .sakura-publisher-cover-input {
        max-width: 260px;
      }
      .sakura-publisher-cover-preview {
        position: relative;
        height: 190px;
        margin: 12px 0 14px;
        overflow: hidden;
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        background-color: var(--background-secondary);
        background-repeat: no-repeat;
        background-size: cover;
        color: rgba(255, 255, 255, 0.92);
        cursor: crosshair;
        display: grid;
        place-items: center;
        font-size: 13px;
        text-shadow: 0 1px 8px rgba(0, 0, 0, 0.55);
        user-select: none;
      }
      .sakura-publisher-cover-preview::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.24)) 33.33% 0 / 1px 100% no-repeat,
          linear-gradient(rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.24)) 66.66% 0 / 1px 100% no-repeat,
          linear-gradient(90deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.24)) 0 33.33% / 100% 1px no-repeat,
          linear-gradient(90deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.24)) 0 66.66% / 100% 1px no-repeat;
        pointer-events: none;
      }
      .sakura-publisher-cover-frame {
        position: absolute;
        inset: 10px;
        border: 2px solid rgba(255, 255, 255, 0.88);
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.22), 0 0 0 999px rgba(0, 0, 0, 0.08);
        pointer-events: none;
      }
      .sakura-publisher-cover-marker {
        position: absolute;
        width: 18px;
        height: 18px;
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.36);
        transform: translate(-50%, -50%);
        pointer-events: none;
      }
      .sakura-publisher-cover-controls {
        display: grid;
        gap: 10px;
        margin: 8px 0 14px;
      }
      .sakura-publisher-cover-control {
        display: grid;
        grid-template-columns: 72px minmax(120px, 1fr) 42px;
        align-items: center;
        gap: 10px;
        color: var(--text-muted);
        font-size: 12px;
      }
      .sakura-publisher-cover-range {
        width: 100%;
      }
      .sakura-publisher-cover-value {
        color: var(--text-normal);
        font-variant-numeric: tabular-nums;
        text-align: right;
      }
      .sakura-manager-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 12px 0 16px;
      }
      .sakura-manager-list {
        display: grid;
        gap: 10px;
        max-height: min(62vh, 620px);
        overflow: auto;
        padding-right: 4px;
      }
      .sakura-manager-post {
        padding: 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-secondary);
      }
      .sakura-manager-post h3 {
        margin: 0 0 6px;
        font-size: 16px;
      }
      .sakura-manager-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--text-muted);
        font-size: 12px;
      }
      .sakura-manager-summary {
        margin: 8px 0 0;
        color: var(--text-muted);
        font-size: 13px;
      }
      .sakura-manager-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }
      .sakura-manager-danger {
        color: var(--text-error);
      }
      .sakura-manager-tabs {
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 0 0 16px;
      }
      .sakura-manager-tab {
        padding: 4px 14px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: transparent;
        color: var(--text-muted);
        font-size: 13px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .sakura-manager-tab.active {
        background: var(--interactive-accent);
        border-color: var(--interactive-accent);
        color: var(--text-on-accent);
      }
      .sakura-manager-tab:hover:not(.active) {
        background: var(--background-modifier-hover);
      }
      .sakura-manager-stats {
        color: var(--text-muted);
        font-size: 12px;
        flex-shrink: 0;
      }
      .sakura-manager-search {
        flex: 1;
        min-width: 0;
        padding: 5px 10px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 13px;
        outline: none;
      }
      .sakura-manager-search::placeholder {
        color: var(--text-faint);
      }
      .sakura-manager-search:focus {
        border-color: var(--interactive-accent);
      }
      .sakura-manager-sort {
        padding: 5px 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 12px;
        cursor: pointer;
      }
      .sakura-manager-card {
        padding: 12px 14px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-secondary);
      }
      .sakura-manager-card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
      }
      .sakura-manager-card-title {
        flex: 1;
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sakura-manager-badge {
        display: inline-block;
        padding: 1px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        flex-shrink: 0;
      }
      .sakura-manager-badge--essay {
        background: rgba(59, 130, 246, 0.12);
        color: rgb(59, 130, 246);
      }
      .sakura-manager-badge--study {
        background: rgba(34, 197, 94, 0.12);
        color: rgb(34, 197, 94);
      }
      .sakura-manager-badge--moments {
        background: rgba(244, 114, 182, 0.12);
        color: rgb(244, 114, 182);
      }
      .sakura-manager-card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--text-muted);
        font-size: 12px;
      }
      .sakura-manager-card-summary {
        margin: 6px 0 0;
        color: var(--text-muted);
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sakura-manager-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .sakura-manager-empty {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-muted);
        font-size: 14px;
      }
      .sakura-publish-preview {
        margin-top: 16px;
        border-top: 1px solid var(--background-modifier-border);
        padding-top: 16px;
      }
      .sakura-publish-preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        color: var(--text-muted);
        font-size: 12px;
      }
      .sakura-publish-preview-header button {
        font-size: 12px;
        padding: 2px 10px;
      }
      .sakura-publish-preview-card {
        padding: 20px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-primary);
      }
      .sakura-publish-preview-card h2 {
        margin: 0 0 8px;
        font-size: 22px;
        font-weight: 700;
      }
      .sakura-publish-preview-cover {
        width: 100%;
        aspect-ratio: 16 / 7;
        margin-bottom: 16px;
        border-radius: 6px;
        background-size: cover;
        background-position: center;
        background-color: var(--background-modifier-border);
      }
      .sakura-publish-preview-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        color: var(--text-muted);
        font-size: 13px;
        margin-bottom: 16px;
      }
      .sakura-publish-preview-body {
        max-height: 45vh;
        overflow: auto;
        padding: 16px 20px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-secondary);
        font-size: 14px;
        line-height: 1.75;
      }
      .sakura-publish-preview-body h1,
      .sakura-publish-preview-body h2,
      .sakura-publish-preview-body h3 {
        margin-top: 1em;
        margin-bottom: 0.4em;
      }
      .sakura-publish-preview-body img {
        max-width: 100%;
        border-radius: 4px;
      }
      .sakura-publish-preview-body pre {
        padding: 12px;
        border-radius: 6px;
        background: var(--background-primary);
        overflow-x: auto;
      }
    `;
    document.head.appendChild(this.styleEl);
    this.register(() => this.styleEl.remove());
  }
};

class PublishPostModal extends Modal {
  constructor(app, plugin, draft, options) {
    super(app);
    this.plugin = plugin;
    this.draft = draft;
    this.options = options;
    this.submitted = false;
    this.metadata = {
      title: draft.metadata.title || "",
      summary: draft.metadata.summary || "",
      category: CATEGORIES.includes(draft.metadata.category) ? draft.metadata.category : "随笔",
      visibility: VISIBILITIES.includes(draft.metadata.visibility) ? draft.metadata.visibility : "public",
      slug: draft.metadata.slug || "",
      dateOverride: "",
      coverPath: "",
      coverPosition: draft.metadata.coverPosition || "50% 50%"
    };
    this.slugManualPublish = !!this.metadata.slug;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sakura-publisher-modal");
    contentEl.empty();

    contentEl.createEl("h2", { text: "发布到 Sakura Blog" });
    contentEl.createEl("p", {
      cls: "sakura-publisher-desc",
      text: "发布前确认标题、简介、归档板块和可见性。提交后由 GitHub Actions 统一检查、构建和部署。"
    });

    const titleSetting = new Setting(contentEl)
      .setName("标题")
      .setDesc("会写入文章 front matter，并显示在首页、归档和搜索结果。")
      .addText((text) => {
        text
          .setPlaceholder("文章标题")
          .setValue(this.metadata.title)
          .onChange((value) => {
            this.metadata.title = value.trim();
            this.renderPreview();
          });
        text.inputEl.addClass("sakura-publisher-title-input");
      });

    new Setting(contentEl)
      .setName("板块")
      .setDesc("随笔和学习会出现在 Archive，moments 出现在 Moments 时间线。")
      .addDropdown((dropdown) => {
        CATEGORIES.forEach((category) => dropdown.addOption(category, category));
        dropdown
          .setValue(this.metadata.category)
          .onChange((value) => {
            this.metadata.category = value;
            titleSetting.settingEl.style.display = value === "moments" ? "none" : "";
            summarySetting.settingEl.style.display = value === "moments" ? "none" : "";
            if (momentsHint) momentsHint.style.display = value === "moments" ? "" : "none";
            this.renderPreview();
          });
      });

    new Setting(contentEl)
      .setName("可见性")
      .setDesc("public 会发布到网站；private 保留在 Vault 中，不会提交到公开站点。")
      .addDropdown((dropdown) => {
        VISIBILITIES.forEach((visibility) => dropdown.addOption(visibility, visibility));
        dropdown
          .setValue(this.metadata.visibility)
          .onChange((value) => {
            this.metadata.visibility = value;
            this.renderPreview();
          });
      });

    titleSetting.settingEl.style.display = this.metadata.category === "moments" ? "none" : "";

    this.slugInputEl = null;
    new Setting(contentEl)
      .setName("Slug")
      .setDesc("文章 URL 标识，默认从标题自动生成。手动修改后不再跟随标题变化。")
      .addText((text) => {
        text
          .setPlaceholder("article-slug")
          .setValue(this.metadata.slug || titleToSlug(this.metadata.title || fileTitle(this.draft.file.path)))
          .onChange((value) => {
            this.slugManualPublish = true;
            this.metadata.slug = value.trim();
          });
        this.slugInputEl = text.inputEl;
      });

    // Sync slug from title unless manually edited
    const origTitleChange = this.metadata.title;
    const slugSettingEl = contentEl.lastChild;

    new Setting(contentEl)
      .setName("日期覆盖")
      .setDesc("可选，格式 YYYY-MM-DD HH:MM。留空使用当前时间。")
      .addText((text) => {
        text
          .setPlaceholder("例如：2026-06-26 17:08")
          .onChange((value) => { this.metadata.dateOverride = value.trim(); });
      });

    // Moments hint
    const momentsHint = contentEl.createDiv({
      cls: "sakura-publisher-hint",
      text: "Moments 不使用标题和简介，正文内容直接展示在时间线上。"
    });
    momentsHint.style.display = this.metadata.category === "moments" ? "" : "none";

    // Override title onChange to sync slug when not manual
    const titleInput = contentEl.querySelector(".sakura-publisher-title-input");
    if (titleInput) {
      const origHandler = titleInput.oninput;
      titleInput.addEventListener("input", () => {
        if (!this.slugManualPublish && this.slugInputEl) {
          this.slugInputEl.value = titleToSlug(this.metadata.title);
          this.metadata.slug = this.slugInputEl.value;
        }
      });
    }

    const summarySetting = new Setting(contentEl)
      .setName("简介")
      .setDesc("一句话摘要，会显示在列表、搜索和文章元信息里。moments 可留空。")
      .addTextArea((text) => {
        text
          .setPlaceholder("用一两句话概括这篇文章。")
          .setValue(this.metadata.summary)
          .onChange((value) => {
            this.metadata.summary = value.trim();
            this.renderPreview();
          });
        text.inputEl.addClass("sakura-publisher-summary-input");
      });

    summarySetting.settingEl.style.display = this.metadata.category === "moments" ? "none" : "";

    const coverSetting = new Setting(contentEl)
      .setName("选择封面图")
      .setDesc("未选择新封面：重新发布将沿用已有封面；首次发布则不设置封面。选择后可在下方调整显示区域。");
    const coverInput = coverSetting.controlEl.createEl("input", {
      attr: {
        type: "file",
        accept: "image/png,image/jpeg,image/webp,image/gif"
      }
    });
    coverInput.addClass("sakura-publisher-cover-input");
    coverInput.addEventListener("change", async () => {
      const file = coverInput.files && coverInput.files[0];
      if (!file) return;

      try {
        const previousCoverPath = this.metadata.coverPath;
        this.metadata.coverPath = await stageCoverFile(file, this.plugin.settings.blogRoot);
        removeStagedCover(previousCoverPath, this.plugin.settings.blogRoot);
        this.metadata.coverName = file.name || path.basename(this.metadata.coverPath);
        if (this.metadata.coverPreviewUrl) {
          URL.revokeObjectURL(this.metadata.coverPreviewUrl);
        }
        this.metadata.coverPreviewUrl = URL.createObjectURL(file);
        this.renderPreview();
      } catch (error) {
        console.error(error);
        new Notice(`无法读取封面图：${error.message}`);
      }
    });

    this.previewEl = contentEl.createDiv({ cls: "sakura-publisher-preview" });
    this.renderPreview();

    const actions = contentEl.createDiv({ cls: "sakura-publisher-actions" });
    const publishButton = actions.createEl("button", {
      text: "发布"
    });
    this.publishButton = publishButton;
    publishButton.addClass("sakura-publisher-primary");
    publishButton.addEventListener("click", () => this.submit());
  }

  renderPreview() {
    if (!this.previewEl) return;

    this.previewEl.empty();
    this.previewEl.createDiv({ cls: "sakura-publisher-preview-label", text: "发布预览" });
    this.previewEl.createEl("h3", { text: this.metadata.title || "未填写标题" });

    if (this.metadata.coverPath) {
      const cover = this.previewEl.createDiv({
        cls: "sakura-publisher-cover-preview",
        attr: {
          "aria-label": "调整封面显示区域"
        }
      });
      cover.setText("拖动图片，调整横幅裁切区域");
      cover.style.backgroundImage = `url("${this.metadata.coverPreviewUrl || pathToFileUrl(this.metadata.coverPath)}")`;
      const initialPosition = parseCoverPosition(this.metadata.coverPosition);
      this.metadata.coverPosition = formatCoverPosition(initialPosition.x, initialPosition.y);
      cover.style.backgroundPosition = this.metadata.coverPosition;

      cover.createDiv({ cls: "sakura-publisher-cover-frame" });
      const marker = cover.createDiv({ cls: "sakura-publisher-cover-marker" });
      const controls = this.previewEl.createDiv({ cls: "sakura-publisher-cover-controls" });
      const xInput = this.createCoverRangeControl(controls, "横向焦点", initialPosition.x);
      const yInput = this.createCoverRangeControl(controls, "纵向焦点", initialPosition.y);
      const updateMarker = () => {
        const position = parseCoverPosition(this.metadata.coverPosition);
        marker.style.left = `${position.x}%`;
        marker.style.top = `${position.y}%`;
        xInput.input.value = String(position.x);
        yInput.input.value = String(position.y);
        xInput.valueEl.setText(`${position.x}%`);
        yInput.valueEl.setText(`${position.y}%`);
      };

      const setCoverPosition = (x, y) => {
        this.metadata.coverPosition = formatCoverPosition(x, y);
        cover.style.backgroundPosition = this.metadata.coverPosition;
        updateMarker();
      };

      xInput.input.addEventListener("input", () => {
        const position = parseCoverPosition(this.metadata.coverPosition);
        setCoverPosition(xInput.input.value, position.y);
      });
      yInput.input.addEventListener("input", () => {
        const position = parseCoverPosition(this.metadata.coverPosition);
        setCoverPosition(position.x, yInput.input.value);
      });

      const updatePosition = (event) => {
        const rect = cover.getBoundingClientRect();
        const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
        const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
        setCoverPosition(x, y);
      };

      cover.addEventListener("pointerdown", (event) => {
        updatePosition(event);
        cover.setPointerCapture(event.pointerId);
      });
      cover.addEventListener("pointermove", (event) => {
        if (event.buttons === 1) updatePosition(event);
      });
      updateMarker();
    }

    const meta = this.previewEl.createDiv({ cls: "sakura-publisher-preview-meta" });
    meta.createSpan({ text: this.metadata.category || "随笔" });
    meta.createSpan({ text: this.metadata.visibility || "public" });
    meta.createSpan({ text: this.draft.displayPath });
    if (this.metadata.coverName) {
      meta.createSpan({ text: `封面：${this.metadata.coverName}` });
    }

    this.previewEl.createEl("p", {
      text: this.metadata.summary || "还没有简介，建议补上一句方便首页和搜索展示。"
    });
  }

  createCoverRangeControl(parent, label, value) {
    const row = parent.createDiv({ cls: "sakura-publisher-cover-control" });
    row.createSpan({ text: label });
    const input = row.createEl("input", {
      cls: "sakura-publisher-cover-range",
      attr: {
        type: "range",
        min: "0",
        max: "100",
        step: "1",
        value: String(clampPercent(value))
      }
    });
    const valueEl = row.createSpan({
      cls: "sakura-publisher-cover-value",
      text: `${clampPercent(value)}%`
    });
    return { input, valueEl };
  }

  async submit() {
    if (this.submitting) return;
    const isMoments = this.metadata.category === "moments";

    if (!isMoments && !this.metadata.title) {
      new Notice("请先填写标题。");
      return;
    }

    if (!isMoments && !this.metadata.summary) {
      new Notice("请先填写简介。");
      return;
    }

    // Ensure slug is set even if user didn't manually edit
    if (!this.metadata.slug) {
      this.metadata.slug = titleToSlug(this.metadata.title || fileTitle(this.draft.file.path));
    }
    this.submitting = true;
    this.publishButton.disabled = true;
    try {
      if (!await this.plugin.publishDraft(this.draft, this.metadata)) return;
      this.submitted = true;
      this.close();
    } finally {
      this.submitting = false;
      this.publishButton.disabled = false;
    }
  }

  onClose() {
    if (this.metadata.coverPreviewUrl) URL.revokeObjectURL(this.metadata.coverPreviewUrl);
    if (!this.submitted) removeStagedCover(this.metadata.coverPath, this.plugin.settings.blogRoot);
    this.contentEl.empty();
  }
}

class ImagePreviewModal extends Modal {
  constructor(app, { imagePreviewUrl, currentPosition, mode, onConfirm, onCancel }) {
    super(app);
    this.imagePreviewUrl = imagePreviewUrl;
    this.position = parseCoverPosition(currentPosition || "50% 50%");
    this.mode = mode || "cover";
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
    this.confirmed = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sakura-publisher-modal");
    contentEl.empty();

    const titleText = this.mode === "header" ? "调整头部图片位置" : "调整封面位置";
    contentEl.createEl("h2", { text: titleText });

    const preview = contentEl.createDiv({ cls: "sakura-publisher-cover-preview" });
    preview.setText("拖动图片，调整焦点区域");
    preview.style.backgroundImage = `url("${this.imagePreviewUrl}")`;
    preview.style.backgroundPosition = formatCoverPosition(this.position.x, this.position.y);

    preview.createDiv({ cls: "sakura-publisher-cover-frame" });
    const marker = preview.createDiv({ cls: "sakura-publisher-cover-marker" });

    const controls = contentEl.createDiv({ cls: "sakura-publisher-cover-controls" });
    const xInput = this.createRangeControl(controls, "横向焦点", this.position.x);
    const yInput = this.createRangeControl(controls, "纵向焦点", this.position.y);

    const updateMarker = () => {
      marker.style.left = `${this.position.x}%`;
      marker.style.top = `${this.position.y}%`;
      xInput.input.value = String(this.position.x);
      yInput.input.value = String(this.position.y);
      xInput.valueEl.setText(`${this.position.x}%`);
      yInput.valueEl.setText(`${this.position.y}%`);
    };

    const setPosition = (x, y) => {
      this.position = { x: clampPercent(x), y: clampPercent(y) };
      preview.style.backgroundPosition = formatCoverPosition(this.position.x, this.position.y);
      updateMarker();
    };

    xInput.input.addEventListener("input", () => setPosition(xInput.input.value, this.position.y));
    yInput.input.addEventListener("input", () => setPosition(this.position.x, yInput.input.value));

    const updateFromPointer = (event) => {
      const rect = preview.getBoundingClientRect();
      const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
      const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
      setPosition(x, y);
    };

    preview.addEventListener("pointerdown", (event) => {
      updateFromPointer(event);
      preview.setPointerCapture(event.pointerId);
    });
    preview.addEventListener("pointermove", (event) => {
      if (event.buttons === 1) updateFromPointer(event);
    });

    updateMarker();

    const actions = contentEl.createDiv({ cls: "sakura-publisher-actions" });
    actions.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());

    const confirmText = this.mode === "header" ? "确认设置" : "确认更换";
    const confirmBtn = actions.createEl("button", { text: confirmText, cls: "mod-cta" });
    confirmBtn.addEventListener("click", () => {
      const pos = formatCoverPosition(this.position.x, this.position.y);
      this.confirmed = true;
      this.close();
      if (this.onConfirm) this.onConfirm(pos);
    });
  }

  onClose() {
    if (!this.confirmed && this.onCancel) this.onCancel();
    this.contentEl.empty();
  }

  createRangeControl(parent, label, value) {
    const row = parent.createDiv({ cls: "sakura-publisher-cover-control" });
    row.createSpan({ text: label });
    const input = row.createEl("input", {
      cls: "sakura-publisher-cover-range",
      attr: { type: "range", min: "0", max: "100", step: "1", value: String(clampPercent(value)) }
    });
    const valueEl = row.createSpan({
      cls: "sakura-publisher-cover-value",
      text: `${clampPercent(value)}%`
    });
    return { input, valueEl };
  }
}

class PublishFileSuggestModal extends FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder("选择要发布的 Markdown 笔记");
  }

  getItems() {
    return this.app.vault.getMarkdownFiles();
  }

  getItemText(file) {
    return file.path;
  }

  onChooseItem(file) {
    this.onChoose(file);
  }
}

class ManageContentModal extends Modal {
  constructor(app, plugin, options = {}) {
    super(app);
    this.plugin = plugin;
    this.posts = [];
    this.pages = [];
    this.activeTab = options.defaultTab || "publish";
    this.selectedFile = options.file || null;
    this.searchQuery = "";
    this.sortMode = "date-desc";
    this.categoryFilter = "全部";
    this.draft = null;
    this.publishMeta = null;
    this.slugManual = false;
    this.submitted = false;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sakura-publisher-modal");
    contentEl.empty();

    const masthead = contentEl.createDiv({ cls: "sakura-workbench-masthead" });
    const identity = masthead.createDiv({ cls: "sakura-workbench-identity" });
    identity.createDiv({ cls: "sakura-workbench-mark", text: "桜" });
    const titles = identity.createDiv();
    titles.createDiv({ cls: "sakura-workbench-kicker", text: "EDITORIAL DESK" });
    titles.createEl("h2", { text: "Sakura Blog" });
    const environment = masthead.createDiv({ cls: "sakura-workbench-environment" });
    environment.createSpan({ cls: "sakura-workbench-dot" });
    environment.createSpan({ text: "GitHub Pages · main" });

    const tabBar = contentEl.createDiv({ cls: "sakura-manager-tabs", attr: { role: "tablist" } });
    this.publishTab = this.createNavTab(tabBar, "publish", "01", "发布");
    this.postsTab = this.createNavTab(tabBar, "posts", "02", "文章");
    this.pagesTab = this.createNavTab(tabBar, "pages", "03", "页面");
    this.statusTab = this.createNavTab(tabBar, "status", "04", "状态");

    this.buildToolbar(contentEl);
    this.contentArea = contentEl.createDiv();

    // publish container
    this.publishContainer = this.contentArea.createDiv();

    // posts container
    this.postsContainer = this.contentArea.createDiv({ attr: { style: "display:none" } });
    this.listEl = this.postsContainer.createDiv({ cls: "sakura-manager-list" });

    // pages container
    this.pagesContainer = this.contentArea.createDiv({ attr: { style: "display:none" } });
    const pagesActions = this.pagesContainer.createDiv({ cls: "sakura-manager-page-actions" });
    const createButton = pagesActions.createEl("button", { text: "新建页面" });
    createButton.addEventListener("click", () => this.showCreateDialog());
    const pushButton = pagesActions.createEl("button", { text: "保存并推送" });
    pushButton.addClass("mod-cta");
    pushButton.addEventListener("click", () => this.pushPages());
    this.pagesListEl = this.pagesContainer.createDiv({ cls: "sakura-manager-list" });

    this.statusContainer = this.contentArea.createDiv({ attr: { style: "display:none" } });
    this.renderStatusPanel();

    this.switchTab(this.activeTab);
  }

  createNavTab(parent, key, index, label) {
    const button = parent.createEl("button", {
      cls: "sakura-manager-tab",
      attr: { type: "button", role: "tab", "aria-selected": "false" }
    });
    button.createSpan({ cls: "sakura-manager-tab-index", text: index });
    button.createSpan({ text: label });
    button.addEventListener("click", () => this.switchTab(key));
    return button;
  }

  renderStatusPanel() {
    this.statusContainer.empty();
    const intro = this.statusContainer.createDiv({ cls: "sakura-status-intro" });
    intro.createEl("h3", { text: "文章提交与网站上线" });
    intro.createEl("p", { text: "提交成功后，网站会进行检查和构建；部署成功后，新内容才会在线上出现。" });
    intro.createEl("p", { text: "发布仓库：sakur7a/sakur7a.github.io" });
    const actions = this.statusContainer.createDiv({ cls: "sakura-status-actions" });
    actions.createEl("button", { text: "检查发布连接" }).addEventListener("click", () => this.plugin.checkPublishingStatus());
    actions.createEl("button", { text: "查看发布仓库" }).addEventListener("click", () => this.plugin.openWebUrl(ACTIONS_URL.replace(/\/actions\/.*$/, "")));
    actions.createEl("button", { text: "查看线上博客" }).addEventListener("click", () => this.plugin.openWebUrl(SITE_URL));
    actions.createEl("button", { text: "检查本次部署" }).addEventListener("click", () => this.plugin.checkDeploymentStatus());
    actions.createEl("button", { text: "查看部署记录" }).addEventListener("click", () => this.plugin.openWebUrl(ACTIONS_URL));
  }

  buildToolbar(parent) {
    this.toolbarEl = parent.createDiv({ cls: "sakura-manager-toolbar" });
    const toolbar = this.toolbarEl;
    this.statsEl = toolbar.createSpan({ cls: "sakura-manager-stats", text: "" });

    this.categoryFilterEl = toolbar.createEl("select", { cls: "sakura-manager-filter" });
    this.categoryFilterEl.createEl("option", { value: "全部", text: "全部分类" });
    CATEGORIES.forEach((c) => {
      this.categoryFilterEl.createEl("option", { value: c, text: c });
    });
    this.categoryFilterEl.addEventListener("change", () => {
      this.categoryFilter = this.categoryFilterEl.value;
      this.renderCurrentTab();
    });

    this.searchInput = toolbar.createEl("input", {
      cls: "sakura-manager-search",
      attr: { type: "text", placeholder: "搜索标题..." }
    });
    this.searchInput.addEventListener("input", () => {
      this.searchQuery = this.searchInput.value.trim().toLowerCase();
      this.renderCurrentTab();
    });

    this.sortSelect = toolbar.createEl("select", { cls: "sakura-manager-sort" });
    this.updateSortOptions();
    this.sortSelect.addEventListener("change", () => {
      this.sortMode = this.sortSelect.value;
      this.renderCurrentTab();
    });

    const refreshButton = toolbar.createEl("button", { text: "刷新" });
    refreshButton.addEventListener("click", () => this.refresh());
  }

  async renderPublishForm() {
    this.publishContainer.empty();
    this.publishContainer.addClass("sakura-publish-sheet");
    this.draft = await this.plugin.getActiveDraft(this.selectedFile || undefined);

    if (!this.draft) {
      const empty = this.publishContainer.createDiv({ cls: "sakura-manager-empty" });
      empty.createEl("p", { text: "请先打开一篇 Markdown 草稿。" });
      empty.createEl("p", {
        cls: "sakura-publisher-desc",
        text: "在 Obsidian 中打开一篇 .md 文件后切换到此 Tab 即可发布。"
      });
      return;
    }

    // Check if already published
    const publishedPath = path.join(this.plugin.settings.blogRoot, "obsidian", "Published", path.basename(this.draft.file.path));
    if (fs.existsSync(publishedPath)) {
      this.publishContainer.createDiv({
        cls: "sakura-publisher-published-badge",
        text: "✓ 本文已发布过，再次发布会更新已有文章。"
      });
    }

    this.publishMeta = {
      title: this.draft.metadata.title || "",
      summary: this.draft.metadata.summary || "",
      category: CATEGORIES.includes(this.draft.metadata.category) ? this.draft.metadata.category : "随笔",
      visibility: VISIBILITIES.includes(this.draft.metadata.visibility) ? this.draft.metadata.visibility : "public",
      slug: this.draft.metadata.slug || "",
      dateOverride: "",
      coverPath: "",
      coverPosition: this.draft.metadata.coverPosition || "50% 50%"
    };
    this.slugManual = !!this.publishMeta.slug;

    const draftBar = this.publishContainer.createDiv({ cls: "sakura-publish-draftbar" });
    const draftText = draftBar.createDiv();
    draftText.createSpan({ text: "CURRENT NOTE" });
    draftText.createEl("strong", { text: this.draft.displayPath });
    draftBar.createDiv({ cls: "sakura-publish-route", text: "main → Actions → Pages" });

    const mcTitleSetting = new Setting(this.publishContainer)
      .setName("标题")
      .addText((text) => {
        text
          .setPlaceholder("文章标题")
          .setValue(this.publishMeta.title)
          .onChange((value) => {
            this.publishMeta.title = value.trim();
            if (!this.slugManual) {
              this.slugInput.value = titleToSlug(this.publishMeta.title);
              this.publishMeta.slug = this.slugInput.value;
            }
            this.updatePublishReadiness();
          });
      });

    const advancedOptions = this.publishContainer.createEl("details", { cls: "sakura-publisher-advanced" });
    advancedOptions.createEl("summary", { text: "高级选项" });

    // Slug field
    const mcSlugSetting = new Setting(advancedOptions)
      .setName("Slug")
      .setDesc("文章 URL 标识，默认从标题自动生成。手动修改后不再跟随标题变化。");
    const slugControl = mcSlugSetting.controlEl.createEl("input", {
      attr: { type: "text", placeholder: "article-slug" }
    });
    slugControl.style.width = "100%";
    slugControl.value = this.publishMeta.slug || titleToSlug(this.publishMeta.title || fileTitle(this.draft.file.path));
    this.slugInput = slugControl;
    slugControl.addEventListener("input", () => {
      this.slugManual = true;
      this.publishMeta.slug = slugControl.value.trim();
    });

    // Date override field
    const mcDateSetting = new Setting(advancedOptions)
      .setName("日期")
      .setDesc("可选，格式 YYYY-MM-DD HH:MM。留空使用当前时间。")
      .addText((text) => {
        text
          .setPlaceholder("例如：2026-06-26 17:08")
          .onChange((value) => { this.publishMeta.dateOverride = value.trim(); });
      });

    const mcCategorySetting = new Setting(this.publishContainer)
      .setName("板块")
      .addDropdown((dropdown) => {
        CATEGORIES.forEach((c) => dropdown.addOption(c, c));
        dropdown
          .setValue(this.publishMeta.category)
          .onChange((value) => {
            this.publishMeta.category = value;
            mcTitleSetting.settingEl.style.display = value === "moments" ? "none" : "";
            mcSummarySetting.settingEl.style.display = value === "moments" ? "none" : "";
            if (this.momentsHintEl) {
              this.momentsHintEl.style.display = value === "moments" ? "" : "none";
            }
            this.updatePublishReadiness();
          });
      });

    new Setting(this.publishContainer)
      .setName("可见性")
      .setDesc("public 会发布；private 保留在 Vault 中，不会提交到公开站点。")
      .addDropdown((dropdown) => {
        VISIBILITIES.forEach((visibility) => dropdown.addOption(visibility, visibility));
        dropdown
          .setValue(this.publishMeta.visibility)
          .onChange((value) => {
            this.publishMeta.visibility = value;
            this.updatePublishReadiness();
          });
      });

    mcTitleSetting.settingEl.style.display = this.publishMeta.category === "moments" ? "none" : "";

    // Moments hint
    this.momentsHintEl = this.publishContainer.createDiv({
      cls: "sakura-publisher-hint",
      text: "Moments 不使用标题和简介，正文内容直接展示在时间线上。"
    });
    this.momentsHintEl.style.display = this.publishMeta.category === "moments" ? "" : "none";

    const mcSummarySetting = new Setting(this.publishContainer)
      .setName("简介")
      .setDesc("moments 可留空")
      .addTextArea((text) => {
        text
          .setPlaceholder("用一两句话概括这篇文章。")
          .setValue(this.publishMeta.summary)
          .onChange((value) => {
            this.publishMeta.summary = value.trim();
            this.updatePublishReadiness();
          });
        text.inputEl.addClass("sakura-publisher-summary-input");
      });

    mcSummarySetting.settingEl.style.display = this.publishMeta.category === "moments" ? "none" : "";

    const coverSetting = new Setting(this.publishContainer)
      .setName("封面图")
      .setDesc("未选择新封面：重新发布将沿用已有封面；首次发布则不设置封面。");
    const coverInput = coverSetting.controlEl.createEl("input", {
      attr: { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif" }
    });
    coverInput.addClass("sakura-publisher-cover-input");
    this.coverNameEl = coverSetting.descEl;
    coverInput.addEventListener("change", async () => {
      const file = coverInput.files && coverInput.files[0];
      if (!file) return;
      try {
        const previousCoverPath = this.publishMeta.coverPath;
        this.publishMeta.coverPath = await stageCoverFile(file, this.plugin.settings.blogRoot);
        removeStagedCover(previousCoverPath, this.plugin.settings.blogRoot);
        this.publishMeta.coverName = file.name;
        this.coverNameEl.setText(`已选择：${file.name}`);
      } catch (error) {
        console.error(error);
        new Notice(`无法读取封面图：${error.message}`);
      }
    });

    this.readinessEl = this.publishContainer.createDiv({ cls: "sakura-publish-readiness" });
    const actions = this.publishContainer.createDiv({ cls: "sakura-publisher-actions sakura-publisher-actions--sticky" });
    const contentPreviewBtn = actions.createEl("button", { text: "预览内容" });
    contentPreviewBtn.addEventListener("click", () => this.toggleContentPreview());
    this.publishButton = actions.createEl("button", { text: "发布到博客" });
    this.publishButton.addClass("sakura-publisher-primary");
    this.publishButton.addEventListener("click", () => this.submitPublish());

    this.previewSection = null;
    this.updatePublishReadiness();
  }

  updatePublishReadiness() {
    if (!this.publishMeta || !this.readinessEl || !this.publishButton) return;
    const isMoments = this.publishMeta.category === "moments";
    const missing = [];
    if (!isMoments && !this.publishMeta.title) missing.push("标题");
    if (!isMoments && !this.publishMeta.summary) missing.push("简介");
    const ready = missing.length === 0;
    this.publishButton.disabled = !ready;
    this.readinessEl.empty();
    this.readinessEl.createSpan({ cls: ready ? "is-ready" : "is-waiting", text: ready ? "READY" : "NEEDS EDIT" });
    this.readinessEl.createEl("strong", { text: ready ? "内容已齐，可以提交" : `还需要：${missing.join("、")}` });
    this.readinessEl.createEl("small", {
      text: this.publishMeta.visibility === "private"
        ? "私密文章保留在 Vault 中，不会提交到公开站点。"
        : "提交后由 GitHub Actions 检查、构建并部署。"
    });
  }

  async toggleContentPreview() {
    if (this.previewSection) {
      this.previewSection.remove();
      this.previewSection = null;
      return;
    }

    if (!this.draft) return;

    this.previewSection = this.publishContainer.createDiv({ cls: "sakura-publish-preview" });
    const header = this.previewSection.createDiv({ cls: "sakura-publish-preview-header" });
    header.createEl("span", { text: "发布后效果预览" });
    const closeBtn = header.createEl("button", { text: "关闭预览" });
    closeBtn.addEventListener("click", () => {
      this.previewSection.remove();
      this.previewSection = null;
    });

    const card = this.previewSection.createDiv({ cls: "sakura-publish-preview-card" });
    if (this.publishMeta.coverPath) {
      const coverDiv = card.createDiv({ cls: "sakura-publish-preview-cover" });
      const url = this.publishMeta.coverPreviewUrl || pathToFileUrl(this.publishMeta.coverPath);
      coverDiv.style.backgroundImage = `url("${url}")`;
    }
    card.createEl("h2", { text: this.publishMeta.title || "未填写标题" });
    const meta = card.createDiv({ cls: "sakura-publish-preview-meta" });
    const previewBadgeClass = this.publishMeta.category === "学习" ? "study" : this.publishMeta.category === "moments" ? "moments" : "essay";
    meta.createSpan({
      cls: `sakura-manager-badge sakura-manager-badge--${previewBadgeClass}`,
      text: this.publishMeta.category
    });
    meta.createSpan({ text: this.publishMeta.visibility || "public" });
    meta.createSpan({ text: this.publishMeta.summary || "暂无简介" });

    const bodyEl = this.previewSection.createDiv({ cls: "sakura-publish-preview-body" });
    const body = this.draft.content.replace(/^---[\s\S]*?---\s*/, "").trim();
    const component = new Component();
    component.load();
    await MarkdownRenderer.renderMarkdown(body, bodyEl, this.draft.file.path, component);
  }

  async submitPublish() {
    if (this.submitting) return;
    if (!this.draft) return;
    const isMoments = this.publishMeta.category === "moments";
    if (!isMoments && !this.publishMeta.title) {
      new Notice("请先填写标题。");
      return;
    }
    if (!isMoments && !this.publishMeta.summary) {
      new Notice("请先填写简介。");
      return;
    }
    // Ensure slug is set even if user didn't manually edit
    if (!this.publishMeta.slug) {
      this.publishMeta.slug = titleToSlug(this.publishMeta.title || fileTitle(this.draft.file.path));
    }
    this.submitting = true;
    this.publishButton.disabled = true;
    try {
      this.publishMeta.slugEdited = this.slugManual;
      if (!await this.plugin.publishDraft(this.draft, this.publishMeta)) return;
      this.submitted = true;
      this.close();
    } finally {
      this.submitting = false;
      if (!this.submitted) this.updatePublishReadiness();
    }
  }

  updateSortOptions() {
    this.sortSelect.empty();
    if (this.activeTab === "posts") {
      this.sortSelect.createEl("option", { value: "date-desc", text: "最新发布" });
      this.sortSelect.createEl("option", { value: "title-asc", text: "标题 A-Z" });
      this.sortSelect.createEl("option", { value: "title-desc", text: "标题 Z-A" });
      if (this.sortMode === "title-asc" || this.sortMode === "title-desc") {
        this.sortSelect.value = this.sortMode;
      } else {
        this.sortSelect.value = "date-desc";
        this.sortMode = "date-desc";
      }
    } else {
      this.sortSelect.createEl("option", { value: "title-asc", text: "标题 A-Z" });
      this.sortSelect.createEl("option", { value: "title-desc", text: "标题 Z-A" });
      if (this.sortMode === "title-asc" || this.sortMode === "title-desc") {
        this.sortSelect.value = this.sortMode;
      } else {
        this.sortSelect.value = "title-asc";
        this.sortMode = "title-asc";
      }
    }
  }

  switchTab(tab) {
    this.activeTab = tab;
    this.searchQuery = "";
    if (this.searchInput) this.searchInput.value = "";

    // update tab active states
    this.publishTab.toggleClass("active", tab === "publish");
    this.postsTab.toggleClass("active", tab === "posts");
    this.pagesTab.toggleClass("active", tab === "pages");
    this.statusTab.toggleClass("active", tab === "status");
    this.publishTab.setAttr("aria-selected", String(tab === "publish"));
    this.postsTab.setAttr("aria-selected", String(tab === "posts"));
    this.pagesTab.setAttr("aria-selected", String(tab === "pages"));
    this.statusTab.setAttr("aria-selected", String(tab === "status"));

    // show/hide containers
    this.publishContainer.style.display = tab === "publish" ? "" : "none";
    this.postsContainer.style.display = tab === "posts" ? "" : "none";
    this.pagesContainer.style.display = tab === "pages" ? "" : "none";
    this.statusContainer.style.display = tab === "status" ? "" : "none";

    // show/hide toolbar + category filter
    this.toolbarEl.style.display = tab === "posts" || tab === "pages" ? "" : "none";
    if (this.categoryFilterEl) {
      this.categoryFilterEl.style.display = tab === "posts" ? "" : "none";
    }

    if (tab === "publish") {
      this.renderPublishForm();
    } else if (tab === "posts") {
      this.updateSortOptions();
      if (!this.posts.length) this.loadPosts();
      else this.renderPosts();
    } else if (tab === "pages") {
      this.updateSortOptions();
      if (!this.pages.length) this.loadPages();
      else this.renderPages();
    } else {
      this.renderStatusPanel();
    }
  }

  renderCurrentTab() {
    if (this.activeTab === "posts") this.renderPosts();
    else if (this.activeTab === "pages") this.renderPages();
  }

  refresh() {
    if (this.activeTab === "publish") this.renderPublishForm();
    else if (this.activeTab === "posts") this.loadPosts();
    else if (this.activeTab === "pages") this.loadPages();
    else this.renderStatusPanel();
  }

  filterList(items, searchKeys) {
    if (!this.searchQuery) return items;
    return items.filter((item) =>
      searchKeys.some((key) => {
        const val = item[key];
        return val && String(val).toLowerCase().includes(this.searchQuery);
      })
    );
  }

  sortPosts(posts) {
    const sorted = [...posts];
    switch (this.sortMode) {
      case "title-asc":
        sorted.sort((a, b) => (a.title || "").localeCompare(b.title || "", "zh"));
        break;
      case "title-desc":
        sorted.sort((a, b) => (b.title || "").localeCompare(a.title || "", "zh"));
        break;
      case "date-desc":
      default:
        sorted.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        break;
    }
    return sorted;
  }

  sortPages(pages) {
    const sorted = [...pages];
    if (this.sortMode === "title-desc") {
      sorted.sort((a, b) => (b.title || "").localeCompare(a.title || "", "zh"));
    } else {
      sorted.sort((a, b) => (a.title || "").localeCompare(b.title || "", "zh"));
    }
    return sorted;
  }

  async loadPosts() {
    if (!this.listEl) return;
    this.renderLoading(this.listEl);
    this.statsEl.setText("正在读取文章...");

    try {
      this.posts = await this.plugin.listPublishedPosts();
      this.updatePostStats();
      this.renderPosts();
    } catch (error) {
      console.error(error);
      this.statsEl.setText("读取失败");
      this.listEl.empty();
      const state = this.listEl.createDiv({ cls: "sakura-manager-empty sakura-manager-empty--error" });
      state.createEl("strong", { text: "文章读取失败" });
      state.createEl("p", { text: error.message || "无法读取文章列表。" });
      state.createEl("button", { text: "重试" }).addEventListener("click", () => this.loadPosts());
    }
  }

  renderLoading(container) {
    container.empty();
    for (let index = 0; index < 3; index += 1) {
      const skeleton = container.createDiv({ cls: "sakura-manager-skeleton" });
      skeleton.createDiv();
      skeleton.createDiv();
      skeleton.createDiv();
    }
  }

  updatePostStats() {
    const essayCount = this.posts.filter((p) => (p.category || "随笔") === "随笔").length;
    const studyCount = this.posts.filter((p) => p.category === "学习").length;
    const momentsCount = this.posts.filter((p) => p.category === "moments").length;
    this.statsEl.setText(`共 ${this.posts.length} 篇 · 随笔 ${essayCount} · 学习 ${studyCount} · moments ${momentsCount}`);
  }

  renderPosts() {
    this.listEl.empty();
    let filtered = this.filterList(this.posts, ["title", "summary", "slug"]);
    // Category filter
    if (this.categoryFilter && this.categoryFilter !== "全部") {
      filtered = filtered.filter((p) => (p.category || "随笔") === this.categoryFilter);
    }
    const sorted = this.sortPosts(filtered);

    if (!this.posts.length) {
      this.listEl.createEl("div", { cls: "sakura-manager-empty", text: "还没有已发布文章。" });
      return;
    }
    if (!sorted.length) {
      this.listEl.createEl("div", { cls: "sakura-manager-empty", text: "没有匹配的结果。" });
      return;
    }

    sorted.forEach((post) => {
      const card = this.listEl.createDiv({ cls: "sakura-manager-card" });

      const header = card.createDiv({ cls: "sakura-manager-card-header" });
      header.createEl("h3", { cls: "sakura-manager-card-title", text: post.title || post.postPath });
      const badgeClass = post.category === "学习" ? "study" : post.category === "moments" ? "moments" : "essay";
      header.createSpan({
        cls: `sakura-manager-badge sakura-manager-badge--${badgeClass}`,
        text: post.category || "随笔"
      });

      const meta = card.createDiv({ cls: "sakura-manager-card-meta" });
      meta.createSpan({ text: post.date || "无日期" });
      if (post.slug) meta.createSpan({ text: `/${post.slug}` });
      if (post.summary) card.createEl("p", { cls: "sakura-manager-card-summary", text: post.summary });

      const actions = card.createDiv({ cls: "sakura-manager-card-actions" });
      const openButton = actions.createEl("button", { text: "打开" });
      openButton.addEventListener("click", () => this.plugin.openManagedPost(post));

      const copyButton = actions.createEl("button", { text: "复制链接" });
      copyButton.addEventListener("click", async () => {
        await this.plugin.copyText(post.url || post.relativeUrl || "");
        new Notice("链接已复制。");
      });

      const republishButton = actions.createEl("button", { text: "重发" });
      republishButton.disabled = !post.sourcePath;
      if (!post.sourcePath) {
        republishButton.setAttr("title", "找不到源稿（obsidian/Published 目录中无对应文件），请手动发布。");
      }
      republishButton.addEventListener("click", async () => {
        await this.plugin.republishManagedPost(post);
        await this.loadPosts();
      });

      const coverButton = actions.createEl("button", { text: "封面" });
      coverButton.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/webp,image/gif";
        input.addEventListener("change", async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          try {
            const stagedPath = await stageCoverFile(file, this.plugin.settings.blogRoot);
            const previewUrl = URL.createObjectURL(file);
            new ImagePreviewModal(this.app, {
              imagePreviewUrl: previewUrl,
              currentPosition: post.coverPosition || "50% 50%",
              mode: "cover",
              onConfirm: async (position) => {
                try {
                  await this.plugin.replaceCoverForPost(post, stagedPath, position);
                  await this.loadPosts();
                } catch (error) {
                  console.error(error);
                  new Notice(`更换封面失败：${error.message}`);
                } finally {
                  URL.revokeObjectURL(previewUrl);
                }
              },
              onCancel: () => {
                removeStagedCover(stagedPath, this.plugin.settings.blogRoot);
                URL.revokeObjectURL(previewUrl);
              }
            }).open();
          } catch (error) {
            console.error(error);
            new Notice(`更换封面失败：${error.message}`);
          }
        });
        input.click();
      });

      const deleteButton = actions.createEl("button", { text: "删除" });
      deleteButton.addClass("sakura-manager-danger");
      deleteButton.addEventListener("click", () => new DeletePostModal(this.app, this.plugin, post, this).open());
    });
  }

  async loadPages() {
    if (!this.pagesListEl) return;
    this.renderLoading(this.pagesListEl);
    this.statsEl.setText("正在读取页面...");

    try {
      this.pages = await this.plugin.listPages();
      this.statsEl.setText(`共 ${this.pages.length} 个页面`);
      this.renderPages();
    } catch (error) {
      console.error(error);
      this.statsEl.setText("读取失败");
      this.pagesListEl.empty();
      const state = this.pagesListEl.createDiv({ cls: "sakura-manager-empty sakura-manager-empty--error" });
      state.createEl("strong", { text: "页面读取失败" });
      state.createEl("p", { text: error.message });
      state.createEl("button", { text: "重试" }).addEventListener("click", () => this.loadPages());
    }
  }

  renderPages() {
    this.pagesListEl.empty();
    const filtered = this.filterList(this.pages, ["title", "path"]);
    const sorted = this.sortPages(filtered);

    if (!this.pages.length) {
      this.pagesListEl.createEl("div", { cls: "sakura-manager-empty", text: "没有找到独立页面。" });
      return;
    }
    if (!sorted.length) {
      this.pagesListEl.createEl("div", { cls: "sakura-manager-empty", text: "没有匹配的结果。" });
      return;
    }

    sorted.forEach((page) => {
      const card = this.pagesListEl.createDiv({ cls: "sakura-manager-card" });

      const header = card.createDiv({ cls: "sakura-manager-card-header" });
      header.createEl("h3", { cls: "sakura-manager-card-title", text: page.title });
      if (page.headerImage) {
        header.createSpan({ cls: "sakura-manager-has-image", text: "🖼 有头图" });
      }

      const meta = card.createDiv({ cls: "sakura-manager-card-meta" });
      meta.createSpan({ text: page.path });

      const actions = card.createDiv({ cls: "sakura-manager-card-actions" });
      const openButton = actions.createEl("button", { text: "打开编辑" });
      openButton.addClass("mod-cta");
      openButton.addEventListener("click", () => {
        this.plugin.openPageFile(page.path);
      });

      const headerButton = actions.createEl("button", { text: "设置头部图片" });
      headerButton.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/webp,image/gif";
        input.addEventListener("change", async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          try {
            const previewUrl = URL.createObjectURL(file);
            new ImagePreviewModal(this.app, {
              imagePreviewUrl: previewUrl,
              currentPosition: page.coverPosition || "50% 50%",
              mode: "header",
              onConfirm: async (position) => {
                try {
                  const imageUrl = await this.stageHeaderImage(file, page.path);
                  await this.plugin.setPageHeaderImage(page.path, imageUrl, position);
                  new Notice(`头部图片已设置：${imageUrl}`);
                  await this.loadPages();
                } catch (error) {
                  console.error(error);
                  new Notice(`设置失败：${error.message}`);
                } finally {
                  URL.revokeObjectURL(previewUrl);
                }
              },
              onCancel: () => URL.revokeObjectURL(previewUrl)
            }).open();
          } catch (error) {
            console.error(error);
            new Notice(`设置失败：${error.message}`);
          }
        });
        input.click();
      });

      const deletePageBtn = actions.createEl("button", { text: "删除" });
      deletePageBtn.addClass("sakura-manager-danger");
      deletePageBtn.addEventListener("click", () => {
        const confirmModal = new Modal(this.app);
        confirmModal.onOpen = () => {
          confirmModal.contentEl.empty();
          confirmModal.contentEl.createEl("h2", { text: "确认删除页面" });
          confirmModal.contentEl.createEl("p", { text: `即将删除：${page.title}` });
          confirmModal.contentEl.createEl("p", { text: page.path, cls: "sakura-publisher-desc" });
          const btns = confirmModal.contentEl.createDiv({ cls: "sakura-publisher-actions" });
          btns.createEl("button", { text: "取消" }).addEventListener("click", () => confirmModal.close());
          const confirmBtn = btns.createEl("button", { text: "确认删除并推送" });
          confirmBtn.addClass("sakura-manager-danger");
          confirmBtn.addEventListener("click", async () => {
            confirmModal.close();
            await this.plugin.deletePage(page.path, page.title);
            await this.loadPages();
          });
        };
        confirmModal.open();
      });
    });
  }

  async stageHeaderImage(file, pagePath) {
    const blogRoot = this.plugin.settings.blogRoot;
    const stagedPath = await stageCoverFile(file, blogRoot);
    try {
      const output = await this.plugin.runNode([
        "scripts/import-site-image.js",
        "--source",
        stagedPath,
        "--name",
        file.name || "header.png"
      ]);
      return JSON.parse(output).url;
    } finally {
      removeStagedCover(stagedPath, blogRoot);
    }
  }

  showCreateDialog() {
    const modal = new Modal(this.app);
    let title = "";
    modal.onOpen = () => {
      modal.contentEl.empty();
      modal.contentEl.createEl("h2", { text: "新建页面" });

      new Setting(modal.contentEl)
        .setName("页面标题")
        .addText((text) => {
          text.setPlaceholder("例如：友链").onChange((value) => {
            title = value.trim();
          });
        });

      const actions = modal.contentEl.createDiv({ cls: "sakura-publisher-actions" });
      actions.createEl("button", { text: "取消" }).addEventListener("click", () => modal.close());
      const confirmButton = actions.createEl("button", { text: "创建" });
      confirmButton.addClass("mod-cta");
      confirmButton.addEventListener("click", async () => {
        if (!title) {
          new Notice("请输入页面标题。");
          return;
        }
        modal.close();
        try {
          const result = await this.plugin.createPage(title);
          new Notice(`页面已创建：${result.path}`);
          await this.plugin.openPageFile(result.path);
          await this.loadPages();
        } catch (error) {
          console.error(error);
          new Notice(`创建失败：${error.message}`);
        }
      });
    };
    modal.open();
  }

  async pushPages() {
    new Notice("开始推送页面...");
    try {
      const result = await this.plugin.pushPages();
      if (result.includes("No content changes to publish.")) {
        new Notice("没有需要推送的改动。");
      } else {
        await this.plugin.showDeploymentNotice(result, "页面已提交，等待检查和部署。");
      }
    } catch (error) {
      console.error(error);
      new Notice(`推送失败：${error.message}`);
    }
  }

  onClose() {
    if (!this.submitted && this.publishMeta) {
      removeStagedCover(this.publishMeta.coverPath, this.plugin.settings.blogRoot);
    }
    this.contentEl.empty();
  }
}

class DeletePostModal extends Modal {
  constructor(app, plugin, post, manager) {
    super(app);
    this.plugin = plugin;
    this.post = post;
    this.manager = manager;
    this.deleteAssets = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sakura-publisher-modal");
    contentEl.empty();
    contentEl.createEl("h2", { text: "确认删除文章" });
    contentEl.createEl("p", { text: `即将删除：${this.post.title}` });
    contentEl.createEl("p", { text: this.post.postPath });

    new Setting(contentEl)
      .setName("同时删除图片资源")
      .setDesc(this.post.assetPath || "这会删除文章对应的 assets/images/posts 目录。")
      .addToggle((toggle) => {
        toggle.setValue(false).onChange((value) => {
          this.deleteAssets = value;
        });
      });

    const actions = contentEl.createDiv({ cls: "sakura-publisher-actions" });
    actions.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
    const confirmButton = actions.createEl("button", { text: "确认删除并推送" });
    confirmButton.addClass("sakura-manager-danger");
    confirmButton.addEventListener("click", async () => {
      this.close();
      await this.plugin.deleteManagedPost(this.post, { deleteAssets: this.deleteAssets });
      if (this.manager) await this.manager.loadPosts();
    });
  }
}

class SakuraPublisherSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Sakura Blog Publisher" });

    new Setting(containerEl)
      .setName("统一站点项目目录")
      .setDesc("主页与博客共用的 Astro 工程目录，默认使用 D:\\MyHomepage\\sakur7a.github.io。")
      .addText((text) =>
        text
          .setPlaceholder("D:\\MyHomepage\\sakur7a.github.io")
          .setValue(this.plugin.settings.blogRoot)
          .onChange(async (value) => {
            const nextRoot = value.trim() || DEFAULT_SETTINGS.blogRoot;
            if (nextRoot !== this.plugin.settings.blogRoot) delete this.plugin.settings.lastSubmission;
            this.plugin.settings.blogRoot = nextRoot;
            await this.plugin.saveSettings();
          })
      );



  }
}
