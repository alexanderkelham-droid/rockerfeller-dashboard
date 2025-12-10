import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const ImpactCalculator = () => {
  const [globalPlants, setGlobalPlants] = useState([]);
  const [selectedPlants, setSelectedPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredResults, setFilteredResults] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadGlobalDatabase();
  }, []);

  const loadGlobalDatabase = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/src/data/global_coal_plants.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      setGlobalPlants(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading global plants database:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredResults([]);
      return;
    }

    const filtered = globalPlants
      .filter(plant => {
        const plantName = (plant['Plant name'] || '').toLowerCase();
        const unitName = (plant['Unit name'] || '').toLowerCase();
        const country = (plant['Country/Area'] || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        
        return plantName.includes(search) || 
               unitName.includes(search) || 
               country.includes(search);
      })
      .slice(0, 50);

    setFilteredResults(filtered);
  }, [searchTerm, globalPlants]);

  const handleAddPlant = (plant) => {
    // Create editable plant object with all available data
    const plantData = {
      id: `${plant['GEM unit/phase ID'] || Date.now()}`,
      'GEM unit/phase ID': plant['GEM unit/phase ID'] || '',
      'GEM location ID': plant['GEM location ID'] || '',
      'Plant name': plant['Plant name'] || '',
      'Unit name': plant['Unit name'] || '',
      'Capacity (MW)': plant['Capacity (MW)'] || '',
      'Status': plant['Status'] || '',
      'Country/Area': plant['Country/Area'] || '',
      'Owner': plant['Owner'] || '',
      'Parent': plant['Parent'] || '',
      'Start year': plant['Start year'] || '',
      'Planned retirement': plant['Planned retirement'] || '',
      'Latitude': plant.Latitude || '',
      'Longitude': plant.Longitude || '',
      'Technology': plant['Technology'] || '',
      'Combustion technology': plant['Combustion technology'] || '',
      'Heat rate': plant['Heat rate'] || '',
      'Efficiency': plant['Efficiency'] || '',
    };
    
    setSelectedPlants([...selectedPlants, plantData]);
    setShowSearchModal(false);
    setSearchTerm('');
  };

  const handleRemovePlant = (plantId) => {
    setSelectedPlants(selectedPlants.filter(p => p.id !== plantId));
  };

  const handleCellDoubleClick = (plantId, field, currentValue) => {
    setEditingCell({ plantId, field });
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = () => {
    if (editingCell) {
      const updatedPlants = selectedPlants.map(plant => {
        if (plant.id === editingCell.plantId) {
          return {
            ...plant,
            [editingCell.field]: editValue
          };
        }
        return plant;
      });
      setSelectedPlants(updatedPlants);
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const isCellEditing = (plantId, field) => {
    return editingCell?.plantId === plantId && editingCell?.field === field;
  };

  const displayFields = [
    'Plant name',
    'Unit name',
    'Capacity (MW)',
    'Status',
    'Country/Area',
    'Owner',
    'Start year',
    'Planned retirement',
    'Technology',
    'Efficiency',
    'Heat rate'
  ];

  return (
    <div className="bg-white w-full h-full">
      <div className="px-6 py-4 border-b border-secondary-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Impact Calculator</h2>
            <p className="text-xs text-gray-500 mt-1">
              Add coal plants to analyze and calculate potential impact
            </p>
          </div>
          <button
            onClick={() => setShowSearchModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Coal Plant
          </button>
        </div>
      </div>

      {/* Selected Plants List */}
      <div className="p-6">
        {selectedPlants.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 text-lg mb-2">No plants added yet</p>
            <p className="text-gray-400 text-sm">Click "Add Coal Plant" to get started</p>
          </div>
        ) : (
          <div className="space-y-6">
            {selectedPlants.map((plant, plantIndex) => (
              <div key={plant.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                  <div>
                    <h3 className="font-semibold text-gray-800">{plant['Plant name']}</h3>
                    <p className="text-xs text-gray-500">{plant['Unit name']} • {plant['Country/Area']}</p>
                  </div>
                  <button
                    onClick={() => handleRemovePlant(plant.id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                    title="Remove plant"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="p-4">
                  <p className="text-xs text-gray-500 mb-3">Double-click any cell to edit</p>
                  <div className="grid grid-cols-2 gap-4">
                    {displayFields.map(field => (
                      <div key={field} className="border border-gray-200 rounded-md p-2 hover:bg-gray-50">
                        <label className="text-xs font-semibold text-gray-600 block mb-1">
                          {field}
                        </label>
                        {isCellEditing(plant.id, field) ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSaveEdit}
                            autoFocus
                            className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div
                            onDoubleClick={() => handleCellDoubleClick(plant.id, field, plant[field])}
                            className="text-sm text-gray-800 cursor-pointer min-h-[24px] px-2 py-1"
                          >
                            {plant[field] || <span className="text-gray-400 italic">N/A</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Search Global Coal Plants Database</h3>
              <button
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchTerm('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="px-6 py-4 border-b border-gray-200">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by plant name, unit name, or country..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {isLoading && (
                <p className="text-sm text-gray-500 mt-2">Loading database...</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {searchTerm && filteredResults.length === 0 && (
                <p className="text-gray-500 text-center py-8">No plants found</p>
              )}
              
              {!searchTerm && (
                <p className="text-gray-400 text-center py-8">Start typing to search...</p>
              )}
              
              <div className="space-y-2">
                {filteredResults.map((plant, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleAddPlant(plant)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{plant['Plant name']}</h4>
                        {plant['Unit name'] && (
                          <p className="text-sm text-gray-600 mt-1">Unit: {plant['Unit name']}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>📍 {plant['Country/Area']}</span>
                          <span>⚡ {plant['Capacity (MW)']} MW</span>
                          {plant['Status'] && (
                            <span className="px-2 py-0.5 bg-gray-100 rounded">
                              {plant['Status']}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImpactCalculator;
