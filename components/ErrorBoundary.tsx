
import React from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, message: '' };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, message: error.message };
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black text-gray-200 flex items-center justify-center p-8">
                    <div className="max-w-lg w-full bg-gray-950 border border-red-800 rounded-lg p-8 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <h1 className="text-xl font-bold text-red-400 mb-2">Something went wrong</h1>
                        <p className="text-sm text-gray-400 mb-6 font-mono break-words">{this.state.message || 'An unexpected error occurred.'}</p>
                        <button
                            onClick={this.handleReload}
                            className="px-6 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-green-400 transition-colors"
                        >
                            Reload App
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
