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
- Installer: `MD Viewer Tauri_0.1.1_x64-setup.exe`

### SHA256

- `MD-Viewer-Tauri-Portable.zip`: `F7EF29B42E05CE58A8672689AC7B10D88301EB0C4DB7DF75016AADE943D73262`
- `MD Viewer Tauri_0.1.1_x64-setup.exe`: `99305909C3E9F23D581399E2DB9339C86B819D665AA8F858E8252A7978356AE7`

### Verified

- `npm run build`
- `cargo check`
- `npm run tauri:build`
- `npm audit --audit-level=moderate`
- Portable ZIP contents verified.
