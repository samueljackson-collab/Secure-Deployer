
import React from 'react';
import type { Credentials } from '../types';

interface CredentialsFormProps {
    credentials: Credentials;
    setCredentials: React.Dispatch<React.SetStateAction<Credentials>>;
}

export const CredentialsForm: React.FC<CredentialsFormProps> = ({ credentials, setCredentials }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCredentials(prev => ({ ...prev, [name]: value }));
    };

    return (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()} autoComplete="off">
            <div>
                <label htmlFor="username" className="sr-only">Username</label>
                <input
                    type="text"
                    name="username"
                    id="username"
                    value={credentials.username}
                    onChange={handleChange}
                    placeholder="Username"
                    autoComplete="off"
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-400 focus:ring-cyan-500 focus:border-cyan-500"
                />
            </div>
            <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                    type="password"
                    name="password"
                    id="password"
                    value={credentials.password}
                    onChange={handleChange}
                    placeholder="Password"
                    autoComplete="new-password"
                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-400 focus:ring-cyan-500 focus:border-cyan-500"
                />
            </div>
        </form>
    );
};
