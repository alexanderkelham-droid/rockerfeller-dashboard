import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import TransactionDetail from './TransactionDetail';

// Project stage definitions - CATA PMO pipeline stages
const PROJECT_STAGES = [
  { id: 'ideation', label: 'Ideation', color: 'border-l-slate-400', bgColor: 'bg-slate-50', textColor: 'text-slate-700', description: 'Initial project concept identification' },
  { id: 'screening', label: 'Screening', color: 'border-l-indigo-500', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700', description: 'Preliminary assessment and viability check' },
  { id: 'pre_feasibility', label: 'Pre-Feasibility', color: 'border-l-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700', description: 'Initial technical and financial analysis' },
  { id: 'full_feasibility', label: 'Full Feasibility', color: 'border-l-cyan-500', bgColor: 'bg-cyan-50', textColor: 'text-cyan-700', description: 'Comprehensive feasibility study' },
  { id: 'deal_structuring', label: 'Deal Structuring', color: 'border-l-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700', description: 'Financial and legal structuring' },
  { id: 'closing', label: 'Closing', color: 'border-l-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700', description: 'Final negotiations and agreement signing' },
  { id: 'transaction_complete', label: 'Transaction Complete', color: 'border-l-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', description: 'Successfully closed transaction' },
];

// Engagement status - Pipeline columns (reordered for workflow)
const ENGAGEMENT_STATUSES = [
  { id: 'no_engagement', label: 'No Engagement', color: 'bg-gray-400', bgColor: 'bg-gray-50', textColor: 'text-gray-700', borderColor: 'border-l-gray-400', description: 'Not yet engaged with stakeholders' },
  { id: 'concept_proposal', label: 'Concept/Proposal Development', color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-l-blue-500', description: 'Developing project concept and proposal' },
  { id: 'in_delivery', label: 'In Delivery', color: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-l-amber-500', description: 'Active delivery and implementation' },
  { id: 'completed', label: 'Completed', color: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-l-emerald-500', description: 'Successfully completed engagement' },
];

// RAG status colors (project health indicator)
const RAG_COLORS = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  closed: 'bg-gray-500',
};

// Delivery partners - CATA ecosystem
const DELIVERY_PARTNERS = ['CSV', 'RMI', 'CT', 'CCSF', 'World Bank', 'ADB', 'IADB', 'IFC', 'EBRD', 'CIF', 'GCF', 'AFC'];

// Priority levels for projects
const PRIORITY_LEVELS = [
  { id: 'critical', label: 'Critical', color: 'bg-red-500' },
  { id: 'high', label: 'High', color: 'bg-orange-500' },
  { id: 'medium', label: 'Medium', color: 'bg-amber-500' },
  { id: 'low', label: 'Low', color: 'bg-green-500' },
];

const CRMView = ({ userEmail }) => {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('pipeline');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPartner, setFilterPartner] = useState('');
  const [filterEngagement, setFilterEngagement] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [draggedTransaction, setDraggedTransaction] = useState(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Exclude closed/completed projects from active pipeline view
      if (t.transaction_stage === 'closed' || t.transaction_stage === 'transaction_complete') return false;
      
      const matchesSearch = !searchTerm || 
        t.plant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.owner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCountry = !filterCountry || t.country === filterCountry;
      const matchesStatus = !filterStatus || t.transaction_status === filterStatus;
      const matchesPartner = !filterPartner || 
        (t.funded_delivery_partners && t.funded_delivery_partners.includes(filterPartner));
      const matchesEngagement = !filterEngagement || t.engagement_status === filterEngagement;
      const matchesPriority = !filterPriority || t.priority === filterPriority;
      
      return matchesSearch && matchesCountry && matchesStatus && matchesPartner && matchesEngagement && matchesPriority;
    });
  }, [transactions, searchTerm, filterCountry, filterStatus, filterPartner, filterEngagement, filterPriority]);

  const transactionsByStage = useMemo(() => {
    const grouped = {};
    PROJECT_STAGES.forEach(stage => {
      grouped[stage.id] = filteredTransactions.filter(t => t.transaction_stage === stage.id);
    });
    return grouped;
  }, [filteredTransactions]);

  // Group transactions by engagement status for pipeline view
  const transactionsByEngagement = useMemo(() => {
    const grouped = {};
    ENGAGEMENT_STATUSES.forEach(engagement => {
      grouped[engagement.id] = filteredTransactions.filter(t => t.engagement_status === engagement.id);
    });
    return grouped;
  }, [filteredTransactions]);

  const handleDragStart = (e, transaction) => {
    setDraggedTransaction(transaction);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, newEngagement) => {
    e.preventDefault();
    if (!draggedTransaction || draggedTransaction.engagement_status === newEngagement) {
      setDraggedTransaction(null);
      return;
    }

    setTransactions(prev => prev.map(t => 
      t.id === draggedTransaction.id ? { ...t, engagement_status: newEngagement } : t
    ));

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ engagement_status: newEngagement })
        .eq('id', draggedTransaction.id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating engagement status:', error);
      fetchTransactions();
    }

    setDraggedTransaction(null);
  };

  const handleCreateTransaction = () => {
    setSelectedTransaction(null);
    setIsCreating(true);
  };

  const handleSaveTransaction = async (transactionData) => {
    try {
      if (transactionData.id) {
        const { error } = await supabase
          .from('transactions')
          .update(transactionData)
          .eq('id', transactionData.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert([{ ...transactionData, created_by: userEmail }]);
        
        if (error) throw error;
      }
      
      await fetchTransactions();
      setSelectedTransaction(null);
      setIsCreating(false);
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Error saving transaction: ' + error.message);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      await fetchTransactions();
      setSelectedTransaction(null);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const uniqueCountries = useMemo(() => {
    const countries = [...new Set(transactions.map(t => t.country).filter(Boolean))];
    return countries.sort();
  }, [transactions]);

  const summaryStats = useMemo(() => {
    const total = filteredTransactions.length;
    const totalValue = filteredTransactions.reduce((sum, t) => sum + (t.estimated_deal_size || 0), 0);
    const totalCapacity = filteredTransactions.reduce((sum, t) => sum + (parseFloat(t.capacity_mw) || 0), 0);
    const avgConfidence = filteredTransactions.length > 0
      ? filteredTransactions.reduce((sum, t) => sum + (t.transaction_confidence_rating || 0), 0) / filteredTransactions.length
      : 0;
    const greenCount = filteredTransactions.filter(t => t.transaction_status === 'green').length;
    const amberCount = filteredTransactions.filter(t => t.transaction_status === 'amber').length;
    const redCount = filteredTransactions.filter(t => t.transaction_status === 'red').length;
    const inDelivery = filteredTransactions.filter(t => t.engagement_status === 'in_delivery').length;
    const uniqueCountries = new Set(filteredTransactions.map(t => t.country).filter(Boolean)).size;
    
    return { total, totalValue, totalCapacity, avgConfidence, greenCount, amberCount, redCount, inDelivery, uniqueCountries };
  }, [filteredTransactions]);

  // Project card component with enhanced CATA features
  const ProjectCard = ({ transaction }) => {
    const stage = PROJECT_STAGES.find(s => s.id === transaction.transaction_stage);
    const engagement = ENGAGEMENT_STATUSES.find(e => e.id === transaction.engagement_status);
    const hasNotes = transaction.notes && transaction.notes.trim().length > 0;
    
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, transaction)}
        onClick={() => setSelectedTransaction(transaction)}
        className={`bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-lg transition-all duration-200 border-l-4 ${engagement?.borderColor || 'border-l-gray-300'}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 truncate">
              {transaction.project_name || transaction.plant_name || 'Unnamed Project'}
            </h4>
            {transaction.project_name && transaction.plant_name && (
              <p className="text-sm text-gray-500 truncate mt-0.5">{transaction.plant_name}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {hasNotes && (
              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            )}
            {transaction.transaction_status && (
              <div className={`w-2.5 h-2.5 rounded-full ${RAG_COLORS[transaction.transaction_status]}`} title={transaction.transaction_status === 'green' ? 'On Track' : transaction.transaction_status === 'amber' ? 'At Risk' : 'Blocked'} />
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          {transaction.country && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">📍</span>
              <span>{transaction.country}</span>
            </div>
          )}
          
          {/* Project Stage Badge (e.g., Pre-Feasibility, Full Feasibility) */}
          {stage && (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-xs rounded-full ${stage.bgColor} ${stage.textColor} font-medium`}>
                {stage.label}
              </span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            {transaction.capacity_mw && (
              <span className="text-gray-500">{transaction.capacity_mw} MW</span>
            )}
            {transaction.estimated_deal_size && (
              <span className="font-medium text-gray-700">${(transaction.estimated_deal_size / 1000000).toFixed(1)}M</span>
            )}
          </div>
        </div>

        {(transaction.transaction_confidence_rating !== null || transaction.deal_timeframe) && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            {transaction.transaction_confidence_rating !== null && (
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      transaction.transaction_confidence_rating >= 70 ? 'bg-emerald-500' :
                      transaction.transaction_confidence_rating >= 40 ? 'bg-amber-500' : 'bg-red-400'
                    }`}
                    style={{ width: `${transaction.transaction_confidence_rating}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{transaction.transaction_confidence_rating}%</span>
              </div>
            )}
            {transaction.deal_timeframe && (
              <span className="text-xs text-gray-400">
                {new Date(transaction.deal_timeframe).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        )}
        
        {/* Quick notes preview */}
        {hasNotes && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 line-clamp-2 italic">{transaction.notes}</p>
          </div>
        )}
      </div>
    );
  };

  if (selectedTransaction || isCreating) {
    return (
      <TransactionDetail
        transaction={selectedTransaction}
        onSave={handleSaveTransaction}
        onDelete={handleDeleteTransaction}
        onClose={() => { setSelectedTransaction(null); setIsCreating(false); }}
        userEmail={userEmail}
      />
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Project Pipeline</h1>
              <p className="text-sm text-gray-500 mt-0.5">CATA PMO - Track coal retirement projects from ideation to transaction complete</p>
            </div>
            <button
              onClick={handleCreateTransaction}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </button>
          </div>
        </div>

        {/* Stats Bar - Enhanced CATA metrics */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Projects:</span>
              <span className="font-semibold text-gray-900">{summaryStats.total}</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Capacity:</span>
              <span className="font-semibold text-gray-900">{summaryStats.totalCapacity.toLocaleString()} MW</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Pipeline Value:</span>
              <span className="font-semibold text-gray-900">${(summaryStats.totalValue / 1000000).toFixed(1)}M</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Countries:</span>
              <span className="font-semibold text-gray-900">{summaryStats.uniqueCountries}</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-gray-500">In Delivery:</span>
              <span className="font-semibold text-emerald-600">{summaryStats.inDelivery}</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5" title="On Track">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-gray-600">{summaryStats.greenCount}</span>
              </div>
              <div className="flex items-center gap-1.5" title="At Risk">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-gray-600">{summaryStats.amberCount}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Blocked">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-gray-600">{summaryStats.redCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="px-6 pb-4 flex items-center gap-3">
          <div className="flex-1 relative max-w-md">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search projects, plants, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm ${
              showFilters || filterCountry || filterStatus || filterPartner || filterEngagement || filterPriority
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {(filterCountry || filterStatus || filterPartner || filterEngagement || filterPriority) && (
              <span className="bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {[filterCountry, filterStatus, filterPartner, filterEngagement, filterPriority].filter(Boolean).length}
              </span>
            )}
          </button>

          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-3 py-2 flex items-center gap-1.5 transition-colors text-sm ${
                viewMode === 'pipeline' ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50 text-gray-600'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 flex items-center gap-1.5 transition-colors text-sm ${
                viewMode === 'list' ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50 text-gray-600'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </button>
          </div>
        </div>

        {/* Filter dropdowns */}
        {showFilters && (
          <div className="px-6 pb-4">
            <div className="flex items-end gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Country</label>
                <select
                  value={filterCountry}
                  onChange={(e) => setFilterCountry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  <option value="">All Countries</option>
                  {uniqueCountries.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">RAG Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="green">On Track</option>
                  <option value="amber">At Risk</option>
                  <option value="red">Blocked</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Engagement</label>
                <select
                  value={filterEngagement}
                  onChange={(e) => setFilterEngagement(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  <option value="">All Engagements</option>
                  {ENGAGEMENT_STATUSES.map(e => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Delivery Partner</label>
                <select
                  value={filterPartner}
                  onChange={(e) => setFilterPartner(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  <option value="">All Partners</option>
                  {DELIVERY_PARTNERS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => { setFilterCountry(''); setFilterStatus(''); setFilterPartner(''); setFilterEngagement(''); setFilterPriority(''); }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
        </div>
      ) : viewMode === 'pipeline' ? (
        /* Pipeline View - Engagement Status Columns */
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-3 min-w-max h-full">
            {ENGAGEMENT_STATUSES.map(engagement => (
              <div
                key={engagement.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, engagement.id)}
                className="w-80 flex-shrink-0 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm"
              >
                {/* Column Header */}
                <div className={`px-4 py-3 border-b border-gray-100 ${engagement.bgColor} rounded-t-xl`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`font-medium text-sm ${engagement.textColor}`}>{engagement.label}</h3>
                      {engagement.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{engagement.description}</p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 ${engagement.textColor}`}>
                      {transactionsByEngagement[engagement.id]?.length || 0}
                    </span>
                  </div>
                </div>
                
                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {transactionsByEngagement[engagement.id]?.map(transaction => (
                    <ProjectCard key={transaction.id} transaction={transaction} />
                  ))}
                  {transactionsByEngagement[engagement.id]?.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-sm">
                      No projects
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* List View - Enhanced table */
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engagement</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RAG</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deal Size</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTransactions.map(transaction => {
                  const stage = PROJECT_STAGES.find(s => s.id === transaction.transaction_stage);
                  const engagement = ENGAGEMENT_STATUSES.find(e => e.id === transaction.engagement_status);
                  return (
                    <tr 
                      key={transaction.id} 
                      onClick={() => setSelectedTransaction(transaction)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{transaction.project_name || transaction.plant_name}</p>
                          {transaction.project_name && transaction.plant_name && (
                            <p className="text-xs text-gray-500">{transaction.plant_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{transaction.country || '—'}</td>
                      <td className="px-4 py-3">
                        {stage && (
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${stage.bgColor} ${stage.textColor}`}>
                            {stage.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {engagement && (
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded text-white ${engagement.color}`}>
                            {engagement.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {transaction.transaction_status && (
                          <div className={`w-2.5 h-2.5 rounded-full ${RAG_COLORS[transaction.transaction_status]}`} title={transaction.transaction_status === 'green' ? 'On Track' : transaction.transaction_status === 'amber' ? 'At Risk' : 'Blocked'} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {transaction.capacity_mw ? `${transaction.capacity_mw} MW` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {transaction.estimated_deal_size 
                          ? `$${(transaction.estimated_deal_size / 1000000).toFixed(1)}M` 
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {transaction.deal_timeframe 
                          ? new Date(transaction.deal_timeframe).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {transaction.notes && (
                          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                          </svg>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-gray-500">
                      {transactions.length === 0 
                        ? 'No projects yet. Click "New Project" to get started.'
                        : 'No projects match your filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMView;
