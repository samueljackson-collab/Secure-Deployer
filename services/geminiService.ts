/**
 * geminiService.ts — Planned integration with Google Gemini API.
 *
 * This service will provide AI-powered analysis features:
 * - Script review (PowerShell / batch file security & syntax checking)
 * - Deployment log summarization
 * - Compliance report generation
 *
 * SECURITY NOTE: The Gemini API key must be kept server-side and NEVER
 * bundled into the client-side build. See vite.config.ts for current
 * status. Before enabling this service, move key handling to a backend
 * proxy endpoint.
 */

export interface ScriptAnalysisResult {
    summary: string;
    securityIssues: string[];
    suggestions: string[];
    riskLevel: 'low' | 'medium' | 'high';
}

/** Placeholder — not yet implemented. */
export const analyzeScript = async (_scriptContent: string): Promise<ScriptAnalysisResult> => {
    throw new Error('Gemini script analysis is not yet implemented. See services/geminiService.ts.');
};
