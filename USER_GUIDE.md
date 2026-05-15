# MD Viewer User Guide

MD Viewer is a small desktop app for opening, editing, previewing, and exporting Markdown files.

## Main Features

- Open `.md`, `.markdown`, and `.txt` files
- Edit Markdown in a plain text editor
- See live formatted preview
- Clear the editor quickly before pasting new content
- Paste content from AI chats with formatting preserved when HTML is available on the clipboard
- Save back to `.md`
- Export to HTML
- Export to PDF
- Recent files list
- Dark mode
- Reading mode

## Installed App Location

The current Tauri installer is a per-user install.

Typical install location:

- `C:\Users\<your-user>\AppData\Local\Programs\MD Viewer Tauri`

For this user account, that means:

- `C:\Users\tao\AppData\Local\Programs\MD Viewer Tauri`

This is why it can install without administrator rights on many systems.

## Set As Default Viewer For `.md`

If the installer does not automatically become the default Markdown app, you can set it manually in Windows.

### Method 1: From a Markdown file

1. Right-click a `.md` file
2. Choose `Open with`
3. Choose `Choose another app`
4. Click `More apps`
5. Click `Look for another app on this PC`
6. Browse to:
   `C:\Users\tao\AppData\Local\Programs\MD Viewer Tauri`
7. Select `md-viewer-tauri.exe`
8. Enable `Always use this app to open .md files`

### Method 2: From Windows settings

1. Open `Settings`
2. Go to `Apps`
3. Go to `Default apps`
4. Search for `.md`
5. Change the default app to `MD Viewer Tauri`

## Uninstall

### Normal uninstall

1. Open Windows `Settings`
2. Go to `Apps`
3. Open `Installed apps` or `Apps & features`
4. Find `MD Viewer Tauri`
5. Click `Uninstall`

You can also uninstall it from the old Control Panel programs list if you prefer.

### Manual cleanup if needed

If you ever need to remove leftover files manually, check:

- `C:\Users\tao\AppData\Local\Programs\MD Viewer Tauri`

If you used the portable version instead of the installer, uninstall is just:

1. Delete the folder where you unzipped it
2. Delete any shortcuts you created manually

## Notes

- PDF export currently uses Microsoft Edge on Windows
- The portable version does not register itself in Windows and does not appear in the installed apps list
