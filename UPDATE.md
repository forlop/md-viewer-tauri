# Update Notes

## 2026-06-01

This update improves Markdown rendering for technical notes while keeping the app lightweight.

### Added

- KaTeX math rendering for inline formulas like `$a^2+b^2=c^2$`.
- KaTeX display math rendering for blocks like `$$\int_0^1 x^2 dx$$`.
- Local figure rendering for Markdown image paths relative to the opened document, such as `figures/fig02_relu.svg`.
- Live preview support for local figures through Tauri's asset protocol.
- HTML/PDF export support for formulas and local figures.

### Fixed

- Startup file handling now accepts `.md`, `.markdown`, and `.txt` consistently.
- Export file names now handle `.md`, `.markdown`, and `.txt` source files consistently.
- Corrupt recent-file data in local storage no longer breaks startup.
- Clearing a document now resets the saved-state marker correctly.

### Build

- Portable ZIP: `MD-Viewer-Tauri-Portable.zip`
- Installer: `MD Viewer Tauri_0.1.0_x64-setup.exe`

### SHA256

- `MD-Viewer-Tauri-Portable.zip`: `F5A2B8C2699A2E42698E0CCAEAED30D74D0DA59D39172D5F2F7CB996E5EC08FF`
- `MD Viewer Tauri_0.1.0_x64-setup.exe`: `F93F23E74ABBAA93489C345DB914C35E38E6221C5C3BA46232E63DB291F30D65`

### Verified

- `npm run build`
- `cargo check`
- `npm run tauri:build`
- `npm audit --audit-level=moderate`
- Portable ZIP contents verified.
