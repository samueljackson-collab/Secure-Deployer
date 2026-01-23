
import React, { useState } from 'react';
import { geminiService } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface ScriptAnalyzerProps {
    scriptContent: string;
}

export const ScriptAnalyzer: React.FC<ScriptAnalyzerProps> = ({ scriptContent }) => {
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAnalyze = async () => {
        setIsLoading(true);
        setError('');
        setAnalysis('');
        try {
            const result = await geminiService.analyzeScript(scriptContent);
            setAnalysis(result);
        } catch (err) {
            setError('Failed to analyze script. Please check your API key and connection.');
            console.error(err);
        }
        setIsLoading(false);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-cyan-400">AI Script Analysis</h2>
                <button
                    onClick={handleAnalyze}
                    disabled={isLoading}
                    className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:bg-slate-600 transition duration-200"
                >
                    {isLoading ? 'Analyzing...' : 'Analyze PowerShell Script'}
                </button>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-md min-h-[150px] max-h-[400px] overflow-y-auto border border-slate-700">
                {isLoading && <p className="text-slate-400 animate-pulse">Gemini is analyzing the script...</p>}
                {error && <p className="text-red-400">{error}</p>}
                {analysis && (
                     <ReactMarkdown
                        className="prose prose-sm prose-invert max-w-none"
                        components={{
                            h3: ({node, ...props}) => <h3 className="text-cyan-400" {...props} />,
                        }}
                     >{analysis}</ReactMarkdown>
                )}
                 {!analysis && !isLoading && !error && <p className="text-slate-500">Click the button to get an AI-powered summary and security review of the deployment script.</p>}
            </div>
        </div>
    );
};
