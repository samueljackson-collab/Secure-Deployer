
import React from 'react';

export const Header: React.FC = () => {
    return (
        <header className="flex justify-between items-center bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700">
            <div>
                <h1 className="text-2xl font-bold text-cyan-400">Secure Deployment Runner</h1>
                <p className="text-sm text-slate-400">Hospital Network - Remote Deployment Interface</p>
            </div>
            <div className="flex items-center space-x-2">
                 <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                 <span className="text-sm font-medium text-green-400">System Online</span>
            </div>
        </header>
    );
};
