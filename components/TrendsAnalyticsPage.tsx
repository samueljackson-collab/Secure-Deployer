import React from 'react';

export const TrendsAnalyticsPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h6" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-cyan-400">Trends &amp; Analytics</h2>
            <p className="text-sm text-slate-400">
              Deployment analytics are summarized locally with no external telemetry.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Devices Imaged', value: '0' },
              { label: 'Compliance Rate', value: '0%' },
              { label: 'Average Scan Time', value: '0m' },
            ].map(metric => (
              <div key={metric.label} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-slate-400">{metric.label}</p>
                <p className="text-2xl font-bold text-cyan-400 mt-2">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Trends Overview</h3>
            <p className="text-sm text-slate-300">
              Trends will populate as deployments run. Metrics remain on-device only and are never transmitted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
