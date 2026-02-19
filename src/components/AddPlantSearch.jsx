import React, { useState, useEffect, useMemo } from 'react';
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
  'Captive': row.captive,
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
  const [minCapacity, setMinCapacity] = useState(0);
  const [maxCapacity, setMaxCapacity] = useState(5000);

  // New filter states
  const [selectedCombustionTech, setSelectedCombustionTech] = useState([]);
  const [selectedCoalTypes, setSelectedCoalTypes] = useState([]);
  const [selectedSubregions, setSelectedSubregions] = useState([]);
  const [captiveFilter, setCaptiveFilter] = useState('all'); // 'all', 'yes', 'no'
  const [maxRemainingLifetime, setMaxRemainingLifetime] = useState(null); // null = no filter

  useEffect(() => {
    loadGlobalDatabase();
  }, []);

  const loadGlobalDatabase = async () => {
    setIsLoading(true);
    try {
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('global_coal_plants')
          .select('*')
          .eq('status', 'operating')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = allData.concat(data);
          page++;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Normalize column names for compatibility
      const normalizedData = (allData || []).map(normalizeGlobalPlant);
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

  // Derive unique filter options from loaded data
  const uniqueCountries = useMemo(() =>
    [...new Set(globalPlants.map(p => p['Country/Area']).filter(Boolean))].sort(), [globalPlants]);

  const uniqueCombustionTechs = useMemo(() =>
    [...new Set(globalPlants.map(p => p['Combustion technology']).filter(Boolean))].sort(), [globalPlants]);

  const uniqueCoalTypes = useMemo(() =>
    [...new Set(globalPlants.map(p => p['Coal type']).filter(Boolean))].sort(), [globalPlants]);

  const uniqueSubregions = useMemo(() =>
    [...new Set(globalPlants.map(p => p['Subregion']).filter(Boolean))].sort(), [globalPlants]);

  // Core filter function — applied to raw (unit-level) plants
  const applyFilters = (plants) => {
    return plants.filter(plant => {
      if (!plant.Latitude || !plant.Longitude) return false;

      const capacity = parseFloat(plant['Capacity (MW)']) || 0;
      if (capacity < capacityRange[0] || capacity > capacityRange[1]) return false;

      if (selectedCountries.length > 0 && !selectedCountries.includes(plant['Country/Area'])) return false;

      if (selectedCombustionTech.length > 0 && !selectedCombustionTech.includes(plant['Combustion technology'])) return false;

      if (selectedCoalTypes.length > 0 && !selectedCoalTypes.includes(plant['Coal type'])) return false;

      if (selectedSubregions.length > 0 && !selectedSubregions.includes(plant['Subregion'])) return false;

      if (captiveFilter !== 'all') {
        const isCaptive = (plant['Captive'] || '').toLowerCase();
        if (captiveFilter === 'yes' && isCaptive !== 'yes') return false;
        if (captiveFilter === 'no' && isCaptive === 'yes') return false;
      }

      if (maxRemainingLifetime !== null) {
        const lifetime = parseFloat(plant['Remaining plant lifetime (years)']);
        if (isNaN(lifetime) || lifetime > maxRemainingLifetime) return false;
      }

      return true;
    });
  };

  // Deduplicate filtered plants into unique plant-level records for the map
  const deduplicateForMap = (filtered) => {
    const uniquePlants = new Map();
    const plantUnitsMap = new Map();

    filtered.forEach(plant => {
      const plantKey = `${plant['Plant name']}_${plant.Latitude}_${plant.Longitude}`;
      if (!plantUnitsMap.has(plantKey)) plantUnitsMap.set(plantKey, []);
      plantUnitsMap.get(plantKey).push({
        unitName: plant['Unit name'],
        capacity: parseFloat(plant['Capacity (MW)']) || 0,
      });
      if (!uniquePlants.has(plantKey)) {
        uniquePlants.set(plantKey, plant);
      } else {
        const existing = uniquePlants.get(plantKey);
        uniquePlants.set(plantKey, {
          ...existing,
          'Capacity (MW)': (parseFloat(existing['Capacity (MW)']) || 0) + (parseFloat(plant['Capacity (MW)']) || 0),
        });
      }
    });

    return Array.from(uniquePlants.values()).map(plant => {
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
        unitDetails: plantUnitsMap.get(plantKey) || [],
      };
    });
  };

  // Effect to notify parent when filters change (for map markers)
  useEffect(() => {
    const filtered = applyFilters(globalPlants);
    const processedPlants = deduplicateForMap(filtered);
    if (onFilteredPlantsChange) {
      onFilteredPlantsChange(processedPlants);
    }
  }, [globalPlants, capacityRange, selectedCountries, selectedCombustionTech, selectedCoalTypes,
    selectedSubregions, captiveFilter, maxRemainingLifetime, onFilteredPlantsChange, minCapacity, maxCapacity]);

  // Live filter summary: count unique plants and total capacity
  const filterSummary = useMemo(() => {
    const filtered = applyFilters(globalPlants);
    const deduplicated = deduplicateForMap(filtered);
    const totalCapacity = deduplicated.reduce((sum, p) => sum + (parseFloat(p['Capacity (MW)']) || 0), 0);
    return { count: deduplicated.length, totalCapacity: Math.round(totalCapacity) };
  }, [globalPlants, capacityRange, selectedCountries, selectedCombustionTech, selectedCoalTypes,
    selectedSubregions, captiveFilter, maxRemainingLifetime, minCapacity, maxCapacity]);

  // Separate effect for search results display
  useEffect(() => {
    if (searchTerm.trim() === '') {
      const filtered = applyFilters(globalPlants);
      const uniquePlants = new Map();
      filtered.forEach(plant => {
        const plantKey = `${plant['Plant name']}_${plant.Latitude}_${plant.Longitude}`;
        if (!uniquePlants.has(plantKey)) uniquePlants.set(plantKey, plant);
      });
      setFilteredPlants(Array.from(uniquePlants.values()));
      return;
    }

    const filtered = globalPlants
      .filter(plant => {
        const plantName = (plant['Plant name'] || '').toLowerCase();
        const country = (plant['Country/Area'] || '').toLowerCase();
        const unitName = (plant['Unit name'] || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        if (!plantName.includes(search) && !country.includes(search) && !unitName.includes(search)) return false;
        return applyFilters([plant]).length > 0;
      })
      .slice(0, 50);
    setFilteredPlants(filtered);
  }, [searchTerm, globalPlants, capacityRange, selectedCountries, selectedCombustionTech, selectedCoalTypes,
    selectedSubregions, captiveFilter, maxRemainingLifetime, minCapacity, maxCapacity]);

  const handleCountryToggle = (country) => {
    setSelectedCountries(prev => prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]);
  };
  const handleCombustionTechToggle = (tech) => {
    setSelectedCombustionTech(prev => prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]);
  };
  const handleCoalTypeToggle = (type) => {
    setSelectedCoalTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };
  const handleSubregionToggle = (sub) => {
    setSelectedSubregions(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]);
  };

  const clearFilters = () => {
    setCapacityRange([minCapacity, maxCapacity]);
    setSelectedCountries([]);
    setSelectedCombustionTech([]);
    setSelectedCoalTypes([]);
    setSelectedSubregions([]);
    setCaptiveFilter('all');
    setMaxRemainingLifetime(null);
  };

  const hasActiveFilters =
    capacityRange[0] !== minCapacity ||
    capacityRange[1] !== maxCapacity ||
    selectedCountries.length > 0 ||
    selectedCombustionTech.length > 0 ||
    selectedCoalTypes.length > 0 ||
    selectedSubregions.length > 0 ||
    captiveFilter !== 'all' ||
    maxRemainingLifetime !== null;

  const handleAddPlant = (plant) => {
    if (!plant.Latitude || !plant.Longitude) {
      alert('This plant does not have coordinate data and cannot be added to the map.');
      return;
    }
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
      'Email extension': '',
      latitude: parseFloat(plant.Latitude),
      longitude: parseFloat(plant.Longitude),
      isNewlyAdded: true,
    };
    onAddPlant(transformedPlant);
    setSearchTerm('');
    setIsOpen(false);
  };

  // Reusable multi-select checkbox list
  const CheckboxList = ({ items, selected, onToggle, maxHeight = '120px' }) => (
    <div style={{ maxHeight }} className="overflow-y-auto border border-gray-200 rounded-md p-2 bg-white space-y-0.5">
      {items.map(item => (
        <label key={item} className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
          <input
            type="checkbox"
            checked={selected.includes(item)}
            onChange={() => onToggle(item)}
            className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
          />
          <span className="flex-1 truncate">{item}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="absolute top-6 left-6 z-50">
      <div className="bg-white rounded-lg shadow-lg p-4 w-96 max-h-[85vh] overflow-y-auto">
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
              <div className="absolute right-3 top-2.5 text-secondary-400">⏳</div>
            )}
          </div>
          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative px-3 py-2 rounded-md transition-colors ${showFilters
              ? 'bg-blue-500 text-white'
              : hasActiveFilters
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            title="Filters"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {hasActiveFilters && !showFilters && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">

            {/* Live summary */}
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
              <div className="text-xs text-blue-800">
                <span className="font-bold text-sm">{filterSummary.count.toLocaleString()}</span> plants
                {' · '}
                <span className="font-bold text-sm">{filterSummary.totalCapacity.toLocaleString()}</span> MW total
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Capacity Range */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-2 block">Capacity Range (MW)</label>
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="number"
                  min={minCapacity}
                  max={capacityRange[1]}
                  value={Math.round(capacityRange[0])}
                  onChange={(e) => setCapacityRange([parseFloat(e.target.value), capacityRange[1]])}
                  className="w-20 px-1 py-1 text-xs border border-gray-300 rounded-md"
                />
                <span className="text-xs text-gray-500">to</span>
                <input
                  type="number"
                  min={capacityRange[0]}
                  max={maxCapacity}
                  value={Math.round(capacityRange[1])}
                  onChange={(e) => setCapacityRange([capacityRange[0], parseFloat(e.target.value)])}
                  className="w-20 px-1 py-1 text-xs border border-gray-300 rounded-md"
                />
              </div>
            </div>

            {/* Remaining Plant Lifetime */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Max Remaining Lifetime (years)
                {maxRemainingLifetime !== null && (
                  <span className="ml-1 text-blue-600">≤ {maxRemainingLifetime} yrs</span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={5}
                  value={maxRemainingLifetime ?? 60}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setMaxRemainingLifetime(val === 60 ? null : val);
                  }}
                  className="flex-1 h-2 accent-blue-500"
                />
                <span className="text-xs text-gray-500 w-12 text-right">
                  {maxRemainingLifetime === null ? 'Any' : `≤ ${maxRemainingLifetime}y`}
                </span>
              </div>
            </div>

            {/* Combustion Technology */}
            {uniqueCombustionTechs.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Combustion Technology
                  {selectedCombustionTech.length > 0 && (
                    <span className="ml-1 text-blue-600">({selectedCombustionTech.length} selected)</span>
                  )}
                </label>
                <CheckboxList
                  items={uniqueCombustionTechs}
                  selected={selectedCombustionTech}
                  onToggle={handleCombustionTechToggle}
                  maxHeight="100px"
                />
              </div>
            )}

            {/* Coal Type */}
            {uniqueCoalTypes.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Coal Type
                  {selectedCoalTypes.length > 0 && (
                    <span className="ml-1 text-blue-600">({selectedCoalTypes.length} selected)</span>
                  )}
                </label>
                <CheckboxList
                  items={uniqueCoalTypes}
                  selected={selectedCoalTypes}
                  onToggle={handleCoalTypeToggle}
                  maxHeight="100px"
                />
              </div>
            )}

            {/* Subregion */}
            {uniqueSubregions.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Subregion
                  {selectedSubregions.length > 0 && (
                    <span className="ml-1 text-blue-600">({selectedSubregions.length} selected)</span>
                  )}
                </label>
                <CheckboxList
                  items={uniqueSubregions}
                  selected={selectedSubregions}
                  onToggle={handleSubregionToggle}
                  maxHeight="120px"
                />
              </div>
            )}

            {/* Captive */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Captive Plant</label>
              <div className="flex gap-2">
                {['all', 'yes', 'no'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setCaptiveFilter(opt)}
                    className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors ${captiveFilter === opt
                      ? 'bg-blue-500 text-white'
                      : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    {opt === 'all' ? 'All' : opt === 'yes' ? 'Captive only' : 'Non-captive'}
                  </button>
                ))}
              </div>
            </div>

            {/* Country */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Countries
                {selectedCountries.length > 0 && (
                  <span className="ml-1 text-blue-600">({selectedCountries.length} selected)</span>
                )}
              </label>
              <CheckboxList
                items={uniqueCountries}
                selected={selectedCountries}
                onToggle={handleCountryToggle}
                maxHeight="140px"
              />
            </div>

          </div>
        )}

        {/* Toggle Global Plants Button */}
        <button
          onClick={onToggleGlobal}
          className={`w-full mt-3 px-4 py-2 rounded-lg shadow-md font-medium transition-all flex items-center justify-center gap-2 ${showingGlobal
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
          title={showingGlobal ? 'Hide all global plants' : 'Show all global plants'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {showingGlobal ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            )}
          </svg>
          {showingGlobal ? 'Hide Global Plants' : 'Show Global Plants'}
        </button>

        {isOpen && filteredPlants.length > 0 && (
          <div className="mt-2 max-h-96 overflow-y-auto border border-secondary-200 rounded-md">
            {filteredPlants.map((plant, index) => (
              <div key={index} className="p-3 hover:bg-secondary-50 border-b border-secondary-100 last:border-b-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-secondary-800">{plant['Plant name']}</h4>
                    {plant['Unit name'] && (
                      <p className="text-xs text-secondary-600 mt-0.5">Unit: {plant['Unit name']}</p>
                    )}
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-xs text-secondary-500">📍 {plant['Country/Area']}</span>
                      <span className="text-xs text-secondary-500">⚡ {plant['Capacity (MW)']} MW</span>
                      {plant['Status'] && (
                        <span className="text-xs text-secondary-500">{plant['Status']}</span>
                      )}
                    </div>
                    {(!plant.Latitude || !plant.Longitude) && (
                      <p className="text-xs text-red-500 mt-1">⚠️ No coordinates available</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAddPlant(plant)}
                    disabled={!plant.Latitude || !plant.Longitude}
                    className={`ml-3 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-lg ${plant.Latitude && plant.Longitude
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
