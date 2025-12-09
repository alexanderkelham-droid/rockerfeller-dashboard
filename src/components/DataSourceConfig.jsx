import React, { useState, useEffect } from 'react';

const DataSourceConfig = () => {
  const [dataSource, setDataSource] = useState('mock');
  const [apiConfig, setApiConfig] = useState({
    endpoint: '',
    apiKey: '',
    powerBIWorkspace: '',
    powerBIDataset: ''
  });

  const dataSources = {
    mock: 'Mock Data (Demo)',
    api: 'REST API Endpoint',
    powerbi: 'Power BI REST API',
    database: 'Direct Database Connection'
  };

  return (
    <div className="bg-white border border-secondary-200 w-full">
      <div className="px-6 py-4 border-b border-secondary-200">
        <h3 className="text-lg font-semibold text-secondary-800">Data Source Configuration</h3>
        <p className="text-sm text-secondary-600">Configure how to access the data feeding your Power BI dashboard</p>
      </div>
      
      <div className="p-6">
        {/* Data Source Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-secondary-700 mb-3">
            Data Source Type:
          </label>
          <select
            value={dataSource}
            onChange={(e) => setDataSource(e.target.value)}
            className="block w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          >
            {Object.entries(dataSources).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Configuration Forms */}
        {dataSource === 'api' && (
          <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-800">REST API Configuration</h4>
            <input
              type="text"
              placeholder="API Endpoint (e.g., https://api.yourcompany.com/data)"
              value={apiConfig.endpoint}
              onChange={(e) => setApiConfig({...apiConfig, endpoint: e.target.value})}
              className="block w-full px-3 py-2 border border-blue-300 rounded-md"
            />
            <input
              type="password"
              placeholder="API Key"
              value={apiConfig.apiKey}
              onChange={(e) => setApiConfig({...apiConfig, apiKey: e.target.value})}
              className="block w-full px-3 py-2 border border-blue-300 rounded-md"
            />
          </div>
        )}

        {dataSource === 'powerbi' && (
          <div className="space-y-4 p-4 bg-purple-50 border border-purple-200 rounded-md">
            <h4 className="font-medium text-purple-800">Power BI REST API Configuration</h4>
            <input
              type="text"
              placeholder="Power BI Workspace ID"
              value={apiConfig.powerBIWorkspace}
              onChange={(e) => setApiConfig({...apiConfig, powerBIWorkspace: e.target.value})}
              className="block w-full px-3 py-2 border border-purple-300 rounded-md"
            />
            <input
              type="text"
              placeholder="Dataset ID"
              value={apiConfig.powerBIDataset}
              onChange={(e) => setApiConfig({...apiConfig, powerBIDataset: e.target.value})}
              className="block w-full px-3 py-2 border border-purple-300 rounded-md"
            />
            <div className="text-xs text-purple-700">
              <p><strong>Note:</strong> Requires Power BI Pro license and proper API permissions.</p>
              <p>You'll also need to implement OAuth2 authentication for Power BI access.</p>
            </div>
          </div>
        )}

        {dataSource === 'database' && (
          <div className="space-y-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <h4 className="font-medium text-green-800">Database Connection</h4>
            <p className="text-sm text-green-700">
              For direct database access, you'll need a backend API to handle database connections securely.
              Never expose database credentials directly in a React app.
            </p>
            <div className="text-xs text-green-600">
              <p><strong>Recommended:</strong> Create a Node.js/Express API that connects to your database and serves data to both Power BI and React.</p>
            </div>
          </div>
        )}

        {dataSource === 'mock' && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
            <h4 className="font-medium text-gray-800">Mock Data (Current)</h4>
            <p className="text-sm text-gray-600">
              Using sample data for demonstration. In production, configure one of the real data sources above.
            </p>
          </div>
        )}

        {/* Connection Test */}
        <div className="mt-6">
          <button className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors duration-200 mr-4">
            Test Connection
          </button>
          <button className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors duration-200">
            Save Configuration
          </button>
        </div>

        {/* Implementation Examples */}
        <div className="mt-8 space-y-4">
          <h4 className="font-medium text-secondary-800">Implementation Examples</h4>
          
          <div className="p-4 bg-gray-100 border-l-4 border-blue-500 rounded">
            <h5 className="font-medium text-gray-800 mb-2">Option 1: Same Database as Power BI</h5>
            <pre className="text-xs text-gray-600 overflow-x-auto">
{`// Backend API endpoint
app.get('/api/sales', async (req, res) => {
  const data = await db.query('SELECT * FROM sales_data');
  res.json(data);
});

// React component
const fetchData = async () => {
  const response = await fetch('/api/sales');
  return response.json();
};`}
            </pre>
          </div>

          <div className="p-4 bg-gray-100 border-l-4 border-purple-500 rounded">
            <h5 className="font-medium text-gray-800 mb-2">Option 2: Power BI REST API</h5>
            <pre className="text-xs text-gray-600 overflow-x-auto">
{`// Requires OAuth2 token
const fetchPowerBIData = async () => {
  const response = await fetch(
    'https://api.powerbi.com/v1.0/myorg/groups/{workspaceId}/datasets/{datasetId}/executeQueries',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        queries: [{ query: "EVALUATE Sales" }]
      })
    }
  );
  return response.json();
};`}
            </pre>
          </div>

          <div className="p-4 bg-gray-100 border-l-4 border-green-500 rounded">
            <h5 className="font-medium text-gray-800 mb-2">Option 3: Shared API</h5>
            <pre className="text-xs text-gray-600 overflow-x-auto">
{`// Create an API that both Power BI and React use
// Power BI connects to: https://your-api.com/powerbi/sales
// React connects to: https://your-api.com/react/sales

const fetchSharedData = async () => {
  const response = await fetch('https://your-api.com/react/sales', {
    headers: { 'Authorization': 'Bearer your-token' }
  });
  return response.json();
};`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataSourceConfig;