/**
 * powershellScript.ts — Planned PowerShell script generation service.
 *
 * Will provide runtime generation of customized imaging/deployment
 * PowerShell scripts based on current app configuration and target device
 * metadata (model, serial number, BIOS version, etc.).
 *
 * Currently the static script is rendered in ImagingScriptViewer.tsx.
 * This service will replace that with a dynamic template engine.
 */

export interface ScriptConfig {
    networkSharePath: string;
    targetBiosVersion: string;
    targetDcuVersion: string;
    targetWinVersion: string;
    enableAutoReboot: boolean;
}

/** Placeholder — not yet implemented. */
export const generateImagingScript = (_config: ScriptConfig): string => {
    throw new Error('Dynamic script generation is not yet implemented. See services/powershellScript.ts.');
};
