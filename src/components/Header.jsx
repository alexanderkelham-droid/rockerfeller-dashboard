import React from 'react';

const Header = ({ activeView, setActiveView, user, onLogout }) => {
  return (
    <header className="bg-white shadow-sm border-b border-secondary-200 h-16 fixed top-0 right-0 left-0 z-40">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center space-x-8">
          <div className="flex items-center">
            <img src="/cata-logo.png" alt="CATA Logo" className="h-12" />
          </div>
          
          {/* View Switcher */}
          <div className="flex space-x-1 bg-secondary-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                activeView === 'dashboard'
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-secondary-700 hover:text-secondary-900 hover:bg-secondary-200'
              }`}
            >
              World Map
            </button>
            <button
              onClick={() => setActiveView('data')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                activeView === 'data'
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-secondary-700 hover:text-secondary-900 hover:bg-secondary-200'
              }`}
            >
              Data
            </button>
            <button
              onClick={() => setActiveView('impact')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                activeView === 'impact'
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-secondary-700 hover:text-secondary-900 hover:bg-secondary-200'
              }`}
            >
              Impact Calculator
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {user?.initials || 'U'}
            </div>
            <span className="text-sm font-medium text-secondary-700">{user?.name || 'User'}</span>
            <button
              onClick={onLogout}
              className="ml-2 px-3 py-1 text-sm text-secondary-600 hover:text-secondary-800 hover:bg-secondary-100 rounded-md transition-colors duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;