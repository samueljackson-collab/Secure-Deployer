import React, { useState } from 'react';

export const BuildOutputPage: React.FC = () => {
  const [simulated, setSimulated] = useState(false);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8m4-4H8m12-4a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-cyan-400">Application Packaging & Deployment</h2>
            <p className="text-sm text-slate-400">
              Package the interface into a portable executable for USB distribution.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Recommended Method</h3>
            <p className="text-sm text-slate-300">
              Build the executable outside the UI using the existing build scripts.
            </p>
            <div className="mt-3 bg-slate-900/50 border border-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-2">Build commands:</p>
              <pre className="text-xs text-slate-200">
                <code>{`npm run build
npm run build:portable`}</code>
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Simulated Build Output</h3>
            <p className="text-sm text-slate-300 mb-3">
              Click the button below to simulate the packaging flow. In production, this will generate the portable
              executable used for distribution.
            </p>
            <button
              onClick={() => setSimulated(true)}
              className="px-6 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition"
            >
              Generate Portable Executable (.exe)
            </button>
            {simulated && (
              <div className="mt-3 text-sm text-green-400">
                Build complete. Portable executable saved to <span className="font-mono">release/</span>.
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Build Steps</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
              <li>Install dependencies: <span className="font-mono text-cyan-400">npm install</span></li>
              <li>Build the web bundle: <span className="font-mono text-cyan-400">npm run build</span></li>
              <li>Create the portable app: <span className="font-mono text-cyan-400">npm run build:portable</span></li>
              <li>Locate the executable in <span className="font-mono text-cyan-400">release/</span>.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
