# Building MD Viewer Tauri

Cross-platform build instructions for Windows, Linux, and macOS. The app is a
Tauri 2.0 project: a web frontend (Vite) + a Rust backend, rendered in each OS's
native webview.

## Prerequisites (all platforms)

- **Node.js** 18+ and npm
- **Rust** (stable) via [rustup](https://rustup.rs)
- Run `npm install` once in the project root before any build.

> Note: `node_modules` is platform-specific (native rollup/Tauri binaries). If you
> copied the repo from another OS, delete `node_modules` and re-run `npm install`.

## PDF export runtime dependency

PDF export shells out to a headless Chromium-family browser. Install **one** of:
Microsoft Edge, Google Chrome, Chromium, or Brave. The app auto-detects it on all
three OSes (standard install locations, then `PATH`).

## Windows

WebView2 ships with Windows 10/11 (auto-installs if missing).

```powershell
npm install
npx tauri build
```

Output: `src-tauri/target/release/bundle/nsis/*-setup.exe`.

## Linux (Debian/Ubuntu/Pop!_OS)

Install the webview + build system dependencies once:

```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
  libayatana-appindicator3-dev libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev build-essential curl wget file libssl-dev
```

Then:

```bash
npm install
npx tauri build
```

Output: `src-tauri/target/release/bundle/deb/*.deb` and `.../appimage/*.AppImage`.
The bare binary is `src-tauri/target/release/md-viewer-tauri`.

> Headless / VM / remote display: if WebKit fails with `GBM EGL ... EGL_NOT_INITIALIZED`,
> the host has no hardware GL. Run with software rendering:
> `WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1 ./md-viewer-tauri`.
> Not needed on a normal desktop with a GPU.

## macOS

WKWebView is built into macOS — nothing to install for the webview. You need the
Xcode Command Line Tools (`xcode-select --install`).

```bash
npm install
npx tauri build
```

Output: `src-tauri/target/release/bundle/macos/*.app` and `.../dmg/*.dmg`.

For distribution outside your own machine, the `.app` must be **code-signed and
notarized** (requires an Apple Developer account, $99/yr). For personal use you can
run the unsigned `.app` via right-click → Open.

## Develop (hot reload)

```bash
npm run tauri:dev
```

## Bundle targets

Configured in `src-tauri/tauri.conf.json` under `bundle.targets`:
`["nsis", "app", "dmg", "deb", "appimage"]`. Tauri builds only the targets valid for
the host OS, so the same config works everywhere.
