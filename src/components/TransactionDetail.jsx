import React, { useState, useEffect } from 'react';

const TransactionDetail = ({ 
  transaction, 
  onSave, 
  onDelete, 
  onClose, 
  countries, 
  deliveryPartners,
  stages 
}) => {
  const [formData, setFormData] = useState({
    // Coal Plant Characteristics
    plant_name: '',
    unit_name: '',
    capacity_mw: '',
    country: '',
    location_coordinates: '',
    owner: '',
    operational_status: 'operating',
    start_year: '',
    original_end_of_life_year: '',
    lifetime_sox_tonnes: '',
    lifetime_nox_tonnes: '',
    lifetime_co2_tonnes: '',
    grid_connection_type: '',
    
    // CATA Project Characteristics
    project_value: '',
    project_stage: 'concept_proposal',
    key_contacts: '',
    project_name: '',
    planned_retirement_year: '',
    actual_retirement_year: '',
    
    // Transaction Data
    transition_type: '',
    transaction_stage: 'origination',
    transaction_status: '',
    transaction_confidence_rating: '',
    transaction_next_steps: '',
    deal_timeframe: '',
    estimated_deal_size: '',
    financial_mechanism: '',
    lenders_funders: '',
    planned_post_retirement_status: '',
    
    // Key Features
    actors_in_contact: '',
    funded_delivery_partners: [],
    related_work_link: '',
    assumptions_confidence_rating: '',
    
    // Additional
    notes: '',
    assigned_to: '',
  });

  const [activeTab, setActiveTab] = useState('plant');
  const [nextSteps, setNextSteps] = useState([]);
  const [newNextStep, setNewNextStep] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load transaction data if editing
  useEffect(() => {
    if (transaction) {
      setFormData({
        ...transaction,
        deal_timeframe: transaction.deal_timeframe ? transaction.deal_timeframe.split('T')[0] : '',
        funded_delivery_partners: transaction.funded_delivery_partners || [],
      });
      // Parse next steps from JSON
      try {
        const steps = transaction.transaction_next_steps 
          ? JSON.parse(transaction.transaction_next_steps) 
          : [];
        setNextSteps(Array.isArray(steps) ? steps : []);
      } catch {
        setNextSteps([]);
      }
    }
  }, [transaction]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    }));
  };

  const handlePartnerToggle = (partner) => {
    setFormData(prev => ({
      ...prev,
      funded_delivery_partners: prev.funded_delivery_partners.includes(partner)
        ? prev.funded_delivery_partners.filter(p => p !== partner)
        : [...prev.funded_delivery_partners, partner]
    }));
  };

  const handleAddNextStep = () => {
    if (newNextStep.trim()) {
      setNextSteps(prev => [...prev, { text: newNextStep.trim(), completed: false }]);
      setNewNextStep('');
    }
  };

  const handleToggleNextStep = (index) => {
    setNextSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, completed: !step.completed } : step
    ));
  };

  const handleRemoveNextStep = (index) => {
    setNextSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // Prepare data for save
      const dataToSave = {
        ...formData,
        transaction_next_steps: JSON.stringify(nextSteps),
        // Convert empty strings to null for numeric fields
        capacity_mw: formData.capacity_mw === '' ? null : formData.capacity_mw,
        start_year: formData.start_year === '' ? null : formData.start_year,
        original_end_of_life_year: formData.original_end_of_life_year === '' ? null : formData.original_end_of_life_year,
        lifetime_sox_tonnes: formData.lifetime_sox_tonnes === '' ? null : formData.lifetime_sox_tonnes,
        lifetime_nox_tonnes: formData.lifetime_nox_tonnes === '' ? null : formData.lifetime_nox_tonnes,
        lifetime_co2_tonnes: formData.lifetime_co2_tonnes === '' ? null : formData.lifetime_co2_tonnes,
        project_value: formData.project_value === '' ? null : formData.project_value,
        planned_retirement_year: formData.planned_retirement_year === '' ? null : formData.planned_retirement_year,
        actual_retirement_year: formData.actual_retirement_year === '' ? null : formData.actual_retirement_year,
        transaction_confidence_rating: formData.transaction_confidence_rating === '' ? null : formData.transaction_confidence_rating,
        estimated_deal_size: formData.estimated_deal_size === '' ? null : formData.estimated_deal_size,
        assumptions_confidence_rating: formData.assumptions_confidence_rating === '' ? null : formData.assumptions_confidence_rating,
        deal_timeframe: formData.deal_timeframe || null,
      };

      await onSave(dataToSave);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'plant', label: 'Plant Details', icon: '🏭' },
    { id: 'project', label: 'Project', icon: '📋' },
    { id: 'transaction', label: 'Transaction', icon: '💼' },
    { id: 'stakeholders', label: 'Stakeholders', icon: '👥' },
    { id: 'notes', label: 'Notes & Links', icon: '📝' },
  ];

  const InputField = ({ label, name, type = 'text', required = false, placeholder = '', unit = '', ...props }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        {unit && <span className="text-gray-400 font-normal ml-1">({unit})</span>}
      </label>
      <input
        type={type}
        name={name}
        value={formData[name] ?? ''}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        {...props}
      />
    </div>
  );

  const SelectField = ({ label, name, options, required = false, placeholder = 'Select...' }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        name={name}
        value={formData[name] ?? ''}
        onChange={handleChange}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt.value || opt} value={opt.value || opt}>
            {opt.label || opt}
          </option>
        ))}
      </select>
    </div>
  );

  const TextAreaField = ({ label, name, rows = 3, placeholder = '' }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        name={name}
        value={formData[name] ?? ''}
        onChange={handleChange}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  );

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {transaction ? 'Edit Transaction' : 'New Transaction'}
              </h1>
              {transaction && (
                <p className="text-sm text-gray-500">
                  Created {new Date(transaction.created_at).toLocaleDateString('en-GB')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {transaction && (
              <button
                onClick={() => onDelete(transaction.id)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving || !formData.plant_name}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {transaction ? 'Update' : 'Create'} Transaction
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-primary-700 border-t border-x border-gray-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          {/* Plant Details Tab */}
          {activeTab === 'plant' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Coal Plant Characteristics</h2>
              
              <div className="grid grid-cols-2 gap-6">
                <InputField label="Plant Name" name="plant_name" required placeholder="e.g., Suralaya power stations" />
                <InputField label="Unit Name" name="unit_name" placeholder="e.g., Unit 1" />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <InputField label="Capacity" name="capacity_mw" type="number" unit="MW" placeholder="1400" />
                <SelectField 
                  label="Country" 
                  name="country" 
                  options={countries}
                  required
                />
                <SelectField 
                  label="Operational Status" 
                  name="operational_status" 
                  options={[
                    { value: 'operating', label: 'Operating' },
                    { value: 'retired', label: 'Retired' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <InputField label="Location (Coordinates)" name="location_coordinates" placeholder="e.g., -6.1234, 106.5678 (WGS84)" />
                <InputField label="Owner" name="owner" placeholder="Company name" />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <InputField label="Start Year" name="start_year" type="number" placeholder="2016" />
                <InputField label="Original End of Life Year" name="original_end_of_life_year" type="number" placeholder="2046" />
                <InputField label="Grid Connection Type" name="grid_connection_type" placeholder="e.g., Baseload" />
              </div>

              <h3 className="text-md font-semibold text-gray-700 pt-4">Lifetime Emissions</h3>
              <div className="grid grid-cols-3 gap-6">
                <InputField label="Lifetime SOx" name="lifetime_sox_tonnes" type="number" unit="tonnes" placeholder="0" />
                <InputField label="Lifetime NOx" name="lifetime_nox_tonnes" type="number" unit="tonnes" placeholder="0" />
                <InputField label="Lifetime CO2" name="lifetime_co2_tonnes" type="number" unit="tonnes" placeholder="0" />
              </div>
            </div>
          )}

          {/* Project Tab */}
          {activeTab === 'project' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">CATA Project Characteristics</h2>
              
              <div className="grid grid-cols-2 gap-6">
                <InputField label="Project Name" name="project_name" placeholder="Coal-to-Clean Transition Project" />
                <InputField label="Project Value" name="project_value" type="number" unit="USD" placeholder="10000000" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <SelectField 
                  label="Project Stage" 
                  name="project_stage" 
                  options={[
                    { value: 'concept_proposal', label: 'Concept/Proposal Development' },
                    { value: 'in_delivery', label: 'In Delivery' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'no_engagement', label: 'No Engagement' },
                  ]}
                />
                <InputField label="Assigned To" name="assigned_to" placeholder="team.member@cata.org" />
              </div>

              <TextAreaField 
                label="Key Contacts" 
                name="key_contacts" 
                placeholder="List key contacts for the project (names, roles, emails)"
                rows={4}
              />

              <h3 className="text-md font-semibold text-gray-700 pt-4">Retirement Timeline</h3>
              <div className="grid grid-cols-2 gap-6">
                <InputField label="Planned Retirement Year" name="planned_retirement_year" type="number" placeholder="2030" />
                <InputField label="Actual Retirement Year" name="actual_retirement_year" type="number" placeholder="2030" />
              </div>

              <InputField label="Planned Post-Retirement Status" name="planned_post_retirement_status" placeholder="e.g., Solar + Battery Storage" />
            </div>
          )}

          {/* Transaction Tab */}
          {activeTab === 'transaction' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Transaction Data</h2>
              
              <div className="grid grid-cols-2 gap-6">
                <SelectField 
                  label="Transaction Stage" 
                  name="transaction_stage" 
                  options={stages.map(s => ({ value: s.id, label: s.label }))}
                />
                <SelectField 
                  label="Transaction Status (RAG)" 
                  name="transaction_status" 
                  options={[
                    { value: 'green', label: '🟢 Green - On Track' },
                    { value: 'amber', label: '🟠 Amber - At Risk' },
                    { value: 'red', label: '🔴 Red - Blocked' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Confidence Rating
                    <span className="text-gray-400 font-normal ml-1">(0-100%)</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      name="transaction_confidence_rating"
                      min="0"
                      max="100"
                      value={formData.transaction_confidence_rating || 0}
                      onChange={handleChange}
                      className="flex-1"
                    />
                    <span className={`text-lg font-bold min-w-[60px] text-right ${
                      (formData.transaction_confidence_rating || 0) >= 70 ? 'text-emerald-600' :
                      (formData.transaction_confidence_rating || 0) >= 40 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {formData.transaction_confidence_rating || 0}%
                    </span>
                  </div>
                </div>
                <InputField label="Deal Timeframe (Expected Close)" name="deal_timeframe" type="date" />
              </div>

              <InputField label="Transition Type" name="transition_type" placeholder="e.g., Managed phase-out, Repurposing" />

              <div className="grid grid-cols-2 gap-6">
                <InputField label="Estimated Deal Size" name="estimated_deal_size" type="number" unit="USD" placeholder="50000000" />
                <InputField label="Financial Mechanism" name="financial_mechanism" placeholder="e.g., Concessional loan, Grant, Blended finance" />
              </div>

              <InputField label="Lender(s) / Funder(s)" name="lenders_funders" placeholder="e.g., World Bank, ADB, JICA" />

              {/* Next Steps */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Next Steps</label>
                <div className="space-y-2 mb-3">
                  {nextSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <input
                        type="checkbox"
                        checked={step.completed}
                        onChange={() => handleToggleNextStep(index)}
                        className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className={`flex-1 ${step.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {step.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveNextStep(index)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNextStep}
                    onChange={(e) => setNewNextStep(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNextStep())}
                    placeholder="Add a next step..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddNextStep}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stakeholders Tab */}
          {activeTab === 'stakeholders' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Stakeholders & Partners</h2>
              
              <TextAreaField 
                label="Actors in Contact with Asset Owner / Government" 
                name="actors_in_contact" 
                placeholder="List organizations and individuals engaging with the asset owner or government"
                rows={4}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Funded Delivery Partners</label>
                <div className="flex flex-wrap gap-2">
                  {deliveryPartners.map(partner => (
                    <button
                      key={partner}
                      type="button"
                      onClick={() => handlePartnerToggle(partner)}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        formData.funded_delivery_partners?.includes(partner)
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {partner}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assumptions Confidence Rating
                  <span className="text-gray-400 font-normal ml-1">(0-100%)</span>
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    name="assumptions_confidence_rating"
                    min="0"
                    max="100"
                    value={formData.assumptions_confidence_rating || 0}
                    onChange={handleChange}
                    className="flex-1"
                  />
                  <span className="text-lg font-bold min-w-[60px] text-right">
                    {formData.assumptions_confidence_rating || 0}%
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Confidence level of assumptions used in the calculations</p>
              </div>
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Notes & Related Work</h2>
              
              <TextAreaField 
                label="Notes" 
                name="notes" 
                placeholder="Add any additional notes, context, or information about this transaction..."
                rows={8}
              />

              <InputField 
                label="Related Work Link" 
                name="related_work_link" 
                type="url"
                placeholder="https://..."
              />
              <p className="text-sm text-gray-500 -mt-4">Link to related projects, documents, or resources</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default TransactionDetail;
