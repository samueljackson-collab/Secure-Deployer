mod commands;
mod error;
mod scripts;
mod winrm;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_deep_link::init())
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
      commands::scan::scan_device,
      commands::bulk::bulk_update,
      commands::update::apply_dcu_update,
      commands::update::apply_windows_update,
      commands::reboot::reboot_device,
      commands::script::execute_adhoc_script,
      commands::fileop::run_remote_file_op,
      commands::compliance::run_compliance_check
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
