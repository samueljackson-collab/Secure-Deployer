import React, { useState } from 'react';
import { Search, Video, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface ExtractedVideo {
    url: string;
    source: string;
    isSafe: boolean;
    confidence: number;
    reason: string;
}

export const VideoExtractor: React.FC = () => {
    const [targetUrl, setTargetUrl] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [results, setResults] = useState<ExtractedVideo[]>([]);
    const [error, setError] = useState<string | null>(null);

    const extractVideos = async () => {
        if (!targetUrl) return;
        setIsExtracting(true);
        setError(null);
        setResults([]);

        try {
            // Simulate headless browser extraction
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const mockExtractedUrls = [
                { url: 'https://example.com/video1.mp4', source: 'HTML5 <video> tag' },
                { url: 'https://cdn.ads.com/tracker.mp4', source: 'JavaScript Variable (window.__INITIAL_STATE__)' },
                { url: 'https://malicious-site.com/payload.exe', source: 'Dynamic iframe injection' },
                { url: 'https://example.com/stream.m3u8', source: 'Network Request Interception' }
            ];

            // Use Gemini to analyze the URLs
            const prompt = `
Analyze the following extracted URLs and determine if they are legitimate videos, or if they are likely ads, trackers, or malicious files (viruses).
URLs to analyze:
${JSON.stringify(mockExtractedUrls, null, 2)}

Return a JSON array of objects with the following structure:
[
  {
    "url": "string",
    "isSafe": boolean (true if it's a legitimate video, false if ad/virus/tracker),
    "confidence": number (0-100),
    "reason": "string (brief explanation why)"
  }
]
`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                url: { type: Type.STRING },
                                isSafe: { type: Type.BOOLEAN },
                                confidence: { type: Type.NUMBER },
                                reason: { type: Type.STRING }
                            },
                            required: ['url', 'isSafe', 'confidence', 'reason']
                        }
                    }
                }
            });

            const aiAnalysis = JSON.parse(response.text || '[]');
            
            const finalResults = mockExtractedUrls.map(mock => {
                const analysis = aiAnalysis.find((a: Record<string, unknown>) => a.url === mock.url);
                return {
                    ...mock,
                    isSafe: (analysis?.isSafe as boolean) ?? false,
                    confidence: (analysis?.confidence as number) ?? 0,
                    reason: (analysis?.reason as string) ?? 'Analysis failed'
                };
            });

            setResults(finalResults);
        } catch (err: unknown) {
            console.error("Extraction error:", err);
            setError(err instanceof Error ? err.message : 'Failed to extract and analyze videos.');
        } finally {
            setIsExtracting(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-900 text-gray-100 p-6 overflow-y-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
                    <Video className="w-6 h-6 text-purple-400" />
                    AI Video Extractor
                </h2>
                <p className="text-gray-400">
                    Extract video URLs from web pages using simulated headless browser techniques and analyze them with AI to filter out ads and malicious content.
                </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 shadow-lg mb-8">
                <div className="flex gap-4">
                    <input 
                        type="url" 
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        placeholder="Enter webpage URL (e.g., https://example.com/page)"
                        className="flex-grow bg-gray-900 border border-gray-700 rounded px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    <button 
                        onClick={extractVideos}
                        disabled={isExtracting || !targetUrl}
                        className="px-6 py-3 bg-purple-600 text-white font-bold rounded hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isExtracting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        Extract & Analyze
                    </button>
                </div>
                {error && (
                    <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {results.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Extraction Results</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {results.map((result, idx) => (
                            <motion.div 
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className={`p-4 rounded-lg border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between ${result.isSafe ? 'bg-green-900/10 border-green-500/30' : 'bg-red-900/10 border-red-500/30'}`}
                            >
                                <div className="flex-grow overflow-hidden">
                                    <div className="flex items-center gap-2 mb-1">
                                        {result.isSafe ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertTriangle className="w-5 h-5 text-red-500" />}
                                        <span className={`font-bold ${result.isSafe ? 'text-green-400' : 'text-red-400'}`}>
                                            {result.isSafe ? 'Safe Video' : 'Unsafe / Ad'}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                                            {result.confidence}% Confidence
                                        </span>
                                    </div>
                                    <div className="font-mono text-sm text-gray-300 truncate mb-1" title={result.url}>
                                        {result.url}
                                    </div>
                                    <div className="text-xs text-gray-500 flex gap-4">
                                        <span>Source: {result.source}</span>
                                    </div>
                                </div>
                                <div className="w-full md:w-1/3 text-sm text-gray-400 bg-gray-900/50 p-3 rounded border border-gray-800">
                                    <strong className="text-gray-300">AI Reasoning:</strong> {result.reason}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
