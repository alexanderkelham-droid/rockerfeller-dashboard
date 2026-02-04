import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// Field configuration for the new project form
const PROJECT_FIELDS = [
  { key: 'project_name', label: 'Project Name', type: 'text', required: true },
  { key: 'operational_status', label: 'Operational Status', type: 'select', options: ['Operating', 'Retired', 'Mothballed', 'Under Construction', 'Planned'] },
  { key: 'planned_retirement_year', label: 'Planned Retirement Year', type: 'text' },
  { key: 'transition_type', label: 'Transition Type', type: 'select', options: ['', 'Refinance', 'Policy-driven retirement', 'Market-driven retirement', 'Conversion', 'Other'] },
  { key: 'financial_mechanism', label: 'Financial Mechanism', type: 'text' },
  { key: 'lenders_funders_involved', label: 'Lenders/Funders Involved', type: 'text' },
  { key: 'planned_post_retirement_status', label: 'Planned Post-Retirement Status', type: 'textarea' },
  { key: 'intelligence_on_transaction_status', label: 'Transaction Intelligence', type: 'textarea' },
  { key: 'technical_assistance_provided_to_date', label: 'Technical Assistance', type: 'textarea' },
  { key: 'information_status', label: 'Information Status', type: 'select', options: ['We know of it, and have the information', 'We know of it, but info owned by others', 'Unknown'] },
  { key: 'information_owner', label: 'Information Owner', type: 'text' },
  { key: 'source', label: 'Source URL', type: 'text' },
];

export default function CreateProject({ onClose, onProjectCreated, onProvisionalMarker }) {
  const [step, setStep] = useState(1); // 1: Search, 2: Form
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  // Search global coal plants
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      const search = searchTerm.trim();
      
      // Use double %% for proper escaping in the or filter
      const { data, error } = await supabase
        .from('global_coal_plants')
        .select('*')
        .or(`plant_name.ilike.%${search}%,country_area.ilike.%${search}%,owner.ilike.%${search}%`)
        .limit(50);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Search results:', data?.length || 0, 'plants found for:', search);
      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching plants:', err);
      alert('Error searching: ' + err.message);
    }
    setIsSearching(false);
  };

  // Handle plant selection
  const handleSelectPlant = (plant) => {
    setSelectedPlant(plant);
    
    // Pre-fill form with plant data
    const coords = plant.latitude && plant.longitude 
      ? `${plant.latitude}, ${plant.longitude}` 
      : '';
    
    setFormData({
      plant_name: plant.plant_name || '',
      unit_name: plant.unit_name || '',
      capacity_mw: plant.capacity_mw || '',
      country: plant.country_area || '',
      location_coordinates: coords,
      operator: plant.owner || '', // Using owner as operator if not available
      owner: plant.owner || '',
      parent: plant.parent || '',
      start_year: plant.start_year || '',
      operational_status: plant.status || 'Operating',
      project_name: '',
      // Additional fields from global plants
      gem_unit_phase_id: plant.gem_unit_phase_id || '',
      latitude: plant.latitude || '',
      longitude: plant.longitude || '',
    });

    // Notify parent about provisional marker
    if (onProvisionalMarker && plant.latitude && plant.longitude) {
      onProvisionalMarker({
        lat: parseFloat(plant.latitude),
        lng: parseFloat(plant.longitude),
        plantName: plant.plant_name,
      });
    }

    setStep(2);
  };

  // Handle form field change
  const handleFieldChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  // Save new project
  const handleSave = async () => {
    if (!formData.project_name?.trim()) {
      alert('Please enter a Project Name');
      return;
    }

    setSaving(true);
    try {
      // Prepare data for insertion
      const projectData = {
        plant_name: formData.plant_name,
        unit_name: formData.unit_name,
        capacity_mw: formData.capacity_mw,
        country: formData.country,
        location_coordinates: formData.location_coordinates,
        operator: formData.operator,
        owner: formData.owner,
        parent: formData.parent,
        start_year: formData.start_year,
        operational_status: formData.operational_status,
        project_name: formData.project_name,
        planned_retirement_year: formData.planned_retirement_year || null,
        actual_retirement_year: formData.actual_retirement_year || null,
        transition_type: formData.transition_type || null,
        financial_mechanism: formData.financial_mechanism || null,
        lender_s_funder_s_involved: formData.lenders_funders_involved || null,
        planned_post_retirement_status: formData.planned_post_retirement_status || null,
        intelligence_on_transaction_status: formData.intelligence_on_transaction_status || null,
        technical_assistance_provided_to_date: formData.technical_assistance_provided_to_date || null,
        information_status: formData.information_status || null,
        information_owner: formData.information_owner || null,
        source: formData.source || null,
        last_updated: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('project_specific_data')
        .insert(projectData)
        .select()
        .single();

      if (error) throw error;

      // Log the creation
      await supabase
        .from('project_logs')
        .insert({
          project_id: data.id,
          plant_name: data.plant_name,
          field_changed: 'Project Created',
          notes: `New project "${data.project_name}" created from ${selectedPlant?.plant_name || 'manual entry'}`,
          updated_by: 'user',
        });

      alert('Project created successfully!');
      
      if (onProjectCreated) {
        onProjectCreated(data);
      }
      
      onClose();
    } catch (err) {
      console.error('Error creating project:', err);
      alert('Error creating project: ' + err.message);
    }
    setSaving(false);
  };

  // Go back to search
  const handleBack = () => {
    setStep(1);
    setSelectedPlant(null);
    // Clear provisional marker
    if (onProvisionalMarker) {
      onProvisionalMarker(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {step === 1 ? 'Search Coal Plant' : 'Create New Project'}
            </h2>
            <p className="text-emerald-100 text-sm mt-1">
              {step === 1 
                ? 'Search for a coal plant from the global database' 
                : `Creating project for: ${selectedPlant?.plant_name || 'Selected Plant'}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            /* Step 1: Search */
            <div className="space-y-4">
              {/* Search Input */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by plant name, country, or owner..."
                    className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 pl-10 border border-slate-600 focus:border-emerald-400 focus:outline-none"
                  />
                  <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm">{searchResults.length} plants found</p>
                  <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {searchResults.map((plant, idx) => (
                      <div
                        key={plant.gem_unit_phase_id || idx}
                        onClick={() => handleSelectPlant(plant)}
                        className="bg-slate-700/50 hover:bg-slate-700 rounded-lg p-4 cursor-pointer border border-slate-600 hover:border-emerald-400 transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-white font-semibold">{plant.plant_name || 'Unknown Plant'}</h3>
                            {plant.unit_name && (
                              <p className="text-slate-400 text-sm">Unit: {plant.unit_name}</p>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            plant.status === 'operating' ? 'bg-green-500/20 text-green-400' :
                            plant.status === 'retired' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {plant.status || 'Unknown'}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-300">
                          <span>📍 {plant.country_area || 'Unknown Location'}</span>
                          {plant.capacity_mw && <span>⚡ {plant.capacity_mw} MW</span>}
                          {plant.owner && <span>🏢 {plant.owner}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : searchTerm && !isSearching ? (
                <div className="text-center py-8 text-slate-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>No plants found matching "{searchTerm}"</p>
                  <p className="text-sm mt-1">Try a different search term</p>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p>Search the global database of {'>'}7,700 coal plants</p>
                  <p className="text-sm mt-1">Enter a plant name, country, or owner to get started</p>
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Form */
            <div className="space-y-6">
              {/* Selected Plant Info */}
              {selectedPlant && (
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <h3 className="text-white font-semibold mb-2">Selected Coal Plant</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-slate-400">Plant:</span>
                      <p className="text-white">{selectedPlant.plant_name}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Country:</span>
                      <p className="text-white">{selectedPlant.country_area}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Capacity:</span>
                      <p className="text-white">{selectedPlant.capacity_mw} MW</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Status:</span>
                      <p className="text-white">{selectedPlant.status}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Project Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></span>
                  Project Details
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PROJECT_FIELDS.map(field => (
                    <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                      <label className="text-slate-400 text-xs uppercase tracking-wide block mb-1">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          value={formData[field.key] || ''}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:border-emerald-400 focus:outline-none"
                        >
                          <option value="">Select...</option>
                          {field.options.filter(o => o).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          value={formData[field.key] || ''}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          rows={3}
                          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:border-emerald-400 focus:outline-none resize-none"
                        />
                      ) : (
                        <input
                          type="text"
                          value={formData[field.key] || ''}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:border-emerald-400 focus:outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-700 px-6 py-4 flex justify-between border-t border-slate-600">
          {step === 2 ? (
            <>
              <button
                onClick={handleBack}
                className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                ← Back to Search
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Project'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <div className="text-slate-400 text-sm flex items-center">
                Select a plant to continue →
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
