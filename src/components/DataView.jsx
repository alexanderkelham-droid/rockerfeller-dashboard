import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

// Column configuration for global coal plants
const COLUMNS = [
  { key: 'plant_name', label: 'Plant Name', width: '200px' },
  { key: 'unit_name', label: 'Unit', width: '100px' },
  { key: 'country_area', label: 'Country', width: '150px' },
  { key: 'capacity_mw', label: 'Capacity (MW)', width: '120px' },
  { key: 'status', label: 'Status', width: '120px' },
  { key: 'owner', label: 'Owner', width: '200px' },
  { key: 'parent', label: 'Parent Company', width: '200px' },
  { key: 'start_year', label: 'Start Year', width: '100px' },
  { key: 'planned_retirement', label: 'Planned Retirement', width: '150px' },
  { key: 'combustion_technology', label: 'Combustion Tech', width: '150px' },
  { key: 'coal_type', label: 'Coal Type', width: '150px' },
  { key: 'region', label: 'Region', width: '150px' },
  { key: 'subregion', label: 'Subregion', width: '150px' },
  { key: 'latitude', label: 'Latitude', width: '100px' },
  { key: 'longitude', label: 'Longitude', width: '100px' },
];

const normalizeGlobalPlant = (row) => ({
  ...row,
  'Country/Area': row.country_area,
  'Plant name': row.plant_name,
  'Unit name': row.unit_name,
  'Capacity (MW)': row.capacity_mw,
  'Status': row.status,
  'Start year': row.start_year,
  'Planned retirement': row.planned_retirement,
  'Combustion technology': row.combustion_technology,
  'Coal type': row.coal_type,
  'Subregion': row.subregion,
  'Region': row.region,
  'Captive': row.captive,
  'Remaining plant lifetime (years)': row.remaining_plant_lifetime_years,
  'Latitude': row.latitude,
  'Longitude': row.longitude,
});

const DataView = () => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'plant_name', direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState(COLUMNS.map(c => c.key));
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // Filter states
  const [showFilters, setShowFilters] = useState(true);
  const [capacityRange, setCapacityRange] = useState([0, 5000]);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [minCapacity, setMinCapacity] = useState(0);
  const [maxCapacity, setMaxCapacity] = useState(5000);
  const [selectedCombustionTech, setSelectedCombustionTech] = useState([]);
  const [selectedCoalTypes, setSelectedCoalTypes] = useState([]);
  const [selectedSubregions, setSelectedSubregions] = useState([]);
  const [captiveFilter, setCaptiveFilter] = useState('all');
  const [maxRemainingLifetime, setMaxRemainingLifetime] = useState(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('global_coal_plants')
          .select('*')
          .eq('status', 'operating')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (batch && batch.length > 0) {
          allData = allData.concat(batch);
          page++;
          hasMore = batch.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const normalized = allData.map(normalizeGlobalPlant);
      const capacities = normalized.map(p => parseFloat(p['Capacity (MW)']) || 0).filter(c => c > 0);
      const actualMin = Math.min(...capacities);
      const actualMax = Math.max(...capacities);

      setMinCapacity(actualMin);
      setMaxCapacity(actualMax);
      setCapacityRange([actualMin, actualMax]);
      setData(normalized);
    } catch (err) {
      console.error('Error fetching global coal plant data:', err);
      setError(err.message);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive unique filter options
  const uniqueCountries = useMemo(() => [...new Set(data.map(p => p['Country/Area']).filter(Boolean))].sort(), [data]);
  const uniqueCombustionTechs = useMemo(() => [...new Set(data.map(p => p['Combustion technology']).filter(Boolean))].sort(), [data]);
  const uniqueCoalTypes = useMemo(() => [...new Set(data.map(p => p['Coal type']).filter(Boolean))].sort(), [data]);
  const uniqueSubregions = useMemo(() => [...new Set(data.map(p => p['Subregion']).filter(Boolean))].sort(), [data]);

  // Apply filters
  const filteredData = useMemo(() => {
    return data.filter(plant => {
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

      // Search term
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        return COLUMNS.some(col => String(plant[col.key] || '').toLowerCase().includes(lowerSearch));
      }

      return true;
    });
  }, [data, capacityRange, selectedCountries, selectedCombustionTech, selectedCoalTypes, selectedSubregions, captiveFilter, maxRemainingLifetime, searchTerm]);

  // Apply sorting
  const processedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      // Map the sort key to the normalized data key if different
      // But here we used snake_case for sort keys in COLUMNS and mapped them.
      // Wait, COLUMNS uses snake_case keys (e.g. 'plant_name'), but normalizeGlobalPlant uses readable keys (e.g. 'Plant name').
      // I need to map the sort key back to the readable key or normalized key.
      // Let's check COLUMNS vs normalized keys.
      // COLUMNS: plant_name, unit_name, country_area, capacity_mw, status...
      // Normalized: 'Plant name', 'Unit name', 'Country/Area', 'Capacity (MW)', 'Status'...

      // I'll create a mapping helper or just update COLUMNS to use the normalized keys directly!
      // Updating COLUMNS is cleaner. But let's check what I used in sort logic.

      // Let's map COLUMNS to the keys I actually put in `normalizeGlobalPlant`.
      const keyMap = {
        'plant_name': 'Plant name',
        'unit_name': 'Unit name',
        'country_area': 'Country/Area',
        'capacity_mw': 'Capacity (MW)',
        'status': 'Status',
        'owner': 'Owner',
        'parent': 'Parent',
        'start_year': 'Start year',
        'planned_retirement': 'Planned retirement',
        'combustion_technology': 'Combustion technology',
        'coal_type': 'Coal type',
        'region': 'Region',
        'subregion': 'Subregion',
        'latitude': 'Latitude',
        'longitude': 'Longitude',
      };

      const sortKey = keyMap[sortConfig.key] || sortConfig.key;
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === bVal) return 0;

      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      const aStr = String(aVal || '').toLowerCase();
      const bStr = String(bVal || '').toLowerCase();
      return sortConfig.direction === 'asc' ? (aStr < bStr ? -1 : 1) : (aStr > bStr ? -1 : 1);
    });
  }, [filteredData, sortConfig]);

  // Helpers for filters
  const CheckboxList = ({ items, selected, onToggle, maxHeight = '150px' }) => (
    <div style={{ maxHeight }} className="overflow-y-auto border border-gray-200 rounded-md p-2 bg-white space-y-0.5">
      {items.map(item => (
        <label key={item} className="flex items-center space-x-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
          <input
            type="checkbox"
            checked={selected.includes(item)}
            onChange={() => onToggle(item)}
            className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
          />
          <span className="flex-1 truncate text-gray-700">{item}</span>
        </label>
      ))}
    </div>
  );

  const clearFilters = () => {
    setCapacityRange([minCapacity, maxCapacity]);
    setSelectedCountries([]);
    setSelectedCombustionTech([]);
    setSelectedCoalTypes([]);
    setSelectedSubregions([]);
    setCaptiveFilter('all');
    setMaxRemainingLifetime(null);
    setSearchTerm('');
  };

  const handleExport = () => {
    const keyMap = {
      'plant_name': 'Plant name',
      'unit_name': 'Unit name',
      'country_area': 'Country/Area',
      'capacity_mw': 'Capacity (MW)',
      'status': 'Status',
      'owner': 'Owner',
      'parent': 'Parent',
      'start_year': 'Start year',
      'planned_retirement': 'Planned retirement',
      'combustion_technology': 'Combustion technology',
      'coal_type': 'Coal type',
      'region': 'Region',
      'subregion': 'Subregion',
      'latitude': 'Latitude',
      'longitude': 'Longitude',
    };

    const headers = visibleColumns.map(key => COLUMNS.find(c => c.key === key)?.label || key).join(',');
    const rows = processedData.map(row =>
      visibleColumns.map(key => {
        const val = row[keyMap[key] || key];
        const strVal = String(val === null || val === undefined ? '' : val);
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      }).join(',')
    ).join('\n');

    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `global_coal_plants_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const paginatedData = processedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const totalPages = Math.ceil(processedData.length / rowsPerPage);

  if (isLoading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (error) return <div className="p-8 text-center text-red-500">Error loading data: {error}</div>;

  return (
    <div className="flex h-full bg-secondary-50 overflow-hidden">
      {/* Sidebar Filters */}
      <div className={`flex-shrink-0 bg-white border-r border-secondary-200 transition-all duration-300 flex flex-col ${showFilters ? 'w-80' : 'w-0 overflow-hidden'}`}>
        <div className="p-4 border-b border-secondary-200 bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Filters</h2>
          <button onClick={clearFilters} className="text-xs text-blue-600 hover:text-blue-800 font-medium underline">Clear all</button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          {/* Capacity Range */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Capacity Range (MW)</label>
            <div className="flex items-center gap-2 mb-1">
              <input type="number" min={minCapacity} max={capacityRange[1]} value={Math.round(capacityRange[0])} onChange={(e) => setCapacityRange([parseFloat(e.target.value), capacityRange[1]])} className="w-20 px-1 py-1 text-xs border border-gray-300 rounded-md" />
              <span className="text-xs text-gray-500">to</span>
              <input type="number" min={capacityRange[0]} max={maxCapacity} value={Math.round(capacityRange[1])} onChange={(e) => setCapacityRange([capacityRange[0], parseFloat(e.target.value)])} className="w-20 px-1 py-1 text-xs border border-gray-300 rounded-md" />
            </div>
          </div>

          {/* Remaining Plant Lifetime */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Max Remaining Lifetime (years)</label>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={60} step={5} value={maxRemainingLifetime ?? 60} onChange={(e) => { const val = parseInt(e.target.value); setMaxRemainingLifetime(val === 60 ? null : val); }} className="flex-1 h-2 accent-blue-500" />
              <span className="text-xs text-gray-500 w-12 text-right">{maxRemainingLifetime === null ? 'Any' : `<= ${maxRemainingLifetime}y`}</span>
            </div>
          </div>

          {/* Combustion Tech */}
          {uniqueCombustionTechs.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Combustion Technology</label>
              <CheckboxList items={uniqueCombustionTechs} selected={selectedCombustionTech} onToggle={(t) => setSelectedCombustionTech(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} />
            </div>
          )}

          {/* Coal Type */}
          {uniqueCoalTypes.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Coal Type</label>
              <CheckboxList items={uniqueCoalTypes} selected={selectedCoalTypes} onToggle={(t) => setSelectedCoalTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} />
            </div>
          )}

          {/* Subregion */}
          {uniqueSubregions.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Subregion</label>
              <CheckboxList items={uniqueSubregions} selected={selectedSubregions} onToggle={(t) => setSelectedSubregions(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} />
            </div>
          )}

          {/* Captive */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Captive Plant</label>
            <div className="flex gap-2">
              {['all', 'yes', 'no'].map(opt => (
                <button key={opt} onClick={() => setCaptiveFilter(opt)} className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors ${captiveFilter === opt ? 'bg-blue-500 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  {opt === 'all' ? 'All' : opt === 'yes' ? 'Captive only' : 'Non-captive'}
                </button>
              ))}
            </div>
          </div>

          {/* Country */}
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Countries</label>
            <CheckboxList items={uniqueCountries} selected={selectedCountries} onToggle={(c) => setSelectedCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 pb-2">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setShowFilters(!showFilters)} className="px-3 py-2 bg-white border border-secondary-300 rounded-lg hover:bg-secondary-50 text-secondary-700 font-medium flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              <div>
                <h1 className="text-2xl font-bold text-secondary-900">Global Coal Plant Database</h1>
                <p className="text-secondary-500 text-sm">{processedData.length.toLocaleString()} plants found</p>
              </div>
            </div>
            <div className="flex space-x-4">
              <div className="relative">
                <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-10 pr-4 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-64" />
                <svg className="w-5 h-5 text-secondary-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <button onClick={handleExport} className="flex items-center px-4 py-2 bg-white border border-secondary-300 rounded-lg hover:bg-secondary-50 text-secondary-700 font-medium">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 px-6 pb-6 overflow-hidden flex flex-col">
          <div className="bg-white rounded-lg shadow border border-secondary-200 overflow-hidden flex flex-col flex-1">
            <div className="overflow-auto flex-1">
              <table className="min-w-full divide-y divide-secondary-200">
                <thead className="bg-secondary-50 sticky top-0 z-10">
                  <tr>
                    {visibleColumns.map(key => {
                      const column = COLUMNS.find(c => c.key === key);
                      return (
                        <th key={key} style={{ width: column.width, minWidth: column.width }} className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider cursor-pointer hover:bg-secondary-100" onClick={() => setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                          <div className="flex items-center space-x-1">
                            <span>{column.label}</span>
                            {sortConfig.key === key && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-secondary-200">
                  {paginatedData.map((row, idx) => {
                    // Need to map consistent keys from normalized data
                    const keyMap = {
                      'plant_name': 'Plant name',
                      'unit_name': 'Unit name',
                      'country_area': 'Country/Area',
                      'capacity_mw': 'Capacity (MW)',
                      'status': 'Status',
                      'owner': 'Owner',
                      'parent': 'Parent',
                      'start_year': 'Start year',
                      'planned_retirement': 'Planned retirement',
                      'combustion_technology': 'Combustion technology',
                      'coal_type': 'Coal type',
                      'region': 'Region',
                      'subregion': 'Subregion',
                      'latitude': 'Latitude',
                      'longitude': 'Longitude',
                    };
                    return (
                      <tr key={`${row['GEM location ID']}-${idx}`} className="hover:bg-secondary-50">
                        {visibleColumns.map(key => (
                          <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900 truncate max-w-xs" title={row[keyMap[key] || key]}>
                            {row[keyMap[key] || key]}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {paginatedData.length === 0 && <tr><td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-secondary-500">No plants found matching your search.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-white border-t border-secondary-200 px-4 py-3 flex items-center justify-between sm:px-6 flex-shrink-0">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <p className="text-sm text-secondary-700">Showing <span className="font-medium">{Math.min((currentPage - 1) * rowsPerPage + 1, processedData.length)}</span> to <span className="font-medium">{Math.min(currentPage * rowsPerPage, processedData.length)}</span> of <span className="font-medium">{processedData.length}</span> results</p>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-secondary-300 bg-white text-sm font-medium ${currentPage === 1 ? 'text-secondary-300 cursor-not-allowed' : 'text-secondary-500 hover:bg-secondary-50'}`}>←</button>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-secondary-300 bg-white text-sm font-medium ${currentPage === totalPages ? 'text-secondary-300 cursor-not-allowed' : 'text-secondary-500 hover:bg-secondary-50'}`}>→</button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataView;