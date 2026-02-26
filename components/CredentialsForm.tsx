
import React from 'react';
import type { Credentials } from '../types';

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
        <form className="space-y-3">
            <div className="flex items-center">
                <input
                    id="rememberMe"
                    type="checkbox"
                    className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#39FF14] focus:ring-2 focus:ring-[#39FF14] focus:ring-offset-2 focus:ring-offset-gray-950 cursor-pointer"
                />
                <label htmlFor="rememberMe" className="ml-3 text-sm text-gray-300 cursor-pointer font-bold">
                    Remember Me
                </label>
            </div>
            <div>
                <label htmlFor="username" className="sr-only">Username</label>
                <input
                    type="text"
                    name="username"
                    id="username"
                    value={credentials.username}
                    onChange={handleChange}
                    placeholder="Username"
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:ring-[#39FF14] focus:border-[#39FF14]"
                />
            </div>
            <div className="relative">
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    id="password"
                    value={credentials.password}
                    onChange={handleChange}
                    placeholder="Password"
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:ring-[#39FF14] focus:border-[#39FF14]"
                />
                <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-300"
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
        </form>
    );
};