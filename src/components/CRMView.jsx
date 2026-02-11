import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import TransactionDetail from './TransactionDetail';

// Transaction stage definitions with colors
const TRANSACTION_STAGES = [
  { id: 'origination', label: 'Origination', color: 'bg-purple-100 border-purple-300 text-purple-800' },
  { id: 'scoping', label: 'Scoping', color: 'bg-blue-100 border-blue-300 text-blue-800' },
  { id: 'concept_note', label: 'Concept Note/Proposal', color: 'bg-cyan-100 border-cyan-300 text-cyan-800' },
  { id: 'agreement_signed', label: 'Agreement Signed', color: 'bg-yellow-100 border-yellow-300 text-yellow-800' },
  { id: 'in_delivery', label: 'In Delivery', color: 'bg-orange-100 border-orange-300 text-orange-800' },
  { id: 'transaction_complete', label: 'Transaction Complete', color: 'bg-emerald-100 border-emerald-300 text-emerald-800' },
  { id: 'on_hold', label: 'On Hold', color: 'bg-gray-100 border-gray-300 text-gray-600' },
  { id: 'cancelled', label: 'Cancelled', color: 'bg-red-100 border-red-300 text-red-800' },
];

// RAG status colors
const RAG_COLORS = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

// Country list for dropdown
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

// Delivery partners
const DELIVERY_PARTNERS = ['CSV', 'RMI', 'CT', 'CCSF', 'World Bank', 'ADB', 'IADB'];

const CRMView = ({ userEmail }) => {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' or 'list'
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPartner, setFilterPartner] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [draggedTransaction, setDraggedTransaction] = useState(null);

  // Fetch transactions from Supabase
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

  // Filter transactions based on search and filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = !searchTerm || 
        t.plant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.owner?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCountry = !filterCountry || t.country === filterCountry;
      const matchesStatus = !filterStatus || t.transaction_status === filterStatus;
      const matchesPartner = !filterPartner || 
        (t.funded_delivery_partners && t.funded_delivery_partners.includes(filterPartner));
      
      return matchesSearch && matchesCountry && matchesStatus && matchesPartner;
    });
  }, [transactions, searchTerm, filterCountry, filterStatus, filterPartner]);

  // Group transactions by stage for pipeline view
  const transactionsByStage = useMemo(() => {
    const grouped = {};
    TRANSACTION_STAGES.forEach(stage => {
      grouped[stage.id] = filteredTransactions.filter(t => t.transaction_stage === stage.id);
    });
    return grouped;
  }, [filteredTransactions]);

  // Handle drag and drop for pipeline view
  const handleDragStart = (e, transaction) => {
    setDraggedTransaction(transaction);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, newStage) => {
    e.preventDefault();
    if (!draggedTransaction || draggedTransaction.transaction_stage === newStage) {
      setDraggedTransaction(null);
      return;
    }

    // Optimistic update
    setTransactions(prev => prev.map(t => 
      t.id === draggedTransaction.id ? { ...t, transaction_stage: newStage } : t
    ));

    // Update in database
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ transaction_stage: newStage })
        .eq('id', draggedTransaction.id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating transaction stage:', error);
      // Revert on error
      fetchTransactions();
    }

    setDraggedTransaction(null);
  };

  // Create new transaction
  const handleCreateTransaction = () => {
    setSelectedTransaction(null);
    setIsCreating(true);
  };

  // Save transaction (create or update)
  const handleSaveTransaction = async (transactionData) => {
    try {
      if (transactionData.id) {
        // Update existing
        const { error } = await supabase
          .from('transactions')
          .update(transactionData)
          .eq('id', transactionData.id);
        
        if (error) throw error;
      } else {
        // Create new
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

  // Delete transaction
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

  // Get unique countries from transactions for filter
  const uniqueCountries = useMemo(() => {
    const countries = [...new Set(transactions.map(t => t.country).filter(Boolean))];
    return countries.sort();
  }, [transactions]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const total = filteredTransactions.length;
    const totalValue = filteredTransactions.reduce((sum, t) => sum + (t.estimated_deal_size || 0), 0);
    const avgConfidence = filteredTransactions.length > 0
      ? filteredTransactions.reduce((sum, t) => sum + (t.transaction_confidence_rating || 0), 0) / filteredTransactions.length
      : 0;
    const greenCount = filteredTransactions.filter(t => t.transaction_status === 'green').length;
    const amberCount = filteredTransactions.filter(t => t.transaction_status === 'amber').length;
    const redCount = filteredTransactions.filter(t => t.transaction_status === 'red').length;
    
    return { total, totalValue, avgConfidence, greenCount, amberCount, redCount };
  }, [filteredTransactions]);

  // Render transaction card
  const TransactionCard = ({ transaction }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, transaction)}
      onClick={() => setSelectedTransaction(transaction)}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate text-sm">
            {transaction.project_name || transaction.plant_name || 'Unnamed Project'}
          </h4>
          {transaction.project_name && transaction.plant_name && (
            <p className="text-xs text-gray-500 truncate">{transaction.plant_name}</p>
          )}
        </div>
        {transaction.transaction_status && (
          <div className={`w-3 h-3 rounded-full ${RAG_COLORS[transaction.transaction_status]} flex-shrink-0 ml-2`} 
               title={`Status: ${transaction.transaction_status.toUpperCase()}`} />
        )}
      </div>

      {/* Details */}
      <div className="space-y-1 text-xs text-gray-600">
        {transaction.country && (
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{transaction.country}</span>
          </div>
        )}
        {transaction.capacity_mw && (
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>{transaction.capacity_mw} MW</span>
          </div>
        )}
        {transaction.estimated_deal_size && (
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>${(transaction.estimated_deal_size / 1000000).toFixed(1)}M</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
        {transaction.transaction_confidence_rating !== null && (
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  transaction.transaction_confidence_rating >= 70 ? 'bg-emerald-500' :
                  transaction.transaction_confidence_rating >= 40 ? 'bg-amber-500' : 'bg-red-500'
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
    </div>
  );

  if (selectedTransaction || isCreating) {
    return (
      <TransactionDetail
        transaction={selectedTransaction}
        onSave={handleSaveTransaction}
        onDelete={handleDeleteTransaction}
        onClose={() => { setSelectedTransaction(null); setIsCreating(false); }}
        countries={COUNTRIES}
        deliveryPartners={DELIVERY_PARTNERS}
        stages={TRANSACTION_STAGES}
      />
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transaction Pipeline</h1>
            <p className="text-sm text-gray-500 mt-1">Track coal transition projects from origination to completion</p>
          </div>
          <button
            onClick={handleCreateTransaction}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Transaction
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-6 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-xl font-bold text-gray-900">{summaryStats.total}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Pipeline Value</p>
            <p className="text-xl font-bold text-gray-900">${(summaryStats.totalValue / 1000000).toFixed(1)}M</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Confidence</p>
            <p className="text-xl font-bold text-gray-900">{summaryStats.avgConfidence.toFixed(0)}%</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3">
            <p className="text-xs text-emerald-600 uppercase tracking-wide">On Track</p>
            <p className="text-xl font-bold text-emerald-700">{summaryStats.greenCount}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <p className="text-xs text-amber-600 uppercase tracking-wide">At Risk</p>
            <p className="text-xl font-bold text-amber-700">{summaryStats.amberCount}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-xs text-red-600 uppercase tracking-wide">Blocked</p>
            <p className="text-xl font-bold text-red-700">{summaryStats.redCount}</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by plant, project, or owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters || filterCountry || filterStatus || filterPartner
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {(filterCountry || filterStatus || filterPartner) && (
              <span className="bg-primary-600 text-white text-xs rounded-full px-2 py-0.5">
                {[filterCountry, filterStatus, filterPartner].filter(Boolean).length}
              </span>
            )}
          </button>

          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                viewMode === 'pipeline' ? 'bg-primary-600 text-white' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Pipeline
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 flex items-center gap-2 transition-colors ${
                viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-white hover:bg-gray-50'
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
          <div className="flex items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Country</label>
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Countries</option>
                {uniqueCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Status (RAG)</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Statuses</option>
                <option value="green">🟢 On Track</option>
                <option value="amber">🟠 At Risk</option>
                <option value="red">🔴 Blocked</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Delivery Partner</label>
              <select
                value={filterPartner}
                onChange={(e) => setFilterPartner(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Partners</option>
                {DELIVERY_PARTNERS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => { setFilterCountry(''); setFilterStatus(''); setFilterPartner(''); }}
              className="text-sm text-gray-500 hover:text-gray-700 underline self-end pb-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : viewMode === 'pipeline' ? (
        /* Pipeline View */
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 min-w-max h-full">
            {TRANSACTION_STAGES.map(stage => (
              <div
                key={stage.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
                className="w-80 flex-shrink-0 flex flex-col bg-gray-100 rounded-lg"
              >
                {/* Column Header */}
                <div className={`px-4 py-3 border-b-2 ${stage.color.replace('bg-', 'border-').replace('-100', '-400')}`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`font-semibold text-sm ${stage.color.split(' ')[2]}`}>{stage.label}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${stage.color}`}>
                      {transactionsByStage[stage.id]?.length || 0}
                    </span>
                  </div>
                </div>
                
                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {transactionsByStage[stage.id]?.map(transaction => (
                    <TransactionCard key={transaction.id} transaction={transaction} />
                  ))}
                  {transactionsByStage[stage.id]?.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No transactions
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Project / Plant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Country</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Capacity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deal Size</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Close Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransactions.map(transaction => {
                  const stage = TRANSACTION_STAGES.find(s => s.id === transaction.transaction_stage);
                  return (
                    <tr 
                      key={transaction.id} 
                      onClick={() => setSelectedTransaction(transaction)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{transaction.project_name || transaction.plant_name}</p>
                          {transaction.project_name && transaction.plant_name && (
                            <p className="text-sm text-gray-500">{transaction.plant_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{transaction.country || '-'}</td>
                      <td className="px-4 py-3">
                        {stage && (
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${stage.color}`}>
                            {stage.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {transaction.transaction_status && (
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${RAG_COLORS[transaction.transaction_status]}`} />
                            <span className="text-sm capitalize">{transaction.transaction_status}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {transaction.capacity_mw ? `${transaction.capacity_mw} MW` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {transaction.estimated_deal_size 
                          ? `$${(transaction.estimated_deal_size / 1000000).toFixed(1)}M` 
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {transaction.transaction_confidence_rating !== null && (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  transaction.transaction_confidence_rating >= 70 ? 'bg-emerald-500' :
                                  transaction.transaction_confidence_rating >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${transaction.transaction_confidence_rating}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{transaction.transaction_confidence_rating}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {transaction.deal_timeframe 
                          ? new Date(transaction.deal_timeframe).toLocaleDateString('en-GB')
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      {transactions.length === 0 
                        ? 'No transactions yet. Click "New Transaction" to create one.'
                        : 'No transactions match your filters.'}
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
