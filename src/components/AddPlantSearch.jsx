import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// Helper to normalize global_coal_plants from Supabase
const normalizeGlobalPlant = (row) => ({
  ...row,
  'GEM unit/phase ID': row.gem_unit_phase_id,
  'GEM location ID': row.gem_location_id,
  'Country/Area': row.country_area,
  'Wiki URL': row.wiki_url,
  'Plant name': row.plant_name,
  'Unit name': row.unit_name,
  'Plant name (other)': row.plant_name_other,
  'Plant name (local)': row.plant_name_local,
  'Owner': row.owner,
  'Parent': row.parent,
  'Capacity (MW)': row.capacity_mw,
  'Status': row.status,
  'Start year': row.start_year,
  'Retired year': row.retired_year,
  'Planned retirement': row.planned_retirement,
  'Combustion technology': row.combustion_technology,
  'Coal type': row.coal_type,
  'Coal source': row.coal_source,
  'Location': row.location,
  'Latitude': row.latitude,
  'Longitude': row.longitude,
  'Subregion': row.subregion,
  'Region': row.region,
  'Plant age (years)': row.plant_age_years,
  'Capacity factor': row.capacity_factor,
  'Annual CO2 (million tonnes / annum)': row.annual_co2_million_tonnes_annum,
  'Remaining plant lifetime (years)': row.remaining_plant_lifetime_years,
  'Lifetime CO2 (million tonnes)': row.lifetime_co2_million_tonnes,
});

const AddPlantSearch = ({ onAddPlant, onToggleGlobal, showingGlobal, onFilteredPlantsChange, impactResults = [] }) => {
  const [globalPlants, setGlobalPlants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filteredPlants, setFilteredPlants] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [capacityRange, setCapacityRange] = useState([0, 5000]);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [minCapacity, setMinCapacity] = useState(0);
  const [maxCapacity, setMaxCapacity] = useState(5000);

  useEffect(() => {
    loadGlobalDatabase();
  }, []);

  const loadGlobalDatabase = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('global_coal_plants')
        .select('*');
      if (error) {
        throw error;
      }
      // Normalize column names for compatibility
      const normalizedData = (data || []).map(normalizeGlobalPlant);
      // Calculate actual min/max capacity
      const capacities = normalizedData
        .map(p => parseFloat(p['Capacity (MW)']) || 0)
        .filter(c => c > 0);
      const actualMin = Math.min(...capacities);
      const actualMax = Math.max(...capacities);
      setMinCapacity(actualMin);
      setMaxCapacity(actualMax);
      setCapacityRange([actualMin, actualMax]);
      setGlobalPlants(normalizedData);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading global plants database:', error);
      setIsLoading(false);
    }
  };

  // Effect to notify parent when filters change (for map markers)
  useEffect(() => {
    console.log('Filters changed:', { 
      selectedCountries, 
      capacityRange, 
      selectedStatus,
      totalPlants: globalPlants.length,
      impactResultsCount: impactResults.length
    });
    
    // Debug: Check what columns are available in impact results
    if (impactResults.length > 0) {
      console.log('Impact results columns:', Object.keys(impactResults[0]));
      console.log('First impact result sample:', impactResults[0]);
    }
    
    // Create a Set of plant names that have impact results (normalize to lowercase)
    const impactPlantNames = new Set(
      impactResults
        .map(result => result['Unique plant name']?.toLowerCase()?.trim())
        .filter(Boolean)
    );
    
    console.log(`Filtering to ${impactPlantNames.size} unique plants with impact results`);
    console.log('Sample impact plant names:', Array.from(impactPlantNames).slice(0, 5));
    
    // Apply filters to all global plants
    const filtered = globalPlants.filter(plant => {
      // Must have coordinates
      if (!plant.Latitude || !plant.Longitude) return false;
      
      // Debug: Log first plant for comparison
      if (globalPlants.indexOf(plant) === 0 && impactResults.length > 0) {
        console.log('First global plant sample:', plant);
        console.log('Plant name from global:', plant['Plant name']);
      }
      
      // Only include plants that have impact results (match by plant name)
      const plantName = plant['Plant name']?.toLowerCase()?.trim();
      if (impactResults.length > 0 && (!plantName || !impactPlantNames.has(plantName))) return false;
      
      // Capacity filter
      const capacity = parseFloat(plant['Capacity (MW)']) || 0;
      if (capacity < capacityRange[0] || capacity > capacityRange[1]) return false;
      
      // Country filter
      if (selectedCountries.length > 0 && !selectedCountries.includes(plant['Country/Area'])) {
        return false;
      }
      
      // Status filter
      if (selectedStatus !== 'all' && plant['Status']?.toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }
      
      return true;
    });
    
    console.log('Filtered plants before dedup:', filtered.length);
    
    // Deduplicate by plant name and coordinates, sum capacities and collect unit details
    const uniquePlants = new Map();
    const plantUnitsMap = new Map(); // Store unit details for each plant
    
    filtered.forEach(plant => {
      const plantKey = `${plant['Plant name']}_${plant.Latitude}_${plant.Longitude}`;
      
      // Store unit details
      if (!plantUnitsMap.has(plantKey)) {
        plantUnitsMap.set(plantKey, []);
      }
      plantUnitsMap.get(plantKey).push({
        unitName: plant['Unit name'],
        capacity: parseFloat(plant['Capacity (MW)']) || 0
      });
      
      if (!uniquePlants.has(plantKey)) {
        uniquePlants.set(plantKey, plant);
      } else {
        const existing = uniquePlants.get(plantKey);
        const currentCapacity = parseFloat(plant['Capacity (MW)']) || 0;
        const existingCapacity = parseFloat(existing['Capacity (MW)']) || 0;
        uniquePlants.set(plantKey, {
          ...existing,
          'Capacity (MW)': existingCapacity + currentCapacity,
        });
      }
    });
    
    // Transform to standard format
    const processedPlants = Array.from(uniquePlants.values()).map(plant => {
      const plantKey = `${plant['Plant name']}_${plant.Latitude}_${plant.Longitude}`;
      return {
        'No': `GLOBAL-${plant['GEM location ID'] || Math.random()}`,
        'Plant Name': plant['Plant name'] || 'Unknown',
        'Unit name': 'Combined Units',
        'Capacity (MW)': plant['Capacity (MW)'] || 0,
        'Country': plant['Country/Area'] || '',
        'Operational Status': plant['Status'] || 'Operating',
        'Start year': plant['Start year'] || '',
        'Planned retirement year': plant['Planned retirement'] || '',
        'Location (coordinates)': `${plant.Latitude}, ${plant.Longitude}`,
        'Operator': plant['Owner'] || '',
        'Owner': plant['Owner'] || '',
        'Parent': plant['Parent'] || '',
        'Transition type': '',
        'Financial mechanism': '',
        'Information Status': 'Global Database',
        'Email extension': '',
        latitude: parseFloat(plant.Latitude),
        longitude: parseFloat(plant.Longitude),
        isGlobal: true,
        unitDetails: plantUnitsMap.get(plantKey) || [], // Include unit details!
      };
    });
    
    // Notify parent component
    if (onFilteredPlantsChange) {
      onFilteredPlantsChange(processedPlants);
    }
  }, [globalPlants, capacityRange, selectedCountries, selectedStatus, onFilteredPlantsChange, impactResults]);

  // Separate effect for search results display
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPlants([]);
      return;
    }

    const filtered = globalPlants
      .filter(plant => {
        const plantName = (plant['Plant name'] || '').toLowerCase();
        const country = (plant['Country/Area'] || '').toLowerCase();
        const unitName = (plant['Unit name'] || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        
        // Text search
        const matchesSearch = plantName.includes(search) || 
                             country.includes(search) || 
                             unitName.includes(search);
        
        if (!matchesSearch) return false;
        
        // Capacity filter
        const capacity = parseFloat(plant['Capacity (MW)']) || 0;
        if (capacity < capacityRange[0] || capacity > capacityRange[1]) return false;
        
        // Country filter
        if (selectedCountries.length > 0 && !selectedCountries.includes(plant['Country/Area'])) {
          return false;
        }
        
        // Status filter
        if (selectedStatus !== 'all' && plant['Status']?.toLowerCase() !== selectedStatus.toLowerCase()) {
          return false;
        }
        
        return true;
      })
      .slice(0, 50); // Limit to 50 results for performance

    setFilteredPlants(filtered);
  }, [searchTerm, globalPlants, capacityRange, selectedCountries, selectedStatus]);
  
  // Get unique countries from database
  const uniqueCountries = [...new Set(globalPlants.map(p => p['Country/Area']).filter(Boolean))].sort();
  
  const handleCountryToggle = (country) => {
    setSelectedCountries(prev => 
      prev.includes(country) 
        ? prev.filter(c => c !== country)
        : [...prev, country]
    );
  };
  
  const clearFilters = () => {
    setCapacityRange([minCapacity, maxCapacity]);
    setSelectedCountries([]);
    setSelectedStatus('all');
  };

  const handleAddPlant = (plant) => {
    // Check if plant has coordinates
    if (!plant.Latitude || !plant.Longitude) {
      alert('This plant does not have coordinate data and cannot be added to the map.');
      return;
    }

    // Transform global plant data to match your existing data structure
    const transformedPlant = {
      'No': `NEW-${Date.now()}`,
      'Plant Name': plant['Plant name'] || 'Unknown',
      'Unit name': plant['Unit name'] || '',
      'Capacity (MW)': plant['Capacity (MW)'] || 0,
      'Country': plant['Country/Area'] || '',
      'Operational Status': plant['Status'] || 'Operating',
      'Start year': plant['Start year'] || '',
      'Planned retirement year': plant['Planned retirement'] || '',
      'Location (coordinates)': `${plant.Latitude}, ${plant.Longitude}`,
      'Operator': plant['Owner'] || '',
      'Owner': plant['Owner'] || '',
      'Parent': plant['Parent'] || '',
      'Transition type': '',
      'Financial mechanism': '',
      'Information Status': 'Added from Global Database',
      'Email extension': '', // Will be assigned based on user's email
      latitude: parseFloat(plant.Latitude),
      longitude: parseFloat(plant.Longitude),
      isNewlyAdded: true, // Flag to identify newly added plants
    };

    onAddPlant(transformedPlant);
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div className="absolute top-6 left-6 z-20">
      <div className="bg-white rounded-lg shadow-lg p-4 w-96">
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(e.target.value.trim() !== '');
              }}
              placeholder="Search global coal plants database..."
              className="w-full px-4 py-2 border border-secondary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            {isLoading && (
              <div className="absolute right-3 top-2.5 text-secondary-400">
                ⏳
              </div>
            )}
          </div>
          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-md transition-colors ${
              showFilters 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title="Filters"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            {/* Capacity Range Slider */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-2 block">
                Capacity Range (MW)
              </label>
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="number"
                  min={minCapacity}
                  max={capacityRange[1]}
                  value={Math.round(capacityRange[0])}
                  onChange={(e) => setCapacityRange([parseFloat(e.target.value), capacityRange[1]])}
                  className="w-16 px-1 py-1 text-xs border border-gray-300 rounded-md"
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="number"
                  min={capacityRange[0]}
                  max={maxCapacity}
                  value={Math.round(capacityRange[1])}
                  onChange={(e) => setCapacityRange([capacityRange[0], parseFloat(e.target.value)])}
                  className="w-16 px-1 py-1 text-xs border border-gray-300 rounded-md"
                />
              </div>
              <div className="relative pt-1">
                <input
                  type="range"
                  min={minCapacity}
                  max={maxCapacity}
                  value={capacityRange[0]}
                  onChange={(e) => setCapacityRange([parseFloat(e.target.value), Math.max(parseFloat(e.target.value), capacityRange[1])])}
                  className="absolute w-full h-2 bg-transparent appearance-none cursor-pointer pointer-events-auto z-20"
                  style={{ background: 'transparent' }}
                />
                <input
                  type="range"
                  min={minCapacity}
                  max={maxCapacity}
                  value={capacityRange[1]}
                  onChange={(e) => setCapacityRange([Math.min(capacityRange[0], parseFloat(e.target.value)), parseFloat(e.target.value)])}
                  className="absolute w-full h-2 bg-transparent appearance-none cursor-pointer pointer-events-auto z-10"
                  style={{ background: 'transparent' }}
                />
                <div className="w-full h-2 bg-gray-200 rounded-lg"></div>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-2 block">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="operating">Operating</option>
                <option value="retired">Retired</option>
                <option value="construction">Construction</option>
                <option value="planned">Planned</option>
              </select>
            </div>

            {/* Country Filter */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-2 block">
                Countries ({selectedCountries.length} selected)
              </label>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-2 bg-white space-y-1">
                {uniqueCountries.map(country => (
                  <label key={country} className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedCountries.includes(country)}
                      onChange={() => handleCountryToggle(country)}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="flex-1">{country}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Clear Filters Button */}
            <button
              onClick={clearFilters}
              className="w-full px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Toggle Global Plants Button */}
        <button
          onClick={onToggleGlobal}
          className={`w-full mt-3 px-4 py-2 rounded-lg shadow-md font-medium transition-all flex items-center justify-center gap-2 ${
            showingGlobal
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          title={showingGlobal ? 'Hide all global plants' : 'Show all global plants'}
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            {showingGlobal ? (
              // Eye slash (hidden)
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" 
              />
            ) : (
              // Eye (visible)
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" 
              />
            )}
          </svg>
          {showingGlobal ? 'Hide Global Plants' : 'Show Global Plants'}
        </button>
        
        {/* Plant count display */}
        {impactResults.length > 0 && (
          <div className="mt-2 px-3 py-2 bg-cyan-50 border border-cyan-100 rounded-lg">
            <p className="text-xs text-gray-600 text-center">
              <span className="font-semibold text-cyan-700">{
                new Set(impactResults.map(r => r['Unique plant name']?.toLowerCase()?.trim()).filter(Boolean)).size
              }</span> plants with impact data available
            </p>
          </div>
        )}

        {isOpen && filteredPlants.length > 0 && (
          <div className="mt-2 max-h-96 overflow-y-auto border border-secondary-200 rounded-md">
            {filteredPlants.map((plant, index) => (
              <div
                key={index}
                className="p-3 hover:bg-secondary-50 border-b border-secondary-100 last:border-b-0"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-secondary-800">
                      {plant['Plant name']}
                    </h4>
                    {plant['Unit name'] && (
                      <p className="text-xs text-secondary-600 mt-0.5">
                        Unit: {plant['Unit name']}
                      </p>
                    )}
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-xs text-secondary-500">
                        📍 {plant['Country/Area']}
                      </span>
                      <span className="text-xs text-secondary-500">
                        ⚡ {plant['Capacity (MW)']} MW
                      </span>
                      {plant['Status'] && (
                        <span className="text-xs text-secondary-500">
                          {plant['Status']}
                        </span>
                      )}
                    </div>
                    {(!plant.Latitude || !plant.Longitude) && (
                      <p className="text-xs text-red-500 mt-1">
                        ⚠️ No coordinates available
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAddPlant(plant)}
                    disabled={!plant.Latitude || !plant.Longitude}
                    className={`ml-3 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                      plant.Latitude && plant.Longitude
                        ? 'bg-primary-500 hover:bg-primary-600 cursor-pointer'
                        : 'bg-secondary-300 cursor-not-allowed'
                    }`}
                    title={plant.Latitude && plant.Longitude ? 'Add to map' : 'No coordinates available'}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isOpen && searchTerm && filteredPlants.length === 0 && !isLoading && (
          <div className="mt-2 p-4 text-center text-sm text-secondary-500 border border-secondary-200 rounded-md">
            No plants found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
};

export default AddPlantSearch;
