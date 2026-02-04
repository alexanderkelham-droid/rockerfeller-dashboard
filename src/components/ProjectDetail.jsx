import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

// Helper to get value from project - handles both snake_case and display name formats
const getValue = (project, snakeKey, displayKey) => {
  return project[snakeKey] ?? project[displayKey] ?? '';
};

// Field configuration for display and editing
// Each field has both snake_case key (for Supabase) and display key (for normalized data)
const EDITABLE_FIELDS = [
  { key: 'operational_status', displayKey: 'Operational Status', label: 'Operational Status', type: 'select', options: ['Operating', 'Retired', 'Mothballed', 'Under Construction', 'Planned'] },
  { key: 'planned_retirement_year', displayKey: 'Planned retirement year', label: 'Planned Retirement Year', type: 'text' },
  { key: 'actual_retirement_year', displayKey: 'Actual retirement year', label: 'Actual Retirement Year', type: 'text' },
  { key: 'transition_type', displayKey: 'Transition type', label: 'Transition Type', type: 'select', options: ['', 'Refinance', 'Policy-driven retirement', 'Market-driven retirement', 'Conversion', 'Other'] },
  { key: 'financial_mechanism', displayKey: 'Financial mechanism', label: 'Financial Mechanism', type: 'text' },
  { key: 'lenders_funders_involved', displayKey: 'Lender(s)/ Funder(s) involved', label: 'Lenders/Funders Involved', type: 'text' },
  { key: 'planned_post_retirement_status', displayKey: 'Planned post-retirement status', label: 'Planned Post-Retirement Status', type: 'textarea' },
  { key: 'intelligence_on_transaction_status', displayKey: 'Intelligence on Transaction Status', label: 'Transaction Intelligence', type: 'textarea' },
  { key: 'technical_assistance_provided_to_date', displayKey: 'Technical Assistance provided to date', label: 'Technical Assistance', type: 'textarea' },
  { key: 'information_status', displayKey: 'Information Status', label: 'Information Status', type: 'select', options: ['We know of it, and have the information', 'We know of it, but info owned by others', 'Unknown'] },
  { key: 'information_owner', displayKey: 'Information Owner', label: 'Information Owner', type: 'text' },
];

const INFO_FIELDS = [
  { key: 'plant_name', displayKey: 'Plant Name', label: 'Plant Name' },
  { key: 'unit_name', displayKey: 'Unit name', label: 'Unit Name' },
  { key: 'capacity_mw', displayKey: 'Capacity (MW)', label: 'Capacity (MW)' },
  { key: 'country', displayKey: 'Country', label: 'Country' },
  { key: 'location_coordinates', displayKey: 'Location (coordinates)', label: 'Coordinates' },
  { key: 'operator', displayKey: 'Operator', label: 'Operator' },
  { key: 'owner', displayKey: 'Owner', label: 'Owner' },
  { key: 'parent', displayKey: 'Parent', label: 'Parent Company' },
  { key: 'start_year', displayKey: 'Start year', label: 'Start Year' },
  { key: 'project_name', displayKey: 'Project Name', label: 'Project Name' },
];

// Initialize editedProject with snake_case keys from project data
const initializeEditedProject = (project) => {
  const initialized = { ...project };
  [...INFO_FIELDS, ...EDITABLE_FIELDS].forEach(field => {
    if (initialized[field.key] === undefined && field.displayKey) {
      initialized[field.key] = project[field.displayKey] ?? '';
    }
  });
  return initialized;
};

export default function ProjectDetail({ project, onClose, onUpdate }) {
  const [editMode, setEditMode] = useState(false);
  const [editedProject, setEditedProject] = useState(() => initializeEditedProject(project));
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'history'

  // Fetch project logs
  useEffect(() => {
    fetchLogs();
  }, [project.id]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('project_logs')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
    setLoadingLogs(false);
  };

  // Handle field change
  const handleFieldChange = (key, value) => {
    setEditedProject(prev => ({ ...prev, [key]: value }));
  };

  // Save changes and log them
  const handleSave = async () => {
    setSaving(true);
    try {
      // Find changed fields
      const changes = [];
      const plantName = getValue(project, 'plant_name', 'Plant Name');
      
      for (const field of EDITABLE_FIELDS) {
        const oldVal = getValue(project, field.key, field.displayKey) || '';
        const newVal = editedProject[field.key] || '';
        if (oldVal !== newVal) {
          changes.push({
            project_id: project.id,
            plant_name: plantName,
            field_changed: field.label,
            old_value: oldVal,
            new_value: newVal,
            updated_by: 'user', // TODO: Replace with actual user
          });
        }
      }

      // Update the project
      const { error: updateError } = await supabase
        .from('project_specific_data')
        .update(editedProject)
        .eq('id', project.id);

      if (updateError) throw updateError;

      // Log all changes
      if (changes.length > 0) {
        const { error: logError } = await supabase
          .from('project_logs')
          .insert(changes);
        
        if (logError) throw logError;
      }

      // Refresh logs and notify parent
      await fetchLogs();
      onUpdate && onUpdate(editedProject);
      setEditMode(false);
    } catch (err) {
      console.error('Error saving:', err);
      alert('Error saving changes: ' + err.message);
    }
    setSaving(false);
  };

  // Add a note/comment
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    setSaving(true);
    try {
      const plantName = getValue(project, 'plant_name', 'Plant Name');
      const { error } = await supabase
        .from('project_logs')
        .insert({
          project_id: project.id,
          plant_name: plantName,
          field_changed: 'Note Added',
          notes: newNote,
          updated_by: 'user', // TODO: Replace with actual user
        });

      if (error) throw error;
      
      setNewNote('');
      await fetchLogs();
    } catch (err) {
      console.error('Error adding note:', err);
      alert('Error adding note: ' + err.message);
    }
    setSaving(false);
  };

  // Cancel edit mode
  const handleCancel = () => {
    setEditedProject(initializeEditedProject(project));
    setEditMode(false);
  };

  // Format date for display
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-700 px-6 py-4 flex justify-between items-center border-b border-slate-600">
          <div>
            <h2 className="text-xl font-bold text-white">{getValue(project, 'plant_name', 'Plant Name')}</h2>
            <p className="text-slate-400 text-sm">
              {getValue(project, 'unit_name', 'Unit name') && `${getValue(project, 'unit_name', 'Unit name')} • `}
              {getValue(project, 'country', 'Country')} • Project: {getValue(project, 'project_name', 'Project Name') || 'N/A'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-600">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'details'
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-700/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Project Details
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === 'history'
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-700/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Update History
            {logs.length > 0 && (
              <span className="ml-2 bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">
                {logs.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' ? (
            <div className="space-y-6">
              {/* Static Info Section */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                  Plant Information
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-slate-700/50 rounded-lg p-4">
                  {INFO_FIELDS.map(field => (
                    <div key={field.key}>
                      <label className="text-slate-400 text-xs uppercase tracking-wide">{field.label}</label>
                      <p className="text-white mt-1">{getValue(project, field.key, field.displayKey) || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Editable Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></span>
                    Project Status & Tracking
                  </h3>
                  {!editMode ? (
                    <button
                      onClick={() => setEditMode(true)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-700/50 rounded-lg p-4">
                  {EDITABLE_FIELDS.map(field => (
                    <div key={field.key} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                      <label className="text-slate-400 text-xs uppercase tracking-wide">{field.label}</label>
                      {editMode ? (
                        field.type === 'select' ? (
                          <select
                            value={editedProject[field.key] || ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            className="w-full mt-1 bg-slate-600 text-white rounded-lg px-3 py-2 border border-slate-500 focus:border-emerald-400 focus:outline-none"
                          >
                            {field.options.map(opt => (
                              <option key={opt} value={opt}>{opt || '(Not set)'}</option>
                            ))}
                          </select>
                        ) : field.type === 'textarea' ? (
                          <textarea
                            value={editedProject[field.key] || ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            rows={3}
                            className="w-full mt-1 bg-slate-600 text-white rounded-lg px-3 py-2 border border-slate-500 focus:border-emerald-400 focus:outline-none resize-none"
                          />
                        ) : (
                          <input
                            type="text"
                            value={editedProject[field.key] || ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            className="w-full mt-1 bg-slate-600 text-white rounded-lg px-3 py-2 border border-slate-500 focus:border-emerald-400 focus:outline-none"
                          />
                        )
                      ) : (
                        <p className="text-white mt-1 whitespace-pre-wrap">{getValue(project, field.key, field.displayKey) || '-'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Note Section */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <span className="w-2 h-2 bg-amber-400 rounded-full mr-2"></span>
                  Add Quick Note
                </h3>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note or update about this project..."
                    rows={3}
                    className="w-full bg-slate-600 text-white rounded-lg px-3 py-2 border border-slate-500 focus:border-amber-400 focus:outline-none resize-none"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={handleAddNote}
                      disabled={saving || !newNote.trim()}
                      className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Adding...' : 'Add Note'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* History Tab */
            <div>
              {loadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>No update history yet</p>
                  <p className="text-sm mt-1">Changes and notes will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log, index) => (
                    <div
                      key={log.id}
                      className={`bg-slate-700/50 rounded-lg p-4 border-l-4 ${
                        log.field_changed === 'Note Added' 
                          ? 'border-amber-400' 
                          : 'border-emerald-400'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-sm font-medium ${
                          log.field_changed === 'Note Added' 
                            ? 'text-amber-400' 
                            : 'text-emerald-400'
                        }`}>
                          {log.field_changed}
                        </span>
                        <span className="text-slate-400 text-xs">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      
                      {log.notes ? (
                        <p className="text-white whitespace-pre-wrap">{log.notes}</p>
                      ) : (
                        <div className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-red-400 line-through">{log.old_value || '(empty)'}</span>
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span className="text-emerald-400">{log.new_value || '(empty)'}</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-2 text-xs text-slate-500">
                        Updated by: {log.updated_by}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Source Link */}
        {getValue(project, 'source', 'Source') && (
          <div className="bg-slate-700 px-6 py-3 border-t border-slate-600">
            <a
              href={getValue(project, 'source', 'Source')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Source
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
