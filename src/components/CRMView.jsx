import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import TransactionDetail from './TransactionDetail';

// Transaction stage definitions with colors - more professional palette
const TRANSACTION_STAGES = [
  { id: 'origination', label: 'Origination', color: 'border-l-indigo-500', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700' },
  { id: 'scoping', label: 'Scoping', color: 'border-l-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  { id: 'concept_note', label: 'Concept Note', color: 'border-l-cyan-500', bgColor: 'bg-cyan-50', textColor: 'text-cyan-700' },
  { id: 'agreement_signed', label: 'Agreement Signed', color: 'border-l-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  { id: 'in_delivery', label: 'In Delivery', color: 'border-l-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
  { id: 'transaction_complete', label: 'Complete', color: 'border-l-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
  { id: 'on_hold', label: 'On Hold', color: 'border-l-gray-400', bgColor: 'bg-gray-50', textColor: 'text-gray-600' },
  { id: 'cancelled', label: 'Cancelled', color: 'border-l-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700' },
];

// RAG status colors
const RAG_COLORS = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  closed: 'bg-gray-500',
};

// Delivery partners
const DELIVERY_PARTNERS = ['CSV', 'RMI', 'CT', 'CCSF', 'World Bank', 'ADB', 'IADB'];

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
      // Exclude closed transactions from pipeline
      if (t.transaction_stage === 'closed') return false;
      
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

  const transactionsByStage = useMemo(() => {
    const grouped = {};
    TRANSACTION_STAGES.forEach(stage => {
      grouped[stage.id] = filteredTransactions.filter(t => t.transaction_stage === stage.id);
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

  const handleDrop = async (e, newStage) => {
    e.preventDefault();
    if (!draggedTransaction || draggedTransaction.transaction_stage === newStage) {
      setDraggedTransaction(null);
      return;
    }

    setTransactions(prev => prev.map(t => 
      t.id === draggedTransaction.id ? { ...t, transaction_stage: newStage } : t
    ));

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ transaction_stage: newStage })
        .eq('id', draggedTransaction.id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating transaction stage:', error);
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
    const avgConfidence = filteredTransactions.length > 0
      ? filteredTransactions.reduce((sum, t) => sum + (t.transaction_confidence_rating || 0), 0) / filteredTransactions.length
      : 0;
    const greenCount = filteredTransactions.filter(t => t.transaction_status === 'green').length;
    const amberCount = filteredTransactions.filter(t => t.transaction_status === 'amber').length;
    const redCount = filteredTransactions.filter(t => t.transaction_status === 'red').length;
    
    return { total, totalValue, avgConfidence, greenCount, amberCount, redCount };
  }, [filteredTransactions]);

  // Professional transaction card
  const TransactionCard = ({ transaction }) => {
    const stage = TRANSACTION_STAGES.find(s => s.id === transaction.transaction_stage);
    
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, transaction)}
        onClick={() => setSelectedTransaction(transaction)}
        className={`bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-lg transition-all duration-200 border-l-4 ${stage?.color || 'border-l-gray-300'}`}
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
          {transaction.transaction_status && (
            <div className={`w-2.5 h-2.5 rounded-full ${RAG_COLORS[transaction.transaction_status]} flex-shrink-0 ml-2 mt-1`} />
          )}
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          {transaction.country && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">📍</span>
              <span>{transaction.country}</span>
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
              <h1 className="text-xl font-semibold text-gray-900">Pipeline</h1>
              <p className="text-sm text-gray-500 mt-0.5">Track coal transition projects from origination to completion</p>
            </div>
            <button
              onClick={handleCreateTransaction}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Transaction
            </button>
          </div>
        </div>

        {/* Stats Bar - Cleaner design */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Total:</span>
              <span className="font-semibold text-gray-900">{summaryStats.total}</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Pipeline Value:</span>
              <span className="font-semibold text-gray-900">${(summaryStats.totalValue / 1000000).toFixed(1)}M</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Avg Confidence:</span>
              <span className="font-semibold text-gray-900">{summaryStats.avgConfidence.toFixed(0)}%</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-gray-600">{summaryStats.greenCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-gray-600">{summaryStats.amberCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
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
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm ${
              showFilters || filterCountry || filterStatus || filterPartner
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {(filterCountry || filterStatus || filterPartner) && (
              <span className="bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {[filterCountry, filterStatus, filterPartner].filter(Boolean).length}
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
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
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
                onClick={() => { setFilterCountry(''); setFilterStatus(''); setFilterPartner(''); }}
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
        /* Pipeline View - Cleaner columns */
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-3 min-w-max h-full">
            {TRANSACTION_STAGES.slice(0, 6).map(stage => (
              <div
                key={stage.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
                className="w-72 flex-shrink-0 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm"
              >
                {/* Column Header */}
                <div className={`px-4 py-3 border-b border-gray-100 ${stage.bgColor} rounded-t-xl`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`font-medium text-sm ${stage.textColor}`}>{stage.label}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 ${stage.textColor}`}>
                      {transactionsByStage[stage.id]?.length || 0}
                    </span>
                  </div>
                </div>
                
                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {transactionsByStage[stage.id]?.map(transaction => (
                    <TransactionCard key={transaction.id} transaction={transaction} />
                  ))}
                  {transactionsByStage[stage.id]?.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-sm">
                      No transactions
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* List View - Cleaner table */
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deal Size</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Close Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTransactions.map(transaction => {
                  const stage = TRANSACTION_STAGES.find(s => s.id === transaction.transaction_stage);
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
                        {transaction.transaction_status && (
                          <div className={`w-2.5 h-2.5 rounded-full ${RAG_COLORS[transaction.transaction_status]}`} />
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
                      <td className="px-4 py-3">
                        {transaction.transaction_confidence_rating !== null && (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  transaction.transaction_confidence_rating >= 70 ? 'bg-emerald-500' :
                                  transaction.transaction_confidence_rating >= 40 ? 'bg-amber-500' : 'bg-red-400'
                                }`}
                                style={{ width: `${transaction.transaction_confidence_rating}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{transaction.transaction_confidence_rating}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {transaction.deal_timeframe 
                          ? new Date(transaction.deal_timeframe).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-gray-500">
                      {transactions.length === 0 
                        ? 'No transactions yet. Click "New Transaction" to get started.'
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
