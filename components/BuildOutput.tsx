
import React, { useState } from 'react';

const BuildLog: React.FC<{ logs: string[] }> = ({ logs }) => {
    if (logs.length === 0) return null;
    return (
        <div className="mt-4 bg-black/50 p-4 rounded-lg border border-gray-800 text-sm text-gray-300 overflow-x-auto max-h-60 font-mono">
            {logs.map((log, index) => (
                <p key={index} className="whitespace-pre-wrap">{log}</p>
            ))}
        </div>
    );
};

export const BuildOutput: React.FC = () => {
    const [isBuilding, setIsBuilding] = useState(false);
    const [buildLogs, setBuildLogs] = useState<string[]>([]);
    const [buildComplete, setBuildComplete] = useState(false);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const handleSimulateBuild = async () => {
        setIsBuilding(true);
        setBuildComplete(false);
        setBuildLogs([]);
        
        const addLog = (msg: string) => setBuildLogs(prev => [...prev, msg]);

        addLog('> npm run tauri build');
        await sleep(500);
        addLog('  [INFO] Checking for Tauri dependencies...');
        await sleep(1000);
        addLog('  [INFO] Compiling frontend assets (React + Tailwind)...');
        await sleep(1500);
        addLog('  [SUCCESS] Frontend compiled successfully.');
        await sleep(500);
        addLog('  [INFO] Bundling web assets into application...');
        await sleep(1000);
        addLog('  [INFO] Compiling Rust backend...');
        await sleep(2500);
        addLog('  [SUCCESS] Rust backend compiled.');
        await sleep(500);
        addLog("  [INFO] Generating final executable at 'src-tauri/target/release/secure-deployment-runner.exe'...");
        await sleep(1000);
        addLog('✨ [SUCCESS] Build complete! Executable is ready.');
        
        setIsBuilding(false);
        setBuildComplete(true);
    };

    return (
        <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-[#39FF14]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7l8-4 8 4m-8 12v4m0 0l-4-2m4 2l4-2" />
                    </svg>
                </div>
                <div className="flex-grow">
                    <h2 className="text-2xl font-bold text-[#39FF14]">Application Packaging & Deployment</h2>
                    <p className="text-gray-400 mt-2 font-bold">
                        This application is a web-based UI. To use it as a standalone tool during a task sequence or from a USB drive, it must be packaged into a native executable.
                    </p>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-800 space-y-8 text-gray-300">
                <div>
                    <h3 className="text-lg font-semibold text-gray-100">Recommended Method: Tauri</h3>
                    <p className="mt-1 text-sm">
                        The recommended approach is to use a framework like <a href="https://tauri.app/" target="_blank" rel="noopener noreferrer" className="text-[#39FF14] hover:underline font-semibold">Tauri</a>. It bundles this web interface into a single, small, and efficient executable (<span className="font-mono bg-gray-800 px-1 rounded">.exe</span>) for Windows with no external dependencies.
                    </p>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-gray-100">Simulated Build Output</h3>
                    <p className="mt-1 text-sm mb-4">
                        Click the button below to simulate the build process. In a real environment, this would generate the portable executable ready for distribution.
                    </p>
                    <div className="text-center">
                        <button
                            onClick={handleSimulateBuild}
                            disabled={isBuilding}
                            className={`px-6 py-3 text-black font-semibold rounded-lg transition duration-200 shadow-md flex items-center gap-2 mx-auto ${
                                buildComplete 
                                ? 'bg-green-500 cursor-default'
                                : isBuilding 
                                ? 'bg-gray-700 text-gray-400 cursor-wait animate-pulse' 
                                : 'bg-[#39FF14] hover:bg-[#2ECC10]'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            {buildComplete ? 'Build Succeeded!' : isBuilding ? 'Building...' : 'Generate Portable Executable (.exe)'}
                        </button>
                    </div>
                     <BuildLog logs={buildLogs} />
                </div>
                
                 <div>
                    <h3 className="text-lg font-semibold text-gray-100">How to Build This Application</h3>
                    <p className="mt-1 text-sm mb-4">Follow these steps in your local development environment to produce the final executable.</p>
                    <ol className="list-decimal list-inside mt-2 space-y-4 text-sm">
                        <li>
                            <strong className="text-gray-200">Install Prerequisites:</strong> You'll need Node.js for the frontend and Rust for the backend. Follow the official <a href="https://tauri.app/v1/guides/getting-started/prerequisites" target="_blank" rel="noopener noreferrer" className="text-[#39FF14] hover:underline">Tauri prerequisites guide</a> for your operating system.
                        </li>
                        <li>
                            <strong className="text-gray-200">Install Project Dependencies:</strong> Open a terminal in the project root and run the command:
                            <pre className="bg-black/50 p-2 mt-1 rounded-md text-xs font-mono">npm install</pre>
                        </li>
                         <li>
                            <strong className="text-gray-200">Initialize Tauri (One-Time Setup):</strong> If Tauri isn't already set up for this project, run:
                            <pre className="bg-black/50 p-2 mt-1 rounded-md text-xs font-mono">npm run tauri init</pre>
                        </li>
                        <li>
                            <strong className="text-gray-200">Run the Build Command:</strong> This command handles everything from compiling the frontend to building the final executable.
                             <pre className="bg-black/50 p-2 mt-1 rounded-md text-xs font-mono">npm run tauri build</pre>
                        </li>
                        <li>
                            <strong className="text-gray-200">Locate the Executable:</strong> Once the build is complete, you will find your standalone <code className="font-mono bg-gray-800 px-1 rounded">.exe</code> file in the following directory:
                            <pre className="bg-black/50 p-2 mt-1 rounded-md text-xs font-mono">src-tauri/target/release/your-app-name.exe</pre>
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    );
};