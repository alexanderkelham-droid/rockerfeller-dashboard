import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

// Project stage definitions (CATA PMO stages)
const PROJECT_STAGES = [
  { id: 'ideation', label: 'Ideation', description: 'Initial concept development' },
  { id: 'screening', label: 'Screening', description: 'Preliminary assessment' },
  { id: 'pre_feasibility', label: 'Pre-Feasibility', description: 'Initial feasibility analysis' },
  { id: 'full_feasibility', label: 'Full Feasibility', description: 'Detailed feasibility study' },
  { id: 'deal_structuring', label: 'Deal Structuring', description: 'Transaction design & negotiation' },
  { id: 'closing', label: 'Closing', description: 'Final approvals & signing' },
  { id: 'transaction_complete', label: 'Transaction Complete', description: 'Successfully closed' },
  { id: 'bau', label: 'BAU', description: 'Business as usual / ongoing operations' },
];

// Engagement status options
const ENGAGEMENT_STATUSES = [
  { id: 'no_engagement', label: 'No Engagement', color: 'bg-gray-400' },
  { id: 'concept_proposal', label: 'Concept/Proposal Development', color: 'bg-blue-500' },
  { id: 'in_delivery', label: 'In Delivery', color: 'bg-emerald-500' },
  { id: 'completed', label: 'Completed', color: 'bg-purple-500' },
];

// RAG status colors
const RAG_COLORS = {
  green: { bg: 'bg-emerald-500', text: 'text-emerald-700', label: 'On Track' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-700', label: 'At Risk' },
  red: { bg: 'bg-red-500', text: 'text-red-700', label: 'Blocked' },
  closed: { bg: 'bg-gray-500', text: 'text-gray-700', label: 'Closed' },
};

// Currency options
const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'IDR', symbol: 'Rp', label: 'Indonesian Rupiah' },
  { code: 'VND', symbol: '₫', label: 'Vietnamese Dong' },
  { code: 'PHP', symbol: '₱', label: 'Philippine Peso' },
  { code: 'ZAR', symbol: 'R', label: 'South African Rand' },
];

// Country list
const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria', 'Bangladesh', 'Belgium',
  'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Bulgaria', 'Cambodia', 'Canada', 'Chile', 'China',
  'Colombia', 'Croatia', 'Czech Republic', 'Denmark', 'Dominican Republic', 'Ecuador', 'Egypt',
  'El Salvador', 'Estonia', 'Ethiopia', 'Finland', 'France', 'Germany', 'Ghana', 'Greece', 'Guatemala',
  'Honduras', 'Hungary', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan',
  'Jordan', 'Kazakhstan', 'Kenya', 'Kosovo', 'Laos', 'Latvia', 'Lebanon', 'Lithuania', 'Madagascar',
  'Malaysia', 'Mexico', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Nepal',
  'Netherlands', 'New Zealand', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Pakistan',
  'Panama', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Romania', 'Russia', 'Saudi Arabia', 'Senegal',
  'Serbia', 'Singapore', 'Slovakia', 'Slovenia', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka',
  'Sweden', 'Taiwan', 'Tanzania', 'Thailand', 'Tunisia', 'Turkey', 'Ukraine', 'United Arab Emirates',
  'United Kingdom', 'United States', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Zambia', 'Zimbabwe'
];

const DELIVERY_PARTNERS = ['CSV', 'RMI', 'CT', 'CCSF', 'World Bank', 'ADB', 'AIIB', 'IADB', 'AfDB', 'EBRD', 'EIB', 'IFC', 'JICA', 'KfW', 'OPIC', 'Other'];

// Activity types for CRM-style notes
const ACTIVITY_TYPES = [
  { id: 'note', label: 'Note', icon: '📝', color: 'bg-gray-100 text-gray-600', description: 'General note or comment' },
  { id: 'email', label: 'Email', icon: '📧', color: 'bg-blue-100 text-blue-600', description: 'Email correspondence' },
  { id: 'call', label: 'Phone Call', icon: '📞', color: 'bg-green-100 text-green-600', description: 'Phone conversation' },
  { id: 'meeting', label: 'Meeting', icon: '👥', color: 'bg-purple-100 text-purple-600', description: 'In-person or virtual meeting' },
  { id: 'task', label: 'Task', icon: '✓', color: 'bg-amber-100 text-amber-600', description: 'Action item or to-do' },
  { id: 'stage_change', label: 'Stage Change', icon: '🔄', color: 'bg-indigo-100 text-indigo-600', description: 'Project stage transition' },
  { id: 'document', label: 'Document', icon: '📄', color: 'bg-cyan-100 text-cyan-600', description: 'Document shared or received' },
];

const TransactionDetail = ({
  transaction,
  onSave,
  onDelete,
  onClose,
  userEmail
}) => {
  const [formData, setFormData] = useState({
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
    project_value: '',
    project_stage: 'concept_proposal',
    key_contacts: '',
    project_name: '',
    planned_retirement_year: '',    // Initial/planned retirement year
    actual_retirement_year: '',     // Target/actual retirement year  
    transition_type: '',
    transaction_stage: 'ideation',
    transaction_status: '',
    engagement_status: 'no_engagement',
    transaction_confidence_rating: '',
    transaction_next_steps: '',
    deal_timeframe: '',              // Expected signing/close date
    estimated_deal_size: '',
    deal_currency: 'USD',
    financial_mechanism: '',
    lenders_funders: '',
    planned_post_retirement_status: '',
    actors_in_contact: '',
    funded_delivery_partners: [],
    related_work_link: '',
    assumptions_confidence_rating: '',
    notes: '',
    assigned_to: '',
    plants: [],
    primary_funder: '',  // CATA, Rockefeller, or Other
    combustion_technology: '',
    coal_type: '',
    annual_co2_mt: '',
    remaining_lifetime_years: '',
    subregion: '',
  });

  const [activeTab, setActiveTab] = useState('summary');
  const [activities, setActivities] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [nextSteps, setNextSteps] = useState([]);
  const [newNextStep, setNewNextStep] = useState('');
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [newActivity, setNewActivity] = useState({ type: 'note', subject: '', description: '' });
  const [activityFilter, setActivityFilter] = useState('all');
  const [uploadFile, setUploadFile] = useState(null);
  const fileInputRef = useRef(null);

  // Plant search state
  const [plantSearchQuery, setPlantSearchQuery] = useState('');
  const [plantSearchResults, setPlantSearchResults] = useState([]);
  const [isSearchingPlants, setIsSearchingPlants] = useState(false);
  const [showPlantDropdown, setShowPlantDropdown] = useState(false);
  const plantSearchRef = useRef(null);

  // Load transaction data and activities
  useEffect(() => {
    if (transaction) {
      setFormData({
        ...transaction,
        deal_timeframe: transaction.deal_timeframe ? transaction.deal_timeframe.split('T')[0] : '',
        funded_delivery_partners: transaction.funded_delivery_partners || [],
        plants: transaction.plants || [],
        deal_currency: transaction.deal_currency || 'USD',
        planned_retirement_year: transaction.planned_retirement_year || '',
        actual_retirement_year: transaction.actual_retirement_year || '',
        engagement_status: transaction.engagement_status || 'no_engagement',
      });
      setPlantSearchQuery(transaction.plant_name || '');
      try {
        const steps = transaction.transaction_next_steps
          ? JSON.parse(transaction.transaction_next_steps)
          : [];
        setNextSteps(Array.isArray(steps) ? steps : []);
      } catch {
        setNextSteps([]);
      }
      fetchActivities(transaction.id);
    }
  }, [transaction]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (plantSearchRef.current && !plantSearchRef.current.contains(event.target)) {
        setShowPlantDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search plants in database
  const searchPlants = async (query) => {
    if (!query || query.length < 2) {
      setPlantSearchResults([]);
      return;
    }

    setIsSearchingPlants(true);
    try {
      const { data, error } = await supabase
        .from('global_coal_plants')
        .select('*')
        .or(`plant_name.ilike.%${query}%,unit_name.ilike.%${query}%`)
        .limit(20);

      if (error) {
        console.error('Supabase error:', error);
      } else if (data) {
        setPlantSearchResults(data);
      }
    } catch (error) {
      console.error('Error searching plants:', error);
    } finally {
      setIsSearchingPlants(false);
    }
  };

  // Debounced plant search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (plantSearchQuery && showPlantDropdown) {
        searchPlants(plantSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [plantSearchQuery, showPlantDropdown]);

  // Calculate total capacity from plants array
  const calculateTotalCapacity = (plants) => {
    if (!plants || plants.length === 0) return '';
    return plants.reduce((sum, p) => sum + (parseFloat(p.capacity_mw) || 0), 0);
  };

  // Handle plant selection from search - adds to plants array
  const handleSelectPlant = (plant) => {
    // Auto-calculate expected retirement year: use planned_retirement if available, otherwise start_year + 40
    const startYear = parseInt(plant.start_year) || null;
    const plannedRetirement = plant.planned_retirement ? parseInt(plant.planned_retirement) : null;
    const calculatedRetirement = plannedRetirement || (startYear ? startYear + 40 : null);

    const newPlant = {
      id: Date.now(), // temporary id for UI
      plant_name: plant.plant_name || '',
      unit_name: plant.unit_name || '',
      capacity_mw: plant.capacity_mw || '',
      country: plant.country_area || '',
      location_coordinates: plant.latitude && plant.longitude ? `${plant.latitude}, ${plant.longitude}` : '',
      owner: plant.owner || '',
      start_year: plant.start_year || '',
      operational_status: plant.status || 'operating',
      gem_id: plant.gem_unit_phase_id || '',
      combustion_technology: plant.combustion_technology || '',
      coal_type: plant.coal_type || '',
      annual_co2_mt: plant.annual_co2_million_tonnes_annum || '',
      remaining_lifetime_years: plant.remaining_plant_lifetime_years || '',
      subregion: plant.subregion || '',
      planned_retirement: calculatedRetirement || '',
    };

    // Add to plants array and calculate aggregated values
    setFormData(prev => {
      const updatedPlants = [...(prev.plants || []), newPlant];
      const totalCapacity = calculateTotalCapacity(updatedPlants);
      const uniqueCountries = [...new Set(updatedPlants.map(p => p.country).filter(Boolean))];

      // Calculate total annual CO2 from all plants
      const totalAnnualCO2 = updatedPlants.reduce((sum, p) => sum + (parseFloat(p.annual_co2_mt) || 0), 0);

      // Use earliest retirement year from plants for project
      const retirementYears = updatedPlants.map(p => p.planned_retirement).filter(Boolean);
      const earliestRetirement = retirementYears.length > 0 ? Math.min(...retirementYears) : '';

      return {
        ...prev,
        plants: updatedPlants,
        // Auto-calculate aggregated capacity
        capacity_mw: totalCapacity,
        // Set primary plant name if first one, otherwise keep project name
        plant_name: prev.plants?.length === 0 ? plant.plant_name : prev.plant_name,
        // Show all unique countries
        country: uniqueCountries.length === 1 ? uniqueCountries[0] : uniqueCountries.join(', '),
        // Use first plant's coordinates for map marker
        location_coordinates: prev.plants?.length === 0 && plant.latitude && plant.longitude
          ? `${plant.latitude}, ${plant.longitude}`
          : prev.location_coordinates,
        // Auto-populate planned retirement year if not set
        planned_retirement_year: prev.planned_retirement_year || earliestRetirement,
        // Additional aggregated fields
        annual_co2_mt: totalAnnualCO2 > 0 ? totalAnnualCO2.toFixed(2) : '',
        combustion_technology: prev.plants?.length === 0 ? plant.combustion_technology : prev.combustion_technology,
        coal_type: prev.plants?.length === 0 ? plant.coal_type : prev.coal_type,
        subregion: prev.plants?.length === 0 ? plant.subregion : prev.subregion,
      };
    });
    setPlantSearchQuery('');
    setShowPlantDropdown(false);
    setPlantSearchResults([]);
  };

  // Remove plant from array
  const handleRemovePlant = (plantId) => {
    setFormData(prev => {
      const updatedPlants = prev.plants.filter(p => p.id !== plantId);
      const totalCapacity = calculateTotalCapacity(updatedPlants);
      const uniqueCountries = [...new Set(updatedPlants.map(p => p.country).filter(Boolean))];

      return {
        ...prev,
        plants: updatedPlants,
        // Recalculate aggregated capacity
        capacity_mw: totalCapacity || '',
        // Update country list
        country: uniqueCountries.length === 1 ? uniqueCountries[0] : uniqueCountries.join(', '),
      };
    });
  };

  // Update individual plant field
  const handlePlantFieldChange = (plantId, field, value) => {
    setFormData(prev => {
      const updatedPlants = prev.plants.map(p =>
        p.id === plantId ? { ...p, [field]: value } : p
      );

      // Recalculate totals if capacity changed
      const totalCapacity = calculateTotalCapacity(updatedPlants);
      const uniqueCountries = [...new Set(updatedPlants.map(p => p.country).filter(Boolean))];

      return {
        ...prev,
        plants: updatedPlants,
        capacity_mw: totalCapacity || '',
        country: uniqueCountries.length === 1 ? uniqueCountries[0] : uniqueCountries.join(', '),
      };
    });
  };

  const fetchActivities = async (transactionId) => {
    if (!transactionId) return;
    try {
      const { data, error } = await supabase
        .from('transaction_activities')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setActivities(data);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    }));
  };

  const handleStageClick = async (stageId) => {
    const oldStage = formData.transaction_stage;
    setFormData(prev => ({ ...prev, transaction_stage: stageId }));

    if (transaction?.id && oldStage !== stageId) {
      await addActivity({
        type: 'stage_change',
        title: 'Stage Changed',
        description: `Transaction stage changed from "${PROJECT_STAGES.find(s => s.id === oldStage)?.label || oldStage}" to "${PROJECT_STAGES.find(s => s.id === stageId)?.label}"`,
      });
    }
  };

  const handleEngagementClick = async (statusId) => {
    const oldStatus = formData.engagement_status;
    setFormData(prev => ({ ...prev, engagement_status: statusId }));

    if (transaction?.id && oldStatus !== statusId) {
      await addActivity({
        type: 'stage_change',
        title: 'Engagement Status Changed',
        description: `Engagement status changed from "${ENGAGEMENT_STATUSES.find(s => s.id === oldStatus)?.label || oldStatus}" to "${ENGAGEMENT_STATUSES.find(s => s.id === statusId)?.label}"`,
      });
    }
  };

  const handlePartnerToggle = (partner) => {
    setFormData(prev => ({
      ...prev,
      funded_delivery_partners: prev.funded_delivery_partners.includes(partner)
        ? prev.funded_delivery_partners.filter(p => p !== partner)
        : [...prev.funded_delivery_partners, partner]
    }));
  };

  const addActivity = async (activityData) => {
    if (!transaction?.id) return;

    try {
      const { data, error } = await supabase
        .from('transaction_activities')
        .insert([{
          transaction_id: transaction.id,
          created_by: userEmail,
          activity_type: activityData.type,
          title: activityData.title,
          description: activityData.description,
          metadata: activityData.metadata || {},
        }])
        .select();

      if (!error && data) {
        setActivities(prev => [data[0], ...prev]);
      }
    } catch (error) {
      console.error('Error adding activity:', error);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    await addActivity({
      type: 'note',
      title: 'Note Added',
      description: newNote.trim(),
    });
    setNewNote('');
  };

  const handleAddActivity = async () => {
    if (!newActivity.description.trim() && newActivity.type !== 'document') return;
    if (newActivity.type === 'document' && !uploadFile && !newActivity.description.trim()) return;

    let metadata = {};
    let description = newActivity.description;

    // Handle file upload
    if (newActivity.type === 'document' && uploadFile) {
      try {
        const fileExt = uploadFile.name.split('.').pop();
        const fileName = `${transaction.id}/${Date.now()}_${uploadFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const { error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(fileName, uploadFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          // Try fallback bucket if project-files doesn't exist
          const { error: fallbackError } = await supabase.storage
            .from('documents')
            .upload(fileName, uploadFile);

          if (fallbackError) {
            alert('Failed to upload file. Please ensure a storage bucket named "project-files" or "documents" exists.');
            return;
          }
        }

        // Get public URL (try project-files first, then documents)
        let { data: { publicUrl } } = supabase.storage
          .from('project-files')
          .getPublicUrl(fileName);

        // If we used fallback, get url from there
        if (!publicUrl || publicUrl.includes('undefined')) {
          const { data: { publicUrl: fallbackUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(fileName);
          publicUrl = fallbackUrl;
        }

        metadata = {
          fileName: uploadFile.name,
          fileSize: uploadFile.size,
          fileType: uploadFile.type,
          fileUrl: publicUrl
        };

        if (!description) description = `Uploaded: ${uploadFile.name}`;

      } catch (error) {
        console.error('File upload exception:', error);
        alert('Error uplodaing file: ' + error.message);
        return;
      }
    }

    const activityType = ACTIVITY_TYPES.find(t => t.id === newActivity.type);
    await addActivity({
      type: newActivity.type,
      title: newActivity.subject.trim() || `${activityType?.label || 'Note'}`,
      description: description,
      metadata: metadata,
    });

    setNewActivity({ type: 'note', subject: '', description: '' });
    setUploadFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowActivityForm(false);
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

  const handleSubmit = async () => {
    setIsSaving(true);

    try {
      // Remove fields that don't exist in the database yet
      const { annual_co2_mt, combustion_technology, coal_type, subregion, remaining_lifetime_years, ...restFormData } = formData;

      const dataToSave = {
        ...restFormData,
        transaction_next_steps: JSON.stringify(nextSteps),
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
        plants: formData.plants || [],
        primary_funder: formData.primary_funder || null,
      };

      await onSave(dataToSave);
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const currentStageIndex = PROJECT_STAGES.findIndex(s => s.id === formData.transaction_stage);
  const daysActive = transaction?.created_at
    ? Math.floor((new Date() - new Date(transaction.created_at)) / (1000 * 60 * 60 * 24))
    : 0;

  const getActivityIcon = (type) => {
    switch (type) {
      case 'note':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      case 'email':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'meeting':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'call':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        );
      case 'task':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case 'stage_change':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'plant', label: 'Plant Details' },
    { id: 'transaction', label: 'Transaction' },
    { id: 'stakeholders', label: 'Stakeholders' },
    { id: 'related', label: 'Related' },
  ];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-100">
      {/* Top Action Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || (!formData.plant_name && (!formData.plants || formData.plants.length === 0))}
            className="flex items-center gap-2 px-4 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save
          </button>
          <button onClick={() => fetchActivities(transaction?.id)} className="flex items-center gap-2 px-4 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          {transaction && (
            <button
              onClick={() => onDelete(transaction.id)}
              className="flex items-center gap-2 px-4 py-1.5 text-red-600 border border-red-200 rounded hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Header with Title and Key Metrics */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {formData.project_name || formData.plant_name || 'New Transaction'}
            </h1>
            <p className="text-sm text-gray-500">
              Transaction · {formData.country || 'No country set'} · {formData.plants?.length || 0} plant(s)
            </p>
          </div>

          {/* Key Metrics */}
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center px-4 border-r border-gray-200">
              <p className="text-gray-500">Target Close Date</p>
              <p className="font-semibold text-gray-900">
                {formData.deal_timeframe
                  ? new Date(formData.deal_timeframe).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '-'}
              </p>
            </div>
            <div className="text-center px-4 border-r border-gray-200">
              <p className="text-gray-500">Deal Size</p>
              <p className="font-semibold text-gray-900">
                {formData.estimated_deal_size
                  ? `${CURRENCIES.find(c => c.code === formData.deal_currency)?.symbol || '$'}${(formData.estimated_deal_size / 1000000).toFixed(1)}M`
                  : '-'}
              </p>
            </div>
            <div className="text-center px-4 border-r border-gray-200">
              <p className="text-gray-500">Status</p>
              <div className="flex items-center justify-center gap-1.5">
                {formData.transaction_status && (
                  <div className={`w-2.5 h-2.5 rounded-full ${RAG_COLORS[formData.transaction_status]?.bg}`} />
                )}
                <p className={`font-semibold ${RAG_COLORS[formData.transaction_status]?.text || 'text-gray-900'}`}>
                  {RAG_COLORS[formData.transaction_status]?.label || 'Not Set'}
                </p>
              </div>
            </div>
            <div className="text-center px-4">
              <p className="text-gray-500">Owner</p>
              <p className="font-semibold text-gray-900">{formData.assigned_to || userEmail || '-'}</p>
            </div>
          </div>
        </div>

        {/* Stage Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary-700 bg-primary-100 px-2 py-1 rounded">
                Project Pipeline
              </span>
              <span className="text-xs text-gray-500">Active for {daysActive} days</span>
            </div>
          </div>

          <div className="flex items-center">
            {ENGAGEMENT_STATUSES.map((status, index) => {
              const currentEngagementIndex = ENGAGEMENT_STATUSES.findIndex(s => s.id === formData.engagement_status);
              const isActive = index === currentEngagementIndex;
              const isCompleted = index < currentEngagementIndex;
              const isLast = index === ENGAGEMENT_STATUSES.length - 1;

              return (
                <div key={status.id} className="flex items-center flex-1">
                  <button
                    onClick={() => handleEngagementClick(status.id)}
                    title={status.label}
                    className={`flex-1 relative py-3 px-4 text-sm font-medium transition-colors ${isActive
                        ? 'bg-primary-600 text-white'
                        : isCompleted
                          ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      } ${index === 0 ? 'rounded-l-lg' : ''} ${isLast ? 'rounded-r-lg' : ''}`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {isCompleted ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : isActive ? (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      ) : (
                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                      )}
                      <span>{status.label}</span>
                    </div>
                  </button>
                  {!isLast && (
                    <div className={`w-2 h-full ${isCompleted ? 'bg-primary-100' : 'bg-gray-100'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Column - Form Fields */}
        <div className="w-1/3 border-r border-gray-200 bg-white overflow-y-auto p-6">
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Project Name</label>
                <input
                  type="text"
                  name="project_name"
                  value={formData.project_name || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter project name..."
                />
              </div>

              {/* Plant Search - Multiple Plants Support */}
              <div ref={plantSearchRef} className="relative">
                <label className="block text-xs text-gray-500 mb-1">
                  Add Plants <span className="text-red-500">*</span>
                  <span className="text-gray-400 ml-1">(Search database to add)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={plantSearchQuery}
                    onChange={(e) => {
                      setPlantSearchQuery(e.target.value);
                      setShowPlantDropdown(true);
                    }}
                    onFocus={() => setShowPlantDropdown(true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Type to search and add plants..."
                  />
                  {isSearchingPlants && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent"></div>
                    </div>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {showPlantDropdown && plantSearchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    <div className="p-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                      {plantSearchResults.length} plants found - click to add
                    </div>
                    {plantSearchResults.map((plant, index) => (
                      <button
                        key={`${plant.plant_name}-${plant.unit_name}-${index}`}
                        onClick={() => handleSelectPlant(plant)}
                        className="w-full px-3 py-2 text-left hover:bg-primary-50 border-b border-gray-50 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900 text-sm">{plant.plant_name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                          {plant.unit_name && <span>Unit: {plant.unit_name}</span>}
                          {plant.country_area && <span>• {plant.country_area}</span>}
                          {plant.capacity_mw && <span>• {plant.capacity_mw} MW</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Added Plants List */}
              {formData.plants?.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs text-gray-500">Plants in Transaction ({formData.plants.length})</label>
                  {formData.plants.map((plant) => (
                    <div key={plant.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="flex-1">
                        <span className="font-medium text-sm">{plant.plant_name}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {plant.unit_name && `${plant.unit_name} • `}
                          {plant.capacity_mw && `${plant.capacity_mw} MW • `}
                          {plant.country}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemovePlant(plant.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Country
                  {formData.plants?.length > 0 && (
                    <span className="ml-1 text-cyan-600 font-normal">(from plants)</span>
                  )}
                </label>
                {formData.plants?.length > 0 ? (
                  <input
                    type="text"
                    value={formData.country || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-600"
                  />
                ) : (
                  <select
                    name="country"
                    value={formData.country || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select country...</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Transaction Stage</label>
                <select
                  name="transaction_stage"
                  value={formData.transaction_stage || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select stage...</option>
                  {PROJECT_STAGES.map(stage => (
                    <option key={stage.id} value={stage.id}>{stage.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Target Close Date</label>
                <input
                  type="date"
                  name="deal_timeframe"
                  value={formData.deal_timeframe || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">RAG Status</label>
                <select
                  name="transaction_status"
                  value={formData.transaction_status || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select status...</option>
                  <option value="green">🟢 Green - On Track</option>
                  <option value="amber">🟠 Amber - At Risk</option>
                  <option value="red">🔴 Red - Blocked</option>
                  <option value="closed">⚫ Grey - Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Engagement Status</label>
                <select
                  name="engagement_status"
                  value={formData.engagement_status || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select engagement...</option>
                  {ENGAGEMENT_STATUSES.map(status => (
                    <option key={status.id} value={status.id}>{status.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Total Project Value</label>
                  <input
                    type="number"
                    name="project_value"
                    value={formData.project_value || ''}
                    onChange={handleChange}
                    placeholder="100000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Currency</label>
                  <select
                    name="deal_currency"
                    value={formData.deal_currency || 'USD'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Primary Funder</label>
                <select
                  name="primary_funder"
                  value={formData.primary_funder || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select funder...</option>
                  <option value="CATA">CATA</option>
                  <option value="Rockefeller">Rockefeller Foundation</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Transition Type</label>
                <input
                  type="text"
                  name="transition_type"
                  value={formData.transition_type || ''}
                  onChange={handleChange}
                  placeholder="e.g., Managed phase-out"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assigned To</label>
                <input
                  type="text"
                  name="assigned_to"
                  value={formData.assigned_to || ''}
                  onChange={handleChange}
                  placeholder="email@cata.org"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description / Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes || ''}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Add description..."
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'plant' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Coal Plant Characteristics</h3>

              {/* Show individual plants if any exist */}
              {formData.plants?.length > 0 ? (
                <>
                  {/* Individual Plant Cards */}
                  {formData.plants.map((plant, idx) => (
                    <div key={plant.id || idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-800">
                          Plant {idx + 1}
                        </h4>
                        <button
                          type="button"
                          onClick={() => handleRemovePlant(plant.id)}
                          className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Remove
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Plant Name</label>
                            <input
                              type="text"
                              value={plant.plant_name || ''}
                              onChange={(e) => handlePlantFieldChange(plant.id, 'plant_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Unit Name</label>
                            <input
                              type="text"
                              value={plant.unit_name || ''}
                              onChange={(e) => handlePlantFieldChange(plant.id, 'unit_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Capacity (MW)</label>
                            <input
                              type="number"
                              value={plant.capacity_mw || ''}
                              onChange={(e) => handlePlantFieldChange(plant.id, 'capacity_mw', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Country</label>
                            <input
                              type="text"
                              value={plant.country || ''}
                              onChange={(e) => handlePlantFieldChange(plant.id, 'country', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Start Year</label>
                            <input
                              type="number"
                              value={plant.start_year || ''}
                              onChange={(e) => handlePlantFieldChange(plant.id, 'start_year', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Owner</label>
                            <input
                              type="text"
                              value={plant.owner || ''}
                              onChange={(e) => handlePlantFieldChange(plant.id, 'owner', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Operational Status</label>
                            <select
                              value={plant.operational_status || 'operating'}
                              onChange={(e) => handlePlantFieldChange(plant.id, 'operational_status', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 text-sm"
                            >
                              <option value="operating">Operating</option>
                              <option value="retired">Retired</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Location (Coordinates)</label>
                          <input
                            type="text"
                            value={plant.location_coordinates || ''}
                            onChange={(e) => handlePlantFieldChange(plant.id, 'location_coordinates', e.target.value)}
                            placeholder="-6.123, 106.567"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Combined Summary */}
                  <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200 mt-4">
                    <h4 className="font-semibold text-cyan-800 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Combined Portfolio Summary
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-cyan-600 mb-1">Total Plants</label>
                        <p className="text-lg font-bold text-cyan-800">{formData.plants.length}</p>
                      </div>
                      <div>
                        <label className="block text-xs text-cyan-600 mb-1">Total Capacity</label>
                        <p className="text-lg font-bold text-cyan-800">{formData.capacity_mw || 0} MW</p>
                      </div>
                      <div>
                        <label className="block text-xs text-cyan-600 mb-1">Countries</label>
                        <p className="text-lg font-bold text-cyan-800">{[...new Set(formData.plants.map(p => p.country).filter(Boolean))].length}</p>
                      </div>
                    </div>
                  </div>

                  {/* Add more plants */}
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-gray-700 mb-2">Add More Plants</h4>
                    <div ref={plantSearchRef} className="relative">
                      <div className="relative">
                        <input
                          type="text"
                          value={plantSearchQuery}
                          onChange={(e) => {
                            setPlantSearchQuery(e.target.value);
                            setShowPlantDropdown(true);
                          }}
                          onFocus={() => setShowPlantDropdown(true)}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Search to add another plant..."
                        />
                        {isSearchingPlants && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent"></div>
                          </div>
                        )}
                      </div>

                      {showPlantDropdown && plantSearchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                          <div className="p-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                            {plantSearchResults.length} plants found - click to add
                          </div>
                          {plantSearchResults.map((plant, index) => (
                            <button
                              key={`${plant.plant_name}-${plant.unit_name}-${index}`}
                              onClick={() => handleSelectPlant(plant)}
                              className="w-full px-3 py-2 text-left hover:bg-primary-50 border-b border-gray-50 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900 text-sm">{plant.plant_name}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                {plant.unit_name && <span>Unit: {plant.unit_name}</span>}
                                {plant.country_area && <span>• {plant.country_area}</span>}
                                {plant.capacity_mw && <span>• {plant.capacity_mw} MW</span>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Original single plant form when no plants added */}
                  <div ref={plantSearchRef} className="relative">
                    <label className="block text-xs text-gray-500 mb-1">
                      Plant Name <span className="text-red-500">*</span>
                      <span className="text-gray-400 ml-1">(Search database)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={plantSearchQuery}
                        onChange={(e) => {
                          setPlantSearchQuery(e.target.value);
                          setFormData(prev => ({ ...prev, plant_name: e.target.value }));
                          setShowPlantDropdown(true);
                        }}
                        onFocus={() => setShowPlantDropdown(true)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Type to search plants..."
                      />
                      {isSearchingPlants && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent"></div>
                        </div>
                      )}
                    </div>

                    {showPlantDropdown && plantSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        <div className="p-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                          {plantSearchResults.length} plants found - click to populate details
                        </div>
                        {plantSearchResults.map((plant, index) => (
                          <button
                            key={`${plant.plant_name}-${plant.unit_name}-${index}`}
                            onClick={() => handleSelectPlant(plant)}
                            className="w-full px-3 py-2 text-left hover:bg-primary-50 border-b border-gray-50 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900 text-sm">{plant.plant_name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                              {plant.unit_name && <span>Unit: {plant.unit_name}</span>}
                              {plant.country_area && <span>• {plant.country_area}</span>}
                              {plant.capacity_mw && <span>• {plant.capacity_mw} MW</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Unit Name</label>
                    <input type="text" name="unit_name" value={formData.unit_name || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Capacity (MW)</label>
                      <input type="number" name="capacity_mw" value={formData.capacity_mw || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start Year</label>
                      <input type="number" name="start_year" value={formData.start_year || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Location (Coordinates)</label>
                    <input type="text" name="location_coordinates" value={formData.location_coordinates || ''} onChange={handleChange} placeholder="-6.123, 106.567" className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Owner</label>
                    <input type="text" name="owner" value={formData.owner || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Operational Status</label>
                    <select name="operational_status" value={formData.operational_status || ''} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500">
                      <option value="operating">Operating</option>
                      <option value="retired">Retired</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </>
              )}

              <h4 className="font-medium text-gray-700 pt-4">Lifetime Emissions</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">SOx (t)</label>
                  <input type="number" name="lifetime_sox_tonnes" value={formData.lifetime_sox_tonnes || ''} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">NOx (t)</label>
                  <input type="number" name="lifetime_nox_tonnes" value={formData.lifetime_nox_tonnes || ''} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">CO2 (t)</label>
                  <input type="number" name="lifetime_co2_tonnes" value={formData.lifetime_co2_tonnes || ''} onChange={handleChange} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'transaction' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Transaction Details</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Estimated Deal Size</label>
                  <input
                    type="number"
                    name="estimated_deal_size"
                    value={formData.estimated_deal_size || ''}
                    onChange={handleChange}
                    placeholder="50000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Currency</label>
                  <select
                    name="deal_currency"
                    value={formData.deal_currency || 'USD'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                  >
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Financial Mechanism</label>
                <input type="text" name="financial_mechanism" value={formData.financial_mechanism || ''} onChange={handleChange} placeholder="e.g., Concessional loan, Grant" className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Lender(s) / Funder(s)</label>
                <input type="text" name="lenders_funders" value={formData.lenders_funders || ''} onChange={handleChange} placeholder="e.g., World Bank, ADB" className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Transaction Confidence Rating</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    name="transaction_confidence_rating"
                    min="0"
                    max="100"
                    value={formData.transaction_confidence_rating || 0}
                    onChange={handleChange}
                    className="flex-1"
                  />
                  <span className={`text-lg font-bold min-w-[50px] text-right ${(formData.transaction_confidence_rating || 0) >= 70 ? 'text-emerald-600' :
                      (formData.transaction_confidence_rating || 0) >= 40 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                    {formData.transaction_confidence_rating || 0}%
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Planned Retirement Year</label>
                  <input type="number" name="planned_retirement_year" value={formData.planned_retirement_year || ''} onChange={handleChange} placeholder="2030" className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target Retirement Year</label>
                  <input type="number" name="actual_retirement_year" value={formData.actual_retirement_year || ''} onChange={handleChange} placeholder="2030" className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Post-Retirement Status</label>
                <input type="text" name="planned_post_retirement_status" value={formData.planned_post_retirement_status || ''} onChange={handleChange} placeholder="e.g., Solar + Storage" className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500" />
              </div>

              {/* Next Steps */}
              <div className="pt-4">
                <label className="block text-xs text-gray-500 mb-2">Next Steps</label>
                <div className="space-y-2 mb-2">
                  {nextSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={step.completed}
                        onChange={() => handleToggleNextStep(index)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600"
                      />
                      <span className={`flex-1 text-sm ${step.completed ? 'line-through text-gray-400' : ''}`}>{step.text}</span>
                      <button onClick={() => handleRemoveNextStep(index)} className="text-gray-400 hover:text-red-500">×</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newNextStep}
                    onChange={(e) => setNewNextStep(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNextStep())}
                    placeholder="Add next step..."
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                  />
                  <button onClick={handleAddNextStep} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded">Add</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stakeholders' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Stakeholders</h3>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Key Contacts</label>
                <textarea
                  name="key_contacts"
                  value={formData.key_contacts || ''}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Names, roles, emails..."
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Actors in Contact</label>
                <textarea
                  name="actors_in_contact"
                  value={formData.actors_in_contact || ''}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Organizations engaging with owner/government..."
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-2">Funded Delivery Partners</label>
                <div className="flex flex-wrap gap-2">
                  {DELIVERY_PARTNERS.map(partner => (
                    <button
                      key={partner}
                      type="button"
                      onClick={() => handlePartnerToggle(partner)}
                      className={`px-3 py-1.5 text-sm rounded border transition-colors ${formData.funded_delivery_partners?.includes(partner)
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                    >
                      {partner}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'related' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 border-b pb-2">Related Work</h3>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Related Work Link</label>
                <input
                  type="url"
                  name="related_work_link"
                  value={formData.related_work_link || ''}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Middle Column - Notes & Activities */}
        <div className="w-1/3 border-r border-gray-200 bg-white overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Notes & Activities</h3>
              <button
                onClick={() => setShowActivityForm(!showActivityForm)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showActivityForm
                    ? 'bg-gray-200 text-gray-700'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Note
              </button>
            </div>

            {/* Add Activity Form */}
            {showActivityForm && (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-4">
                {/* Activity Type Selection */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Source / Type</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ACTIVITY_TYPES.filter(t => t.id !== 'stage_change').map(type => (
                      <button
                        key={type.id}
                        onClick={() => setNewActivity(prev => ({ ...prev, type: type.id }))}
                        className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all text-xs ${newActivity.type === type.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        title={type.description}
                      >
                        <span className="text-lg mb-0.5">{type.icon}</span>
                        <span className="font-medium truncate w-full text-center">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject (optional) */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Subject (optional)</label>
                  <input
                    type="text"
                    value={newActivity.subject}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder={`e.g., Call with stakeholder, Meeting notes...`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* File Upload for Document Type */}
                {newActivity.type === 'document' && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Attachment</label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => setUploadFile(e.target.files[0])}
                      className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Upload documents related to this transaction (PDF, Docx, Images, etc.)
                    </p>
                  </div>
                )}

                {/* Description */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {newActivity.type === 'document' ? 'Description / Notes (optional)' : 'Details *'}
                  </label>
                  <textarea
                    value={newActivity.description}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter details..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddActivity}
                    disabled={(!newActivity.description.trim() && !uploadFile) || !transaction?.id}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Save Note
                  </button>
                  <button
                    onClick={() => {
                      setNewActivity({ type: 'note', subject: '', description: '' });
                      setUploadFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                      setShowActivityForm(false);
                      setShowActivityForm(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              <button
                onClick={() => setActivityFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activityFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                All
              </button>
              {ACTIVITY_TYPES.slice(0, 5).map(type => (
                <button
                  key={type.id}
                  onClick={() => setActivityFilter(type.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${activityFilter === type.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  <span>{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activities List */}
          <div className="flex-1 overflow-y-auto">
            {!transaction?.id ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-sm font-medium">Save the project first</p>
                <p className="text-xs">to start tracking activities</p>
              </div>
            ) : activities.filter(a => activityFilter === 'all' || a.activity_type === activityFilter).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-sm font-medium">No notes yet</p>
                <p className="text-xs">Add your first note to track communications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {activities
                  .filter(a => activityFilter === 'all' || a.activity_type === activityFilter)
                  .map((activity) => {
                    const activityType = ACTIVITY_TYPES.find(t => t.id === activity.activity_type) || ACTIVITY_TYPES[0];
                    return (
                      <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex gap-3">
                          {/* Activity Icon */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${activityType.color}`}>
                            <span className="text-lg">{activityType.icon}</span>
                          </div>

                          {/* Activity Content */}
                          <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-medium text-sm text-gray-900">
                                  {activity.title || activityType.label}
                                </span>
                                <span className="mx-1.5 text-gray-300">•</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${activityType.color}`}>
                                  {activityType.label}
                                </span>
                              </div>
                            </div>

                            {/* Description */}
                            {activity.description && (
                              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{activity.description}</p>
                            )}

                            {/* Document Attachment */}
                            {activity.metadata?.fileUrl && (
                              <a
                                href={activity.metadata.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 mt-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm group transition-all"
                              >
                                <div className="p-2 bg-primary-50 rounded text-primary-600 group-hover:bg-primary-100">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{activity.metadata.fileName}</p>
                                  <p className="text-xs text-gray-500">
                                    {activity.metadata.fileSize ? `${Math.round(activity.metadata.fileSize / 1024)} KB` : 'Document'}
                                    {activity.metadata.fileType ? ` • ${activity.metadata.fileType.split('/')[1]?.toUpperCase() || 'FILE'}` : ''}
                                  </p>
                                </div>
                                <div className="text-gray-400 group-hover:text-primary-600">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                </div>
                              </a>
                            )}

                            {/* Footer - Timestamp and Author */}
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {activity.created_at ? new Date(activity.created_at).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'Unknown date'}
                              </span>
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                {activity.created_by || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Insights */}
        <div className="w-1/3 bg-gray-50 overflow-y-auto p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Insights</h3>

          {/* Confidence Score */}
          <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
            <h4 className="text-sm text-gray-500 mb-2">Transaction Score</h4>
            <div className="flex items-end gap-3">
              <span className={`text-4xl font-bold ${(formData.transaction_confidence_rating || 0) >= 70 ? 'text-emerald-600' :
                  (formData.transaction_confidence_rating || 0) >= 40 ? 'text-amber-600' : 'text-red-600'
                }`}>
                {formData.transaction_confidence_rating || 0}
              </span>
              <div className="mb-1">
                <span className={`text-sm font-medium ${(formData.transaction_confidence_rating || 0) >= 70 ? 'text-emerald-600' :
                    (formData.transaction_confidence_rating || 0) >= 40 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                  {(formData.transaction_confidence_rating || 0) >= 70 ? 'Grade A' :
                    (formData.transaction_confidence_rating || 0) >= 40 ? 'Grade B' : 'Grade C'}
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  {activities.length > 0 ? 'Active' : 'New'}
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
            <h4 className="text-sm text-gray-500 mb-3">Key Metrics</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${formData.capacity_mw ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-700">
                  {formData.capacity_mw ? `${formData.capacity_mw} MW capacity` : 'Capacity not set'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${formData.estimated_deal_size ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-700">
                  {formData.estimated_deal_size
                    ? `$${(formData.estimated_deal_size / 1000000).toFixed(1)}M deal size`
                    : 'Deal size not set'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${formData.deal_timeframe ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-700">
                  {formData.deal_timeframe
                    ? `Closes ${new Date(formData.deal_timeframe).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
                    : 'Close date not set'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${formData.funded_delivery_partners?.length > 0 ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-700">
                  {formData.funded_delivery_partners?.length > 0
                    ? `${formData.funded_delivery_partners.length} delivery partner(s)`
                    : 'No delivery partners'}
                </span>
              </div>
            </div>
          </div>

          {/* Suggested Actions */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="text-sm text-gray-500 mb-3">Suggested Follow-ups</h4>
            <div className="space-y-2">
              {!formData.deal_timeframe && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 rounded text-sm">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-amber-800">Set expected close date</span>
                </div>
              )}
              {!formData.transaction_status && (
                <div className="flex items-start gap-2 p-2 bg-blue-50 rounded text-sm">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-blue-800">Update transaction status (RAG)</span>
                </div>
              )}
              {nextSteps.filter(s => !s.completed).length > 0 && (
                <div className="flex items-start gap-2 p-2 bg-purple-50 rounded text-sm">
                  <svg className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-purple-800">{nextSteps.filter(s => !s.completed).length} pending next step(s)</span>
                </div>
              )}
              {activities.length === 0 && transaction?.id && (
                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm">
                  <svg className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-gray-700">Add first activity note</span>
                </div>
              )}
              {formData.deal_timeframe && formData.transaction_status && nextSteps.filter(s => !s.completed).length === 0 && (
                <div className="flex items-start gap-2 p-2 bg-emerald-50 rounded text-sm">
                  <svg className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-emerald-800">All key fields completed!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetail;
