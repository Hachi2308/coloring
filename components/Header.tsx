import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="w-full py-3 border-b border-pink-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[98%] mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-pink-300 to-studio-accent rounded-md flex items-center justify-center shadow-lg shadow-pink-200">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-800 leading-none">
              Trung <span className="text-studio-accent">Coloring Studio</span>
            </h1>
            <p className="text-[10px] text-pink-400 leading-none mt-0.5">Professional Book Creator</p>
          </div>
        </div>
        <div className="hidden md:block">
           <span className="px-2 py-0.5 bg-pink-50 border border-pink-100 rounded text-[10px] font-medium text-pink-400">
             v3.0.0 (Pastel Edition)
           </span>
        </div>
      </div>
    </header>
  );
};

export default Header;