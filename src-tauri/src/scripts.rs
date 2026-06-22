//! PowerShell payloads embedded into the binary at compile time, shared by
//! every Rust command that needs to run them (`bulk_update`, `update.rs`),
//! so there is exactly one copy of each script in the codebase.

pub const DCU_SCRIPT: &str = include_str!("scripts/dcu.ps1");
pub const WIN_UPDATE_SCRIPT: &str = include_str!("scripts/winupdate.ps1");
