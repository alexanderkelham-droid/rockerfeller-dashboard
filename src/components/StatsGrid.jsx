import React from 'react';

const DashboardCard = ({ title, value, change, icon, color = "primary" }) => {
  const colorClasses = {
    primary: "bg-primary-500 text-white",
    green: "bg-green-500 text-white",
    yellow: "bg-yellow-500 text-white",
    red: "bg-red-500 text-white"
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-secondary-600">{title}</p>
          <p className="text-2xl font-bold text-secondary-800 mt-1">{value}</p>
          {change && (
            <p className={`text-sm mt-1 ${change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
              {change}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center text-xl`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const StatsGrid = () => {
  const stats = [
    {
      title: "Total Revenue",
      value: "$1,234,567",
      change: "+12.5%",
      icon: "💰",
      color: "green"
    },
    {
      title: "Active Projects",
      value: "24",
      change: "+3 this month",
      icon: "📊",
      color: "primary"
    },
    {
      title: "Client Satisfaction",
      value: "94%",
      change: "+2.1%",
      icon: "⭐",
      color: "yellow"
    },
    {
      title: "Pending Tasks",
      value: "12",
      change: "-4 from last week",
      icon: "📋",
      color: "red"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
      {stats.map((stat, index) => (
        <DashboardCard
          key={index}
          title={stat.title}
          value={stat.value}
          change={stat.change}
          icon={stat.icon}
          color={stat.color}
        />
      ))}
    </div>
  );
};

export default StatsGrid;