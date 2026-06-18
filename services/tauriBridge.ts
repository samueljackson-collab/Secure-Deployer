// Thin wrapper around @tauri-apps/api so the rest of the app can call
// `invokeCommand` without caring whether it's running inside the packaged
// Tauri desktop shell or in plain `vite dev` (browser-only, no Rust
// backend). Falling back to `null` lets callers in services/* decide
// per-feature whether a browser-mode mock is acceptable.
export const isTauri = (): boolean =>
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const invokeCommand = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
};
