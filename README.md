# MD Viewer Tauri

Small Windows Markdown viewer/editor built with Tauri.

This project is the lighter replacement for the earlier Electron MVP. It keeps the same practical workflow:

- open Markdown files quickly
- paste content from AI chats
- preview formatted Markdown live
- save back to `.md`
- export to HTML and PDF

The main reason for the Tauri version is size. The Tauri build is much smaller than the Electron build because it uses the system WebView instead of bundling Chromium.

## Goals

This app is intentionally narrow in scope.

Primary goals:

- simple Markdown reading and editing
- easy paste-from-AI workflow
- lightweight Windows desktop app
- per-user install without requiring admin rights
- optional portable usage

Non-goals for this MVP:

- full WYSIWYG editing
- plugin ecosystem
- Obsidian sync
- complex note management

## Features

Current MVP features:

- open `.md`, `.markdown`, and `.txt`
- side-by-side editor and preview
- `Open`, `Clear`, `Save`, `Save As`
- recent files list
- reading mode
- dark mode
- rich paste HTML-to-Markdown conversion when available on clipboard
- HTML export
- PDF export
- unsaved-change warning on close
- startup file opening by path argument

Removed on purpose:

- drag and drop

Reason:

- it was unreliable in the earlier implementation and was removed instead of keeping a broken interaction

## Project Structure

Top-level layout:

- [`package.json`](C:\Users\tao\Frischsenteret Dropbox\tao zhang\helloWorld\md-viewer-tauri\package.json): frontend scripts and JS dependencies
- [`vite.config.js`](C:\Users\tao\Frischsenteret Dropbox\tao zhang\helloWorld\md-viewer-tauri\vite.config.js): Vite frontend config
- [`index.html`](C:\Users\tao\Frischsenteret Dropbox\tao zhang\helloWorld\md-viewer-tauri\index.html): app shell HTML
- [`src/main.js`](C:\Users\tao\Frischsenteret Dropbox\tao zhang\helloWorld\md-viewer-tauri\src\main.js): frontend behavior
- [`src/styles.css`](C:\Users\tao\Frischsenteret Dropbox\tao zhang\helloWorld\md-viewer-tauri\src\styles.css): UI styling
- [`src-tauri/src/main.rs`](C:\Users\tao\Frischsenteret Dropbox\tao zhang\helloWorld\md-viewer-tauri\src-tauri\src\main.rs): Rust backend commands
- [`src-tauri/tauri.conf.json`](C:\Users\tao\Frischsenteret Dropbox\tao zhang\helloWorld\md-viewer-tauri\src-tauri\tauri.conf.json): Tauri app config
- [`src-tauri/Cargo.toml`](C:\Users\tao\Frischsenteret Dropbox\tao zhang\helloWorld\md-viewer-tauri\src-tauri\Cargo.toml): Rust dependencies
- [`portable/md-viewer-tauri.exe`](C:\Users\tao\Frischsenteret Dropbox\tao zhang\helloWorld\md-viewer-tauri\portable\md-viewer-tauri.exe): portable executable

## Architecture

### Frontend

The frontend is a small Vite app using plain JavaScript.

Main responsibilities:

- editor state
- preview rendering
- theme/read mode toggles
- recent files tracking in local storage
- clipboard HTML-to-Markdown conversion
- invoking Rust backend commands through Tauri

Key libraries:

- `markdown-it`
- `highlight.js`
- `turndown`
- `turndown-plugin-gfm`
- `@tauri-apps/api`

### Backend

The Rust backend handles desktop-specific tasks:

- file open dialog
- file save dialog
- reading files
- writing files
- HTML export
- PDF export
- startup file argument parsing
- force-exit behavior for clean close handling

### PDF Export Strategy

PDF export currently uses a pragmatic Windows-specific approach:

1. render current Markdown to temporary HTML
2. call installed Microsoft Edge in headless mode
3. ask Edge to print that HTML to PDF

This keeps the app small, but it means PDF export currently depends on Edge being installed.

## Development Environment

Recommended environment:

- Windows 11
- Node.js + npm
- Rust toolchain
- Tauri CLI
- Microsoft Edge installed

This project was built in a local Windows environment using:

- Node/npm for frontend and Tauri CLI
- Rust/Cargo for backend build
- NSIS through Tauri for Windows installer packaging

## Setup

Install JS dependencies:

```powershell
npm install
```

Make sure Rust is available in the shell:

```powershell
$env:HOME=$env:USERPROFILE
$env:RUSTUP_HOME="$env:USERPROFILE\.rustup"
$env:CARGO_HOME="$env:USERPROFILE\.cargo"
$env:Path="$env:USERPROFILE\.cargo\bin;$env:Path"
```

## Development Commands

Frontend-only build:

```powershell
npm run build
```

Tauri dev mode:

```powershell
npm run tauri:dev
```

Tauri Windows installer build:

```powershell
npx tauri build --bundles nsis
```

Rust backend direct build:

```powershell
cargo build
cargo build --release
```

## Packaging

### Installer

Current Tauri installer output:

- [`src-tauri/target/release/bundle/nsis/MD Viewer Tauri_0.1.0_x64-setup.exe`](C:\Users\tao\Frischsenteret Dropbox\tao zhang\helloWorld\md-viewer-tauri\src-tauri\target\release\bundle\nsis\MD Viewer Tauri_0.1.0_x64-setup.exe)

Properties:

- proper Windows installer
- uninstall entry appears in Control Panel / Apps
- per-user install
- does not require admin rights in the normal case

### Portable

Portable zip:

- [`MD-Viewer-Tauri-Portable.zip`](C:\Users\tao\Frischsenteret Dropbox\tao zhang\helloWorld\md-viewer-tauri\MD-Viewer-Tauri-Portable.zip)

Properties:

- no installer
- no Control Panel entry
- no file association
- unzip and run

## Install Behavior

Current installer behavior is per-user.

That means:

- install target is under the user profile, not `C:\Program Files`
- admin rights are typically not required
- suitable for many managed systems where standard users cannot write to `Program Files`

Important consequence:

- if an organization blocks user installs or local execution by policy, even per-user installation may still be restricted

For highly managed environments, the portable build is often the safest fallback.

## Usage Guide

### Open Files

- click `Open`
- choose a `.md`, `.markdown`, or `.txt` file

### Clear Editor

- click `Clear`
- or use `Ctrl+L`

This resets the current document to `Untitled` and clears the editor so you can paste new content quickly.

### Save

- `Save` writes back to the current file
- `Save As` writes to a new file
- `Ctrl+S` saves

### Rich Paste

If the source application places HTML on the clipboard, the app converts that HTML into Markdown before inserting it.

This is useful for copying content from AI chat apps and web pages.

Limit:

- if the source only provides plain text, the app cannot reconstruct the original formatting perfectly

### Export HTML

- click `Export HTML`
- or use `Ctrl+E`

### Export PDF

- click `Export PDF`
- or use `Ctrl+Shift+E`

Current PDF export notes:

- uses Microsoft Edge headless printing
- temp HTML files may briefly exist in the user temp folder
- old temp export files are cleaned up later, not immediately

### Close Warning

If the current document has unsaved changes:

- closing the app shows a discard warning
- confirming discard exits the app

## Current Known Limitations

- no drag and drop
- no `.md` file association yet in the Tauri installer
- PDF export depends on Microsoft Edge
- no native PDF engine yet
- recent files are stored in frontend local storage rather than a more formal app-state store

## Why Tauri Instead of Electron

Main reason:

- much smaller application size

Observed practical result in this project:

- Tauri release exe is around 8 MB
- Tauri installer is around 2 MB

That is dramatically smaller than the Electron version.

## Suggested Next Improvements

- add `.md` file association to the installer
- add a custom app icon
- improve startup state persistence
- improve paste conversion edge cases
- replace Edge-based PDF export with a more self-contained solution if needed
- shrink frontend bundle size a bit by code-splitting

## Status

This project is currently a working MVP.

It is already usable for:

- opening Markdown
- pasting AI content
- reviewing formatted output
- saving Markdown
- exporting HTML/PDF

It still has room for polish, but the core workflow is in place.
