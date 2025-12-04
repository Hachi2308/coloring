import React, { useEffect, useRef } from 'react';

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface LogConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
}

const LogConsole: React.FC<LogConsoleProps> = ({ logs, onClear }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when logs update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-white border border-pink-200 rounded-xl overflow-hidden shadow-lg animate-fade-in-up">
      <div className="flex items-center justify-between px-4 py-3 bg-pink-50 border-b border-pink-100">
        <h3 className="text-sm font-mono font-medium text-gray-600">System Logs</h3>
        <button 
          onClick={onClear}
          className="text-xs text-gray-400 hover:text-studio-accent transition-colors"
        >
          Clear Logs
        </button>
      </div>
      
      <div className="h-[500px] overflow-y-auto p-4 font-mono text-xs space-y-2 bg-white custom-scrollbar">
        {logs.length === 0 && (
            <div className="text-gray-400 italic text-center mt-20">No logs available</div>
        )}
        
        {logs.slice().reverse().map((log, idx) => (
          <div key={idx} className="flex space-x-3 border-b border-gray-50 pb-1 last:border-0">
            <span className="text-gray-400 flex-shrink-0 w-20">{log.timestamp}</span>
            <span className={`flex-1 break-all ${
              log.type === 'error' ? 'text-red-500' :
              log.type === 'success' ? 'text-green-600' :
              log.type === 'warning' ? 'text-orange-500' :
              'text-blue-500'
            }`}>
              {log.type === 'error' && '❌ '}
              {log.type === 'success' && '✅ '}
              {log.type === 'warning' && '⚠️ '}
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default LogConsole;