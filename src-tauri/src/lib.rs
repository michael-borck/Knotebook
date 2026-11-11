use std::fs;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};

const ASSET_EXTENSIONS: [&str; 6] = ["png", "jpg", "jpeg", "gif", "webp", "avif"];

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
  fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_optional_text_file(path: String) -> Result<Option<String>, String> {
  match fs::read_to_string(&path) {
    Ok(text) => Ok(Some(text)),
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
    Err(error) => Err(error.to_string()),
  }
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
  fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn backup_and_write(path: String, contents: String, backup_dir: String) -> Result<(), String> {
  let target = PathBuf::from(&path);
  if target.exists() {
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    let file_name = target
      .file_name()
      .map(|name| name.to_string_lossy().to_string())
      .unwrap_or_else(|| "story.ink".to_string());
    let stamp = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map(|duration| duration.as_millis())
      .unwrap_or(0);
    let backup = PathBuf::from(&backup_dir).join(format!("{file_name}.{stamp}.bak"));
    fs::copy(&target, backup).map_err(|e| e.to_string())?;
  }
  fs::write(&target, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_ink_files(root: String) -> Result<Vec<String>, String> {
  let root_path = PathBuf::from(&root);
  if !root_path.is_dir() {
    return Err("Project folder not found".to_string());
  }
  let mut files = Vec::new();
  collect_ink_files(&root_path, &root_path, &mut files).map_err(|e| e.to_string())?;
  files.sort();
  Ok(files)
}

fn collect_ink_files(root: &Path, dir: &Path, files: &mut Vec<String>) -> std::io::Result<()> {
  for entry in fs::read_dir(dir)? {
    let entry = entry?;
    let name = entry.file_name().to_string_lossy().to_string();
    if name.starts_with('.') || name == "node_modules" || name == "target" {
      continue;
    }
    let path = entry.path();
    let file_type = entry.file_type()?;
    if file_type.is_dir() {
      collect_ink_files(root, &path, files)?;
    } else if file_type.is_file() && is_ink_file(&path) {
      if let Ok(relative) = path.strip_prefix(root) {
        files.push(relative.to_string_lossy().replace('\\', "/"));
      }
    }
  }
  Ok(())
}

fn is_ink_file(path: &Path) -> bool {
  path
    .extension()
    .map(|extension| extension.eq_ignore_ascii_case("ink"))
    .unwrap_or(false)
}

#[tauri::command]
fn list_asset_files(root: String) -> Result<Vec<String>, String> {
  let assets_dir = PathBuf::from(&root).join("assets");
  if !assets_dir.is_dir() {
    return Ok(Vec::new());
  }
  let mut files = Vec::new();
  collect_asset_files(&assets_dir, &assets_dir, &mut files).map_err(|e| e.to_string())?;
  files.sort();
  Ok(files
    .into_iter()
    .map(|relative| format!("assets/{relative}"))
    .collect())
}

fn collect_asset_files(
  dir: &Path,
  base: &Path,
  files: &mut Vec<String>,
) -> std::io::Result<()> {
  for entry in fs::read_dir(dir)? {
    let entry = entry?;
    let name = entry.file_name().to_string_lossy().to_string();
    if name.starts_with('.') {
      continue;
    }
    let path = entry.path();
    let file_type = entry.file_type()?;
    if file_type.is_dir() {
      collect_asset_files(&path, base, files)?;
    } else if file_type.is_file() && is_asset_file(&path) {
      if let Ok(relative) = path.strip_prefix(base) {
        files.push(relative.to_string_lossy().replace('\\', "/"));
      }
    }
  }
  Ok(())
}

fn is_asset_file(path: &Path) -> bool {
  path
    .extension()
    .and_then(|extension| extension.to_str())
    .map(|extension| {
      ASSET_EXTENSIONS
        .iter()
        .any(|allowed| extension.eq_ignore_ascii_case(allowed))
    })
    .unwrap_or(false)
}

#[tauri::command]
fn read_asset_data_url(path: String) -> Result<String, String> {
  let bytes = fs::read(&path).map_err(|e| e.to_string())?;
  let mime = mime_for_path(Path::new(&path));
  Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}

fn mime_for_path(path: &Path) -> &'static str {
  match path
    .extension()
    .and_then(|extension| extension.to_str())
    .map(|extension| extension.to_ascii_lowercase())
    .as_deref()
  {
    Some("png") => "image/png",
    Some("jpg") | Some("jpeg") => "image/jpeg",
    Some("gif") => "image/gif",
    Some("webp") => "image/webp",
    Some("avif") => "image/avif",
    _ => "application/octet-stream",
  }
}

#[tauri::command]
fn copy_file(source: String, destination: String) -> Result<(), String> {
  if let Some(parent) = Path::new(&destination).parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::copy(&source, &destination).map_err(|e| e.to_string())?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      read_text_file,
      read_optional_text_file,
      write_text_file,
      backup_and_write,
      list_ink_files,
      list_asset_files,
      read_asset_data_url,
      copy_file
    ])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
