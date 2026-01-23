
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("Gemini API key not found. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const analyzeScript = async (scriptContent: string): Promise<string> => {
    if (!API_KEY) {
        throw new Error("API_KEY for Gemini is not configured.");
    }
  const model = 'gemini-3-flash-preview';

  const prompt = `
    You are an expert PowerShell security analyst for a hospital IT department.
    Analyze the following PowerShell deployment script.
    
    Your analysis should be clear, concise, and formatted as Markdown. Include these sections:
    
    ### 🛡️ Purpose Summary
    Briefly explain what this script does in simple, non-technical terms.

    ### 🔑 Key Functions
    Use a bulleted list to describe the main actions the script performs (e.g., reads CSV, sends Wake-on-LAN, creates remote sessions).

    ### ⚠️ Security & Risk Assessment (Hospital Environment)
    Analyze the script from the perspective of a hospital's strict security and compliance standards. Address the following points:
    - **HIPAA Compliance:** Does any part of the script handle or risk exposing Protected Health Information (PHI)? What improvements could be made to strengthen HIPAA compliance?
    - **Remote Execution Risks:** Given that this runs on a healthcare network, what are the specific vulnerabilities of using PowerShell Remoting (WinRM)? How can these be mitigated (e.g., firewall rules, Just Enough Administration (JEA))?
    - **Credential Security:** The script uses \`Get-Credential\`. Evaluate this method for securing administrative credentials. What are the best practices for its use, and are there more secure alternatives for an automated or semi-automated hospital deployment system?
    - **Auditing & Logging:** Is the logging sufficient for security audits and incident response in a clinical setting? What additional information should be logged?
    
    Here is the script:
    \`\`\`powershell
    ${scriptContent}
    \`\`\`
    `;

  try {
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt
    });
    return response.text ?? "No analysis available.";
  } catch (error) {
    console.error("Gemini API call failed:", error);
    throw new Error("Failed to get analysis from Gemini API.");
  }
};

export const geminiService = {
  analyzeScript,
};
