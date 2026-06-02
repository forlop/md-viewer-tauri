#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rfd::FileDialog;
use serde::Serialize;
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FilePayload {
    file_path: String,
    file_name: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SavePayload {
    canceled: bool,
    file_path: String,
    file_name: String,
}

fn canceled_save_payload() -> SavePayload {
    SavePayload {
        canceled: true,
        file_path: String::new(),
        file_name: String::new(),
    }
}

fn file_name_from_path(path: &str, fallback: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(fallback)
        .to_string()
}

fn is_supported_document(path: &str) -> bool {
    matches!(
        Path::new(path)
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("md" | "markdown" | "txt")
    )
}

fn read_file_payload(file_path: &str) -> Result<FilePayload, String> {
    let content = fs::read_to_string(file_path).map_err(|error| error.to_string())?;
    let file_name = file_name_from_path(file_path, "Untitled");

    Ok(FilePayload {
        file_path: file_path.to_string(),
        file_name,
        content,
    })
}

#[tauri::command]
fn open_file_dialog() -> Result<Option<FilePayload>, String> {
    let file = FileDialog::new()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .pick_file();

    match file {
        Some(path) => read_file_payload(path.to_string_lossy().as_ref()).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
fn open_specific_file(file_path: String) -> Result<Option<FilePayload>, String> {
    if !Path::new(&file_path).exists() {
        return Ok(None);
    }

    read_file_payload(&file_path).map(Some)
}

#[tauri::command]
fn save_file(
    file_path: Option<String>,
    content: String,
    save_as: bool,
) -> Result<SavePayload, String> {
    let target_path = if save_as || file_path.as_deref().unwrap_or("").is_empty() {
        FileDialog::new()
            .set_file_name(file_path.as_deref().unwrap_or("untitled.md"))
            .add_filter("Markdown", &["md"])
            .save_file()
            .map(|path| path.to_string_lossy().to_string())
    } else {
        file_path
    };

    let Some(target_path) = target_path else {
        return Ok(canceled_save_payload());
    };

    fs::write(&target_path, content).map_err(|error| error.to_string())?;
    let file_name = file_name_from_path(&target_path, "untitled.md");

    Ok(SavePayload {
        canceled: false,
        file_path: target_path,
        file_name,
    })
}

#[tauri::command]
fn export_html(
    file_path: Option<String>,
    html_document: String,
    suggested_name: String,
) -> Result<SavePayload, String> {
    let default_name = default_target_name(file_path, suggested_name, "html");
    let target_path = FileDialog::new()
        .set_file_name(&default_name)
        .add_filter("HTML", &["html"])
        .save_file()
        .map(|path| path.to_string_lossy().to_string());

    let Some(target_path) = target_path else {
        return Ok(canceled_save_payload());
    };

    fs::write(&target_path, html_document).map_err(|error| error.to_string())?;
    let file_name = file_name_from_path(&target_path, "document.html");

    Ok(SavePayload {
        canceled: false,
        file_path: target_path,
        file_name,
    })
}

fn default_target_name(
    file_path: Option<String>,
    suggested_name: String,
    extension: &str,
) -> String {
    if let Some(path) = file_path {
        let source = PathBuf::from(path);
        if let Some(stem) = source.file_stem().and_then(|name| name.to_str()) {
            return format!("{stem}.{extension}");
        }
    }

    suggested_name
}

/// Locate a Chromium-family browser (Edge/Chrome/Chromium/Brave) for headless
/// PDF export. The `--headless ... --print-to-pdf` flags are identical across
/// these browsers and across Windows/macOS/Linux, so we just need a binary.
fn find_chromium_browser() -> Option<PathBuf> {
    // Absolute install locations, by platform.
    #[cfg(target_os = "windows")]
    let absolute_candidates: &[&str] = &[
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ];
    #[cfg(target_os = "macos")]
    let absolute_candidates: &[&str] = &[
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ];
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let absolute_candidates: &[&str] = &[
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/microsoft-edge",
        "/usr/bin/brave-browser",
        "/snap/bin/chromium",
    ];

    if let Some(path) = absolute_candidates
        .iter()
        .map(PathBuf::from)
        .find(|path| path.exists())
    {
        return Some(path);
    }

    // Fall back to anything on PATH (handles non-standard installs / Linux).
    let names = [
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "microsoft-edge",
        "brave-browser",
    ];
    names.iter().find_map(|name| find_on_path(name))
}

/// Search the PATH environment variable for an executable by name.
fn find_on_path(name: &str) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;
    env::split_paths(&path_var)
        .map(|dir| dir.join(name))
        .find(|candidate| candidate.is_file())
}

fn cleanup_old_temp_exports(temp_dir: &Path) {
    let Ok(entries) = fs::read_dir(temp_dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };

        if !name.starts_with("md-viewer-export-") || !name.ends_with(".html") {
            continue;
        }

        let Ok(metadata) = entry.metadata() else {
            continue;
        };

        let Ok(modified) = metadata.modified() else {
            continue;
        };

        let age = SystemTime::now()
            .duration_since(modified)
            .unwrap_or(Duration::ZERO);

        if age > Duration::from_secs(60 * 60 * 24) {
            let _ = fs::remove_file(path);
        }
    }
}

#[tauri::command]
fn export_pdf(
    file_path: Option<String>,
    html_document: String,
    suggested_name: String,
) -> Result<SavePayload, String> {
    let default_name = default_target_name(file_path, suggested_name, "pdf");
    let target_path = FileDialog::new()
        .set_file_name(&default_name)
        .add_filter("PDF", &["pdf"])
        .save_file()
        .map(|path| path.to_string_lossy().to_string());

    let Some(target_path) = target_path else {
        return Ok(canceled_save_payload());
    };

    let browser_path = find_chromium_browser().ok_or_else(|| {
        "No compatible browser found. PDF export needs a Chromium-based browser \
         (Microsoft Edge, Google Chrome, Chromium, or Brave) installed."
            .to_string()
    })?;

    let temp_dir = env::temp_dir();
    cleanup_old_temp_exports(&temp_dir);
    let temp_name = format!(
        "md-viewer-export-{}.html",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_millis()
    );
    let temp_html_path = temp_dir.join(temp_name);
    fs::write(&temp_html_path, html_document).map_err(|error| error.to_string())?;
    let edge_profile_dir = temp_dir.join("md-viewer-edge-profile");
    let _ = fs::create_dir_all(&edge_profile_dir);

    let normalized_temp = temp_html_path.to_string_lossy().replace('\\', "/");
    // Windows paths ("C:/...") need the triple-slash form; POSIX paths already
    // begin with "/", so prefix only "file://" to avoid a stray fourth slash.
    let html_arg = if normalized_temp.starts_with('/') {
        format!("file://{normalized_temp}")
    } else {
        format!("file:///{normalized_temp}")
    };
    let status = Command::new(browser_path)
        .arg("--headless=old")
        .arg("--disable-gpu")
        .arg(format!(
            "--user-data-dir={}",
            edge_profile_dir.to_string_lossy()
        ))
        .arg("--print-to-pdf-no-header")
        .arg("--no-pdf-header-footer")
        .arg(format!("--print-to-pdf={target_path}"))
        .arg(html_arg)
        .status()
        .map_err(|error| error.to_string())?;

    if !status.success() {
        return Err("Edge failed to export the PDF.".to_string());
    }

    let file_name = file_name_from_path(&target_path, "document.pdf");

    Ok(SavePayload {
        canceled: false,
        file_path: target_path,
        file_name,
    })
}

#[tauri::command]
fn get_startup_file() -> Result<Option<FilePayload>, String> {
    for arg in std::env::args().skip(1) {
        if is_supported_document(&arg) && Path::new(&arg).exists() {
            return read_file_payload(&arg).map(Some);
        }
    }

    Ok(None)
}

#[tauri::command]
fn force_exit(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_file_dialog,
            open_specific_file,
            save_file,
            export_html,
            export_pdf,
            get_startup_file,
            force_exit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
