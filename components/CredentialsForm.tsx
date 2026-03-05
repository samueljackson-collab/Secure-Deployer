
import React from 'react';
import type { Credentials } from '../src/types';

interface CredentialsFormProps {
    credentials: Credentials;
    setCredentials: React.Dispatch<React.SetStateAction<Credentials>>;
}

export const CredentialsForm: React.FC<CredentialsFormProps> = ({ credentials, setCredentials }) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCredentials(prev => ({ ...prev, [name]: value }));
    };

    return (
        <form className="space-y-4">
            <div>
                <label htmlFor="username" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Username</label>
                <input
                    type="text"
                    name="username"
                    id="username"
                    value={credentials.username}
                    onChange={handleChange}
                    placeholder="e.g. admin"
                    className="w-full bg-black/40 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all outline-none"
                />
            </div>
            <div className="relative">
                <label htmlFor="password" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Password</label>
                <div className="relative">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        id="password"
                        value={credentials.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full bg-black/40 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all outline-none"
                    />
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 px-4 flex items-center text-gray-500 hover:text-cyan-400 transition-colors"
                    >
                        {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
};