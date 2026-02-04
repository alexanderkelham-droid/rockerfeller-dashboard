import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

// Column configuration with display names and editability
const COLUMNS = [
  { key: 'plant_name', label: 'Plant Name', editable: false, width: '180px' },
  { key: 'project_name', label: 'Project Name', editable: true, width: '150px' },
  { key: 'unit_name', label: 'Unit', editable: false, width: '100px' },
  { key: 'capacity_mw', label: 'Capacity (MW)', editable: false, width: '100px' },
  { key: 'country', label: 'Country', editable: false, width: '120px' },
  { key: 'operational_status', label: 'Status', editable: true, width: '120px', type: 'select', options: ['Operating', 'Retired', 'Mothballed', 'Under Construction', 'Planned'] },
  { key: 'start_year', label: 'Start Year', editable: false, width: '90px' },
  { key: 'planned_retirement_year', label: 'Planned Retirement', editable: true, width: '130px' },
  { key: 'actual_retirement_year', label: 'Actual Retirement', editable: true, width: '130px' },
  { key: 'transition_type', label: 'Transition Type', editable: true, width: '150px', type: 'select', options: ['', 'Refinance', 'Policy-driven retirement', 'Market-driven retirement', 'Conversion', 'Other'] },
  { key: 'financial_mechanism', label: 'Financial Mechanism', editable: true, width: '150px' },
  { key: 'lender_s_funder_s_involved', label: 'Lenders/Funders', editable: true, width: '150px' },
  { key: 'intelligence_on_transaction_status', label: 'Transaction Intelligence', editable: true, width: '200px' },
  { key: 'planned_post_retirement_status', label: 'Post-Retirement Status', editable: true, width: '180px' },
  { key: 'technical_assistance_provided_to_date', label: 'Technical Assistance', editable: true, width: '180px' },
  { key: 'information_status', label: 'Info Status', editable: true, width: '180px', type: 'select', options: ['We know of it, and have the information', 'We know of it, but info owned by others', 'Unknown'] },
  { key: 'information_owner', label: 'Info Owner', editable: true, width: '120px' },
  { key: 'source', label: 'Source', editable: true, width: '150px' },
  { key: 'last_updated', label: 'Last Updated', editable: false, width: '150px' },
];

const DataView = ({ userEmail }) => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'plant_name', direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState(
    COLUMNS.slice(0, 10).map(c => c.key) // Show first 10 columns by default
  );
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Drag-to-scroll functionality
  const tableContainerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e) => {
    if (!tableContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setScrollLeft(tableContainerRef.current.scrollLeft);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    tableContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Fetch data from Supabase
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: projects, error } = await supabase
        .from('project_specific_data')
        .select('*')
        .order('plant_name', { ascending: true });

      if (error) throw error;
      setData(projects || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle cell edit start
  const handleCellClick = (rowId, columnKey, currentValue) => {
    const column = COLUMNS.find(c => c.key === columnKey);
    if (!column?.editable) return;
    
    setEditingCell({ rowId, columnKey });
    setEditValue(currentValue || '');
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingCell) return;

    const { rowId, columnKey } = editingCell;
    const row = data.find(r => r.id === rowId);
    const oldValue = row?.[columnKey] || '';
    
    if (oldValue === editValue) {
      setEditingCell(null);
      return;
    }

    setSaving(true);
    try {
      // Update in Supabase
      const { error: updateError } = await supabase
        .from('project_specific_data')
        .update({ 
          [columnKey]: editValue,
          last_updated: new Date().toISOString()
        })
        .eq('id', rowId);

      if (updateError) throw updateError;

      // Log the change
      await supabase
        .from('project_logs')
        .insert({
          project_id: rowId,
          plant_name: row?.plant_name || '',
          field_changed: COLUMNS.find(c => c.key === columnKey)?.label || columnKey,
          old_value: oldValue,
          new_value: editValue,
          updated_by: userEmail || 'user',
        });

      // Update local state
      setData(prev => prev.map(r => 
        r.id === rowId 
          ? { ...r, [columnKey]: editValue, last_updated: new Date().toISOString() }
          : r
      ));

      setEditingCell(null);
      setEditValue('');
    } catch (err) {
      console.error('Error saving:', err);
      alert('Error saving: ' + err.message);
    }
    setSaving(false);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Handle sort
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Toggle column visibility
  const toggleColumn = (key) => {
    setVisibleColumns(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  // Filter and sort data
  const filteredData = data
    .filter(row => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        row.plant_name?.toLowerCase().includes(search) ||
        row.project_name?.toLowerCase().includes(search) ||
        row.country?.toLowerCase().includes(search) ||
        row.operational_status?.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      return aVal.toString().localeCompare(bVal.toString()) * direction;
    });

  // Export to CSV
  const handleExport = () => {
    const headers = visibleColumns.map(key => COLUMNS.find(c => c.key === key)?.label || key);
    const rows = filteredData.map(row => 
      visibleColumns.map(key => `"${(row[key] || '').toString().replace(/"/g, '""')}"`)
    );
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project_data_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading project data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
        <p className="text-red-600">Error loading data: {error}</p>
        <button 
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header / Toolbar */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search plants, projects, countries..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {filteredData.length} project{filteredData.length !== 1 ? 's' : ''}
            </span>
            
            {/* Column Picker */}
            <div className="relative">
              <button
                onClick={() => setShowColumnPicker(!showColumnPicker)}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Columns
              </button>
              
              {showColumnPicker && (
                <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-64 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b border-gray-100 sticky top-0 bg-white">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Show/Hide Columns</p>
                  </div>
                  <div className="p-2">
                    {COLUMNS.map(col => (
                      <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(col.key)}
                          onChange={() => toggleColumn(col.key)}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700">{col.label}</span>
                        {col.editable && <span className="text-xs text-emerald-600">✎</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleExport}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>

            <button
              onClick={fetchData}
              className="px-3 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 mt-2">
          💡 Click on editable cells (marked with ✎ in column picker) to edit. Changes are saved automatically to the database.
        </p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div 
          ref={tableContainerRef}
          className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
        <table className="w-full border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {COLUMNS.filter(col => visibleColumns.includes(col.key)).map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                  style={{ minWidth: col.width }}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.editable && <span className="text-emerald-600">✎</span>}
                    {sortConfig.key === col.key && (
                      <span className="text-emerald-600">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredData.map((row, rowIndex) => (
              <tr 
                key={row.id} 
                className={`hover:bg-emerald-50/30 transition-colors ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
              >
                {COLUMNS.filter(col => visibleColumns.includes(col.key)).map(col => {
                  const isEditing = editingCell?.rowId === row.id && editingCell?.columnKey === col.key;
                  const value = row[col.key] || '';
                  
                  return (
                    <td
                      key={col.key}
                      onClick={() => handleCellClick(row.id, col.key, value)}
                      className={`px-6 py-4 text-sm ${
                        col.editable 
                          ? 'cursor-pointer hover:bg-emerald-100/40' 
                          : ''
                      } ${isEditing ? 'bg-emerald-100' : ''}`}
                      style={{ minWidth: col.width }}
                    >
                      {isEditing ? (
                        col.type === 'select' ? (
                          <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="w-full px-2 py-1 border-2 border-emerald-500 rounded focus:outline-none text-sm"
                          >
                            {col.options?.map(opt => (
                              <option key={opt} value={opt}>{opt || '(None)'}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="w-full px-2 py-1 border-2 border-emerald-500 rounded focus:outline-none text-sm"
                          />
                        )
                      ) : (
                        <div className="flex items-center gap-1">
                          {col.key === 'operational_status' ? (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              value === 'Operating' ? 'bg-green-100 text-green-700 ring-1 ring-inset ring-green-600/20' :
                              value === 'Retired' ? 'bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-600/20' :
                              value === 'Mothballed' ? 'bg-yellow-100 text-yellow-700 ring-1 ring-inset ring-yellow-600/20' :
                              value === 'Under Construction' ? 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-600/20' :
                              value === 'Planned' ? 'bg-purple-100 text-purple-700 ring-1 ring-inset ring-purple-600/20' :
                              'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/20'
                            }`}>
                              {value || '-'}
                            </span>
                          ) : col.key === 'last_updated' && value ? (
                            <span className="text-gray-500 text-xs">
                              {new Date(value).toLocaleDateString('en-GB', { 
                                day: '2-digit', 
                                month: 'short', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          ) : col.key === 'source' && value ? (
                            <a 
                              href={value} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-emerald-600 hover:text-emerald-800 underline truncate max-w-[140px]"
                            >
                              {value}
                            </a>
                          ) : (
                            <span className={`${col.key === 'plant_name' ? 'font-semibold text-gray-900' : 'text-gray-700'} ${!value ? 'text-gray-400' : ''}`}>
                              {value || '-'}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {filteredData.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium">No projects found</p>
            {searchTerm && <p className="text-sm mt-2 text-gray-400">Try a different search term</p>}
          </div>
        )}
        </div>
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          Saving...
        </div>
      )}
    </div>
  );
};

export default DataView;