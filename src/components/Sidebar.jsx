import React from 'react';

const Sidebar = () => {
  const menuItems = [
    { name: 'Dashboard', icon: '📊', active: true },
    { name: 'Analytics', icon: '📈', active: false },
    { name: 'Reports', icon: '📋', active: false },
    { name: 'Power BI', icon: '💹', active: false },
    { name: 'Settings', icon: '⚙️', active: false },
  ];

  return (
    <div className="w-64 bg-secondary-900 text-white h-screen fixed left-0 top-0">
      <div className="p-6">
        <h2 className="text-xl font-bold text-primary-400">Consulting Dashboard</h2>
      </div>
      
      <nav className="mt-8">
        {menuItems.map((item, index) => (
          <a
            key={index}
            href="#"
            className={`flex items-center px-6 py-3 text-sm font-medium transition-colors duration-200 hover:bg-secondary-800 hover:text-primary-400 ${
              item.active 
                ? 'bg-secondary-800 text-primary-400 border-r-2 border-primary-400' 
                : 'text-secondary-300'
            }`}
          >
            <span className="mr-3 text-lg">{item.icon}</span>
            {item.name}
          </a>
        ))}
      </nav>
      
      <div className="absolute bottom-0 left-0 w-full p-6">
        <div className="text-xs text-secondary-500">
          © 2024 Consulting Project
        </div>
      </div>
    </div>
  );
};

export default Sidebar;