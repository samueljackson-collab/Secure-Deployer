
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
        <form className="space-y-3">
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
            <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                    type="password"
                    name="password"
                    id="password"
                    value={credentials.password}
                    onChange={handleChange}
                    placeholder="Password"
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:ring-[#39FF14] focus:border-[#39FF14]"
                />
            </div>
        </form>
    );
};