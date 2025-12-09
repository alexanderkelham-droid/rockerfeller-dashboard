import React, { useState, useEffect } from 'react';

const PowerBIEmbed = () => {
  const [showDashboard, setShowDashboard] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  // Power BI Demo Configuration
  const powerBIConfig = {
    reportId: 'a262bb78-15a4-4576-80f5-16b984e0419e',
    embedUrl: 'https://app.powerbi.com/reportEmbed?reportId=a262bb78-15a4-4576-80f5-16b984e0419e&autoAuth=true&ctid=96e14e5a-57ac-48d7-851d-12f54eff5a60'
  };

  // Auto-load the dashboard when component mounts
  useEffect(() => {
    console.log('Auto-loading Power BI dashboard...');
    setShowDashboard(true);
  }, []);

  const handleLoadDashboard = () => {
    console.log('Loading Power BI dashboard...');
    setShowDashboard(true);
    setIframeError(false);
  };

  const handleIframeError = () => {
    console.error('Failed to load Power BI iframe');
    setIframeError(true);
  };

  const handleIframeLoad = () => {
    console.log('Power BI iframe loaded successfully');
  };

  return (
    <div className="bg-white border border-secondary-200 w-full">
      <div className="p-0">
        <div
          id="embedContainer"
          className="w-full h-[calc(100vh-180px)] min-h-[700px] bg-white"
        >
          {showDashboard ? (
            <>
              {iframeError ? (
                <div className="h-full flex items-center justify-center bg-red-50">
                  <div className="text-center">
                    <div className="text-4xl mb-4">❌</div>
                    <h4 className="text-lg font-medium text-red-700 mb-2">Failed to Load Dashboard</h4>
                    <p className="text-sm text-red-600 max-w-md mx-auto mb-4">
                      The Power BI dashboard could not be loaded. This might be due to cross-origin restrictions.
                    </p>
                    <div className="space-y-2">
                      <button 
                        onClick={handleLoadDashboard}
                        className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200 mr-2"
                      >
                        Retry
                      </button>
                      <a 
                        href={powerBIConfig.embedUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 inline-block"
                      >
                        Open in New Tab
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <iframe 
                  title="Power BI Dashboard" 
                  width="100%" 
                  height="100%" 
                  src={powerBIConfig.embedUrl}
                  frameBorder="0" 
                  allowFullScreen={true}
                  onError={handleIframeError}
                  onLoad={handleIframeLoad}
                  style={{ 
                    border: 'none',
                    background: 'white',
                    display: 'block'
                  }}
                />
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center bg-secondary-50">
              <div className="text-center">
                <div className="text-4xl mb-4">⏳</div>
                <h4 className="text-lg font-medium text-secondary-700 mb-2">Loading Dashboard...</h4>
                <p className="text-sm text-secondary-500 max-w-md mx-auto mb-4">
                  Your Power BI demo dashboard is loading automatically.
                </p>
                <button 
                  onClick={handleLoadDashboard}
                  className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors duration-200"
                >
                  Load Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PowerBIEmbed;