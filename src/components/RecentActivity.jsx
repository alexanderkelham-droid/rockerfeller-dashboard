import React from 'react';

const RecentActivity = () => {
  const activities = [
    {
      action: "Project proposal submitted",
      client: "Acme Corporation",
      time: "2 hours ago",
      type: "success"
    },
    {
      action: "Client meeting scheduled",
      client: "TechStart Inc.",
      time: "4 hours ago", 
      type: "info"
    },
    {
      action: "Report delivery overdue",
      client: "Global Systems",
      time: "1 day ago",
      type: "warning"
    },
    {
      action: "Contract signed",
      client: "Innovation Labs",
      time: "2 days ago",
      type: "success"
    },
    {
      action: "Initial consultation completed",
      client: "Future Tech",
      time: "3 days ago",
      type: "info"
    }
  ];

  const getTypeStyles = (type) => {
    switch(type) {
      case 'success': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-secondary-100 text-secondary-800 border-secondary-200';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-secondary-200">
      <div className="px-6 py-4 border-b border-secondary-200">
        <h3 className="text-lg font-semibold text-secondary-800">Recent Activity</h3>
        <p className="text-sm text-secondary-600">Latest updates from your consulting projects</p>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeStyles(activity.type)}`}>
                {activity.type}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary-800">{activity.action}</p>
                <p className="text-sm text-secondary-600">{activity.client}</p>
                <p className="text-xs text-secondary-500 mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-secondary-200">
          <button className="text-sm text-primary-500 hover:text-primary-600 font-medium">
            View all activities →
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecentActivity;