import "./styles.css";
import markdownit from "markdown-it";
import hljs from "highlight.js";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { invoke } from "@tauri-apps/api/core";
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
let recentFiles = JSON.parse(localStorage.getItem("mdViewerTauri.recentFiles") || "[]");
let isReadingMode = localStorage.getItem("mdViewerTauri.readingMode") === "true";
let theme = localStorage.getItem("mdViewerTauri.theme") || "light";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtmlDocument() {
  const previewHtml = md.render(editor.value);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(currentFileName.replace(/\.md$/i, "") || "document")}</title>
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
  preview.innerHTML = md.render(content || "");
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
    suggestedName: currentFileName.replace(/\.md$/i, "") + ".html"
  });
}

async function exportPdf() {
  await invoke("export_pdf", {
    filePath: currentFilePath,
    htmlDocument: buildHtmlDocument(),
    suggestedName: currentFileName.replace(/\.md$/i, "") + ".pdf"
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
