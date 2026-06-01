import "./styles.css";
import "katex/dist/katex.min.css";
import katexCss from "katex/dist/katex.min.css?inline";
import markdownit from "markdown-it";
import hljs from "highlight.js";
import katex from "katex";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const documentStatus = document.getElementById("document-status");
const dirtyIndicator = document.getElementById("dirty-indicator");
const openButton = document.getElementById("open-button");
const clearButton = document.getElementById("clear-button");
const saveButton = document.getElementById("save-button");
const saveAsButton = document.getElementById("save-as-button");
const exportHtmlButton = document.getElementById("export-html-button");
const exportPdfButton = document.getElementById("export-pdf-button");
const themeToggleButton = document.getElementById("theme-toggle-button");
const readingModeButton = document.getElementById("reading-mode-button");
const recentFilesSelect = document.getElementById("recent-files-select");

function renderLatex(source, displayMode) {
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      errorColor: "#a14f2a"
    });
  } catch (_error) {
    return md.utils.escapeHtml(source);
  }
}

function mathPlugin(markdown) {
  markdown.inline.ruler.after("escape", "math_inline", (state, silent) => {
    if (state.src[state.pos] !== "$" || state.src[state.pos + 1] === "$") {
      return false;
    }

    const start = state.pos + 1;
    const end = state.src.indexOf("$", start);
    if (end === -1 || end === start) {
      return false;
    }

    if (!silent) {
      const token = state.push("math_inline", "math", 0);
      token.content = state.src.slice(start, end);
    }

    state.pos = end + 1;
    return true;
  });

  markdown.block.ruler.after("blockquote", "math_block", (state, startLine, endLine, silent) => {
    let pos = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];

    if (state.src.slice(pos, pos + 2) !== "$$") {
      return false;
    }

    if (silent) {
      return true;
    }

    pos += 2;
    const firstLine = state.src.slice(pos, max);
    const singleLineEnd = firstLine.lastIndexOf("$$");
    if (singleLineEnd >= 0) {
      const token = state.push("math_block", "math", 0);
      token.block = true;
      token.content = firstLine.slice(0, singleLineEnd).trim();
      token.map = [startLine, startLine + 1];
      state.line = startLine + 1;
      return true;
    }

    const content = [firstLine];
    let nextLine = startLine + 1;
    let foundClosingDelimiter = false;
    for (; nextLine < endLine; nextLine += 1) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const lineEnd = state.eMarks[nextLine];
      const line = state.src.slice(lineStart, lineEnd);
      const closingIndex = line.lastIndexOf("$$");

      if (closingIndex >= 0) {
        content.push(line.slice(0, closingIndex));
        foundClosingDelimiter = true;
        break;
      }

      content.push(line);
    }

    if (!foundClosingDelimiter) {
      return false;
    }

    const token = state.push("math_block", "math", 0);
    token.block = true;
    token.content = content.join("\n").trim();
    token.map = [startLine, nextLine + 1];
    state.line = nextLine + 1;
    return true;
  });

  markdown.renderer.rules.math_inline = (tokens, index) => renderLatex(tokens[index].content, false);
  markdown.renderer.rules.math_block = (tokens, index) => {
    return `<p class="math-block">${renderLatex(tokens[index].content, true)}</p>\n`;
  };
}

let imageRenderTarget = "preview";

const md = markdownit({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(code, language) {
    if (language && hljs.getLanguage(language)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(code, { language }).value}</code></pre>`;
      } catch (_error) {
        return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`;
      }
    }

    return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`;
  }
});

md.use(mathPlugin);

const defaultImageRenderer = md.renderer.rules.image || ((tokens, index, options, _env, renderer) => {
  return renderer.renderToken(tokens, index, options);
});

md.renderer.rules.image = (tokens, index, options, env, renderer) => {
  const token = tokens[index];
  const src = token.attrGet("src");

  if (src) {
    token.attrSet("src", resolveImageSource(src, imageRenderTarget));
  }

  return defaultImageRenderer(tokens, index, options, env, renderer);
};

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  bulletListMarker: "-"
});

turndown.use(gfm);

let currentFilePath = null;
let currentFileName = "Untitled";
let lastSavedContent = "";
let recentFiles = loadRecentFiles();
let isReadingMode = localStorage.getItem("mdViewerTauri.readingMode") === "true";
let theme = localStorage.getItem("mdViewerTauri.theme") || "light";

function loadRecentFiles() {
  try {
    const parsed = JSON.parse(localStorage.getItem("mdViewerTauri.recentFiles") || "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => item?.filePath && item?.fileName);
  } catch (_error) {
    localStorage.removeItem("mdViewerTauri.recentFiles");
    return [];
  }
}

function basenameWithoutMarkdownExtension(fileName) {
  return (fileName || "document").replace(/\.(md|markdown|txt)$/i, "") || "document";
}

function isRemoteOrEmbeddedSource(src) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(src);
}

function isAbsoluteWindowsPath(src) {
  return /^[a-zA-Z]:[\\/]/.test(src) || /^\\\\/.test(src);
}

function documentDirectory() {
  if (!currentFilePath) {
    return null;
  }

  const separatorIndex = Math.max(currentFilePath.lastIndexOf("\\"), currentFilePath.lastIndexOf("/"));
  return separatorIndex >= 0 ? currentFilePath.slice(0, separatorIndex) : null;
}

function normalizeImagePath(src) {
  try {
    return decodeURI(src);
  } catch (_error) {
    return src;
  }
}

function resolveImagePath(src) {
  const normalizedSrc = normalizeImagePath(src).replaceAll("/", "\\");
  if (isAbsoluteWindowsPath(normalizedSrc)) {
    return normalizedSrc;
  }

  const directory = documentDirectory();
  if (!directory) {
    return src;
  }

  return `${directory}\\${normalizedSrc}`;
}

function fileUrlFromPath(filePath) {
  return `file:///${filePath.replaceAll("\\", "/").replaceAll("#", "%23")}`;
}

function resolveImageSource(src, target) {
  if (isRemoteOrEmbeddedSource(src)) {
    return src;
  }

  const resolvedPath = resolveImagePath(src);
  return target === "export" ? fileUrlFromPath(resolvedPath) : convertFileSrc(resolvedPath);
}

function isBareImageUrl(line) {
  return /^<?https?:\/\/\S+\.(?:apng|avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#]\S*)?>?$/i.test(line.trim());
}

function prepareMarkdown(content) {
  const lines = (content || "").split(/\r?\n/);
  let inFence = false;

  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }

      if (inFence || !isBareImageUrl(line)) {
        return line;
      }

      const url = line.trim().replace(/^<|>$/g, "");
      return `![Figure](${url})`;
    })
    .join("\n");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtmlDocument() {
  const previewHtml = renderContent(editor.value, "export");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(basenameWithoutMarkdownExtension(currentFileName))}</title>
  <style>${katexCss}</style>
  <style>
    body {
      margin: 0;
      padding: 40px;
      color: #2b241b;
      background: #ffffff;
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.75;
    }
    main { max-width: 860px; margin: 0 auto; }
    h1, h2, h3, h4 { line-height: 1.2; }
    pre {
      overflow: auto;
      padding: 14px;
      border-radius: 12px;
      background: #1e1e1e;
      color: #f7f1e8;
    }
    code {
      padding: 0.15em 0.4em;
      border-radius: 6px;
      background: #f4efe8;
      font-family: Consolas, "Courier New", monospace;
    }
    pre code { padding: 0; background: transparent; color: inherit; }
    blockquote {
      padding: 0.2rem 1rem;
      border-left: 4px solid #a14f2a;
      background: rgba(242, 215, 199, 0.35);
    }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      padding: 10px 12px;
      border: 1px solid #d9d1c2;
      text-align: left;
      vertical-align: top;
    }
    img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 1.4rem auto;
      border-radius: 8px;
    }
    p:has(> img:only-child) {
      margin: 1.4rem 0;
      text-align: center;
    }
    .katex-display {
      overflow-x: auto;
      overflow-y: hidden;
      padding: 0.35rem 0;
    }
  </style>
</head>
<body><main>${previewHtml}</main></body>
</html>`;
}

function persistRecentFiles() {
  localStorage.setItem("mdViewerTauri.recentFiles", JSON.stringify(recentFiles.slice(0, 10)));
}

function registerRecentFile(filePath, fileName) {
  if (!filePath) {
    return;
  }

  recentFiles = [
    { filePath, fileName: fileName || filePath.split(/[\\/]/).pop() },
    ...recentFiles.filter((item) => item.filePath !== filePath)
  ].slice(0, 10);

  persistRecentFiles();
  updateRecentFiles();
}

function insertTextAtSelection(text) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  editor.setRangeText(text, start, end, "end");
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyTheme(nextTheme) {
  theme = nextTheme;
  document.documentElement.setAttribute("data-theme", theme);
  themeToggleButton.textContent = theme === "dark" ? "Light" : "Dark";
  localStorage.setItem("mdViewerTauri.theme", theme);
}

function applyReadingMode(nextValue) {
  isReadingMode = nextValue;
  document.body.classList.toggle("reading-mode", isReadingMode);
  readingModeButton.textContent = isReadingMode ? "Split View" : "Reading Mode";
  localStorage.setItem("mdViewerTauri.readingMode", String(isReadingMode));
}

function renderMarkdown(content) {
  preview.innerHTML = renderContent(content, "preview");
}

function renderContent(content, target) {
  imageRenderTarget = target;
  try {
    return md.render(prepareMarkdown(content));
  } finally {
    imageRenderTarget = "preview";
  }
}

function isDirty() {
  return editor.value !== lastSavedContent;
}

function updateStatus() {
  documentStatus.textContent = currentFileName;
  dirtyIndicator.textContent = isDirty() ? "Unsaved changes" : "Saved";
  document.title = `${currentFileName}${isDirty() ? " *" : ""} - MD Viewer Tauri`;
}

function updateRecentFiles() {
  recentFilesSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = recentFiles.length > 0 ? "Recent files" : "No recent files yet";
  recentFilesSelect.appendChild(placeholder);

  for (const item of recentFiles) {
    const option = document.createElement("option");
    option.value = item.filePath;
    option.textContent = item.fileName;
    recentFilesSelect.appendChild(option);
  }

  recentFilesSelect.value = "";
}

function loadDocument({ filePath, content, fileName }) {
  currentFilePath = filePath || null;
  currentFileName = fileName || "Untitled";
  editor.value = content || "";
  lastSavedContent = editor.value;
  renderMarkdown(editor.value);
  updateStatus();
  registerRecentFile(filePath, currentFileName);
}

function clearDocument() {
  currentFilePath = null;
  currentFileName = "Untitled";
  editor.value = "";
  lastSavedContent = "";
  renderMarkdown("");
  updateStatus();
  editor.focus();
}

async function openDocument() {
  const payload = await invoke("open_file_dialog");
  if (!payload) {
    return;
  }

  loadDocument(payload);
}

async function openSpecificFile(filePath) {
  const payload = await invoke("open_specific_file", { filePath });
  if (!payload) {
    return;
  }

  loadDocument(payload);
}

async function saveDocument(saveAs = false) {
  const result = await invoke("save_file", {
    filePath: currentFilePath,
    content: editor.value,
    saveAs
  });

  if (!result || result.canceled) {
    return false;
  }

  currentFilePath = result.filePath;
  currentFileName = result.fileName;
  lastSavedContent = editor.value;
  registerRecentFile(result.filePath, result.fileName);
  updateStatus();
  return true;
}

async function exportHtml() {
  await invoke("export_html", {
    filePath: currentFilePath,
    htmlDocument: buildHtmlDocument(),
    suggestedName: `${basenameWithoutMarkdownExtension(currentFileName)}.html`
  });
}

async function exportPdf() {
  await invoke("export_pdf", {
    filePath: currentFilePath,
    htmlDocument: buildHtmlDocument(),
    suggestedName: `${basenameWithoutMarkdownExtension(currentFileName)}.pdf`
  });
}

editor.addEventListener("input", () => {
  renderMarkdown(editor.value);
  updateStatus();
});

editor.addEventListener("paste", (event) => {
  const html = event.clipboardData?.getData("text/html");
  if (!html) {
    return;
  }

  event.preventDefault();
  const markdown = turndown.turndown(html).trim();
  insertTextAtSelection(markdown);
});

openButton.addEventListener("click", openDocument);
clearButton.addEventListener("click", clearDocument);
saveButton.addEventListener("click", () => saveDocument(false));
saveAsButton.addEventListener("click", () => saveDocument(true));
exportHtmlButton.addEventListener("click", exportHtml);
exportPdfButton.addEventListener("click", exportPdf);
themeToggleButton.addEventListener("click", () => applyTheme(theme === "dark" ? "light" : "dark"));
readingModeButton.addEventListener("click", () => applyReadingMode(!isReadingMode));

recentFilesSelect.addEventListener("change", async () => {
  if (recentFilesSelect.value) {
    await openSpecificFile(recentFilesSelect.value);
    recentFilesSelect.value = "";
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "s" && event.ctrlKey) {
    event.preventDefault();
    saveDocument(event.shiftKey);
  }

  if (event.key.toLowerCase() === "o" && event.ctrlKey) {
    event.preventDefault();
    openDocument();
  }

  if (event.key.toLowerCase() === "l" && event.ctrlKey) {
    event.preventDefault();
    clearDocument();
  }

  if (event.key.toLowerCase() === "e" && event.ctrlKey) {
    event.preventDefault();
    if (event.shiftKey) {
      exportPdf();
      return;
    }

    exportHtml();
  }
});

const appWindow = getCurrentWindow();
appWindow.onCloseRequested(async (event) => {
  event.preventDefault();

  if (!isDirty()) {
    await invoke("force_exit");
    return;
  }

  const shouldClose = window.confirm("You have unsaved changes. Close without saving?");
  if (shouldClose) {
    await invoke("force_exit");
  }
});

applyTheme(theme);
applyReadingMode(isReadingMode);
updateRecentFiles();
loadDocument({ filePath: null, fileName: "Untitled", content: "" });

invoke("get_startup_file").then((payload) => {
  if (payload) {
    loadDocument(payload);
  }
}).catch(() => {
  const lastPath = recentFiles[0]?.filePath;
  if (lastPath) {
    openSpecificFile(lastPath).catch(() => {});
  }
});
