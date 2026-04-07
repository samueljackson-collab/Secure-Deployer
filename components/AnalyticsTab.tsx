import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { RefreshCw, BarChart2, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

export const AnalyticsTab: React.FC = () => {
    const { state } = useAppContext();
    const [chartType, setChartType] = useState<'bar' | 'pie' | 'line'>('bar');
    const [refreshKey, setRefreshKey] = useState(0);

    const logs = state.runner.logs;

    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    const logStats = useMemo(() => {
        const stats = { INFO: 0, WARNING: 0, ERROR: 0, SUCCESS: 0 };
        logs.forEach(log => {
            if (stats[log.level] !== undefined) {
                stats[log.level]++;
            }
        });
        return [
            { name: 'INFO', value: stats.INFO, color: '#3b82f6' },
            { name: 'WARNING', value: stats.WARNING, color: '#eab308' },
            { name: 'ERROR', value: stats.ERROR, color: '#ef4444' },
            { name: 'SUCCESS', value: stats.SUCCESS, color: '#22c55e' },
        ];
    }, [logs, refreshKey]);

    const timeSeriesData = useMemo(() => {
        const data: Record<string, { time: string, INFO: number, WARNING: number, ERROR: number, SUCCESS: number }> = {};
        logs.forEach(log => {
            const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (!data[time]) {
                data[time] = { time, INFO: 0, WARNING: 0, ERROR: 0, SUCCESS: 0 };
            }
            data[time][log.level]++;
        });
        return Object.values(data);
    }, [logs, refreshKey]);

    return (
        <div className="bg-gray-950 p-6 rounded-lg shadow-lg border border-gray-800">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-[#39FF14] flex items-center gap-2">
                    <Activity className="w-6 h-6" />
                    Trends and Analytics
                </h2>
                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                        <button
                            onClick={() => setChartType('bar')}
                            className={`p-2 rounded ${chartType === 'bar' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="Bar Chart"
                        >
                            <BarChart2 size={18} />
                        </button>
                        <button
                            onClick={() => setChartType('pie')}
                            className={`p-2 rounded ${chartType === 'pie' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="Pie Chart"
                        >
                            <PieChartIcon size={18} />
                        </button>
                        <button
                            onClick={() => setChartType('line')}
                            className={`p-2 rounded ${chartType === 'line' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="Line Chart"
                        >
                            <Activity size={18} />
                        </button>
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2 border border-gray-600 transition-colors"
                    >
                        <RefreshCw size={16} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-black/50 p-4 rounded-lg border border-gray-800 h-96">
                    <h3 className="text-sm font-bold text-gray-300 mb-4 text-center">Log Distribution</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        {chartType === 'bar' ? (
                            <BarChart data={logStats}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="name" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                                <Bar dataKey="value">
                                    {logStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        ) : chartType === 'pie' ? (
                            <PieChart>
                                <Pie
                                    data={logStats}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => (percent ?? 0) > 0 ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ''}
                                    outerRadius={120}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {logStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                                <Legend />
                            </PieChart>
                        ) : (
                            <LineChart data={timeSeriesData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="time" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                                <Legend />
                                <Line type="monotone" dataKey="INFO" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="WARNING" stroke="#eab308" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="ERROR" stroke="#ef4444" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="SUCCESS" stroke="#22c55e" strokeWidth={2} dot={false} />
                            </LineChart>
                        )}
                    </ResponsiveContainer>
                </div>

                <div className="bg-black/50 p-4 rounded-lg border border-gray-800 h-96 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-300 mb-4">Recent Logs</h3>
                    <div className="flex-grow overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {logs.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center mt-10">No logs available.</p>
                        ) : (
                            [...logs].reverse().slice(0, 50).map((log, i) => (
                                <div key={i} className="text-xs p-2 rounded bg-gray-900 border border-gray-800">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`font-bold ${
                                            log.level === 'ERROR' ? 'text-red-500' :
                                            log.level === 'WARNING' ? 'text-yellow-500' :
                                            log.level === 'SUCCESS' ? 'text-green-500' : 'text-blue-400'
                                        }`}>[{log.level}]</span>
                                        <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-gray-300 break-words">{log.message}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
