import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import DataSourceConfig from './DataSourceConfig';

const DataView = ({ userEmail }) => {
  const [activeTab, setActiveTab] = useState('data'); // 'data' or 'config'
  const [csvData, setCsvData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCell, setEditingCell] = useState(null); // { rowIndex, columnName }
  const [editValue, setEditValue] = useState('');
  const [showAllColumns, setShowAllColumns] = useState(false);

  useEffect(() => {
    // Load and parse the CSV file
    fetch('/src/data/data.csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setCsvData(results.data);
            // Show all data (row-level security temporarily disabled)
            setFilteredData(results.data);
            setIsLoading(false);
          },
          error: (error) => {
            setError(error.message);
            setIsLoading(false);
          }
        });
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [userEmail]);

  const filterDataByEmail = (data, email) => {
    if (!email) {
      setFilteredData(data);
      return;
    }

    // Extract email domain from user's email (e.g., user@example.com -> @example.com)
    const emailDomain = '@' + email.split('@')[1];

    // Filter data to only show rows where Email extension matches user's domain
    const filtered = data.filter(row => {
      const rowEmailExt = row['Email extension'];
      if (!rowEmailExt) return false;
      
      // Clean up the email extension (remove quotes and whitespace)
      const cleanEmailExt = rowEmailExt.replace(/['"]/g, '').trim();
      
      return cleanEmailExt.toLowerCase() === emailDomain.toLowerCase();
    });

    setFilteredData(filtered);
  };

  if (activeTab === 'config') {
    return <DataSourceConfig />;
  }

  // Display loading, error, or empty state
  if (isLoading) {
    return (
      <div className="bg-white border border-secondary-200 w-full p-6">
        <p className="text-gray-500">Loading power plant data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-secondary-200 w-full p-6">
        <p className="text-red-500">Error loading data: {error}</p>
      </div>
    );
  }

  if (!csvData || csvData.length === 0) {
    return (
      <div className="bg-white border border-secondary-200 w-full p-6">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // Use filtered data for display
  const displayData = filteredData;

  if (displayData.length === 0) {
    return (
      <div className="bg-white border border-secondary-200 w-full p-6">
        <p className="text-gray-500">No data available for your organization. Contact your administrator for access.</p>
      </div>
    );
  }

  // Get column names from the first row
  const columns = Object.keys(displayData[0]);
  
  // Select key columns to display (adjust based on what's most important)
  const displayColumns = ['No', 'Plant Name', 'Unit name', 'Capacity (MW)', 'Country', 'Operational Status', 'Start year', 'Planned retirement year', 'Transition type', 'Financial mechanism'];
  const availableDisplayColumns = showAllColumns ? columns : displayColumns.filter(col => columns.includes(col));

  // Handle double-click to edit
  const handleCellDoubleClick = (rowIndex, columnName, currentValue) => {
    setEditingCell({ rowIndex, columnName });
    setEditValue(currentValue || '');
  };

  // Handle saving the edit
  const handleSaveEdit = () => {
    if (editingCell) {
      const updatedData = [...filteredData];
      updatedData[editingCell.rowIndex][editingCell.columnName] = editValue;
      setFilteredData(updatedData);
      setEditingCell(null);
      setEditValue('');
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Handle key press in edit mode
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Check if a cell is being edited
  const isCellEditing = (rowIndex, columnName) => {
    return editingCell?.rowIndex === rowIndex && editingCell?.columnName === columnName;
  };

  return (
    <div className="bg-white border border-secondary-200 w-full">
      <div className="px-6 py-4 border-b border-secondary-200">
        <div className="flex items-center justify-between">
          <div className="text-xs text-secondary-600">
            <span className="font-semibold">Double-click any cell to edit</span> | {displayData.length} records
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('data')}
              className={`px-3 py-1 text-sm font-medium rounded ${
                activeTab === 'data' 
                ? 'bg-primary-500 text-white' 
                : 'bg-secondary-200 text-secondary-700 hover:bg-secondary-300'
              }`}
            >
              View Data
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-3 py-1 text-sm font-medium rounded ${
                activeTab === 'config' 
                ? 'bg-primary-500 text-white' 
                : 'bg-secondary-200 text-secondary-700 hover:bg-secondary-300'
              }`}
            >
              Configure Source
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-6">

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-secondary-200">
            <thead className="bg-secondary-50">
              <tr>
                {availableDisplayColumns.map((col) => (
                  <th
                    key={col}
                    className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-secondary-200">
              {displayData.map((row, index) => (
                <tr key={row.No || index} className={index % 2 === 0 ? 'bg-white' : 'bg-secondary-50'}>
                  {availableDisplayColumns.map((col, cellIndex) => (
                    <td 
                      key={cellIndex} 
                      className="px-6 py-4 text-sm text-secondary-900 cursor-pointer hover:bg-blue-50 transition-colors"
                      onDoubleClick={() => handleCellDoubleClick(index, col, row[col])}
                    >
                      {isCellEditing(index, col) ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSaveEdit}
                            autoFocus
                            className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ) : (
                        <>
                          {cellIndex === 0 ? (
                            <span className="font-medium">{row[col]}</span>
                          ) : (
                            <span className="whitespace-normal">{row[col] || '-'}</span>
                          )}
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Data Actions */}
        <div className="mt-6 flex space-x-4">
          <button className="px-4 py-2 bg-secondary-200 text-secondary-700 rounded-md hover:bg-secondary-300 transition-colors duration-200">
            Export CSV
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-secondary-200 text-secondary-700 rounded-md hover:bg-secondary-300 transition-colors duration-200"
          >
            Refresh Data
          </button>
          <button 
            onClick={() => setShowAllColumns(!showAllColumns)}
            className="px-4 py-2 bg-secondary-200 text-secondary-700 rounded-md hover:bg-secondary-300 transition-colors duration-200"
          >
            {showAllColumns ? 'Show Key Columns' : 'View All Columns'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataView;