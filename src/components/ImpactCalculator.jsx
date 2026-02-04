import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

// Helper to normalize data from Supabase to expected format
const normalizeImpactResult = (row) => ({
  ...row,
  'GEM Unique ID': row.gem_unique_id,
  'Unique plant name': row.unique_plant_name,
  'Unit name': row.unit_name,
  'Location': row.location,
  'Total avoided CO2 emissions (Mt)': row.total_avoided_co2_emissions_mt,
  'Total avoided deaths': row.total_avoided_deaths,
  'Total avoided Work Loss Days (WLDs)': row.total_avoided_work_loss_days_wlds,
  'Total investment (mn. USD)': row.total_investment_mn_usd,
  'Economic spillover (mn. USD)': row.economic_spillover_mn_usd,
  'Net permanent jobs created': row.net_permanent_jobs_created,
  'Total temporary jobs created': row.total_temporary_jobs_created,
  'Annual customer savings (mn USD)': row.annual_customer_savings_mn_usd,
  'Savings per kWh (%)': row.savings_per_kwh,
});

const normalizeAnnualData = (row) => ({
  ...row,
  'GEM Unique ID': row.gem_unique_id,
  'Unique plant name': row.unique_plant_name,
  'Unit name': row.unit_name,
  'Location': row.location,
  'Planned Retirement Year': row.planned_retirement_year,
  'Annual avoided CO2 emissions (Mt)': row.annual_avoided_co2_emissions_mt,
  'Annual avoided deaths': row.annual_avoided_deaths,
  'Annual avoided Work Loss Days (WLDs)': row.annual_avoided_work_loss_days_wlds,
  'Total investment (mn. USD)': row.total_investment_mn_usd,
  'Economic spillover (mn. USD)': row.economic_spillover_mn_usd,
  'Net permanent jobs created': row.net_permanent_jobs_created,
  'Total temporary jobs created': row.total_temporary_jobs_created,
  'Annual customer savings (mn USD)': row.annual_customer_savings_mn_usd,
  'Savings per kWh (%)': row.savings_per_kwh,
});

const ImpactCalculator = () => {
  const [impactResults, setImpactResults] = useState([]);
  const [annualData, setAnnualData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [sortBy, setSortBy] = useState('co2');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'plants', 'comparison', 'explorer'
  
  // Interactive explorer states
  const [selectedPlantForExplorer, setSelectedPlantForExplorer] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('co2');
  const [adjustedRetirementYear, setAdjustedRetirementYear] = useState(null);
  
  // Degradation assumptions
  const [efficiencyDegradation, setEfficiencyDegradation] = useState(0.4); // % per year
  const [capacityDegradation, setCapacityDegradation] = useState(0.8); // % per year
  const [enableDegradation, setEnableDegradation] = useState(true);
  
  // Country default retirement assumptions (years from now if not specified)
  const countryRetirementDefaults = {
    'Philippines': 35,
    'Thailand': 35,
    'Laos': 30,
    'Turkiye': 35,
    'Turkey': 35 // Alternative spelling
  };

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      // Fetch impact results summary
      const { data: impactResultsData, error: impactError } = await supabase
        .from('impact_results_v0')
        .select('*');
      if (impactError) {
        console.error('Error loading impact results from Supabase:', impactError);
      } else {
        // Normalize column names for compatibility
        setImpactResults((impactResultsData || []).map(normalizeImpactResult));
      }
      // Fetch annual impact data
      const { data: annualDataData, error: annualError } = await supabase
        .from('impact_results_v1_annual')
        .select('*');
      if (annualError) {
        console.error('Error loading annual impact data from Supabase:', annualError);
      } else {
        // Normalize column names for compatibility
        setAnnualData((annualDataData || []).map(normalizeAnnualData));
      }
      setIsLoading(false);
    }
    fetchData();
  }, []);

  // Calculate aggregated statistics
  const statistics = useMemo(() => {
    if (impactResults.length === 0) return null;

    const filtered = selectedCountry === 'all' 
      ? impactResults 
      : impactResults.filter(r => r['Location'] === selectedCountry);

    // Group by plant to avoid double-counting
    const plantMap = new Map();
    filtered.forEach(result => {
      const plantName = result['Unique plant name'];
      if (!plantMap.has(plantName)) {
        plantMap.set(plantName, []);
      }
      plantMap.get(plantName).push(result);
    });

    const totals = {
      totalPlants: plantMap.size,
      totalUnits: filtered.length,
      co2: 0,
      deaths: 0,
      wlds: 0,
      investment: 0,
      spillover: 0,
      permJobs: 0,
      tempJobs: 0,
      savings: 0,
    };

    filtered.forEach(result => {
      totals.co2 += parseFloat(result['Total avoided CO2 emissions (Mt)']) || 0;
      totals.deaths += parseInt(result['Total avoided deaths']?.replace(/,/g, '')) || 0;
      totals.wlds += parseInt(result['Total avoided Work Loss Days (WLDs)']?.replace(/,/g, '')) || 0;
      totals.investment += parseFloat(result['Total investment (mn. USD)']?.replace(/[$,]/g, '')) || 0;
      totals.spillover += parseFloat(result['Economic spillover (mn. USD)']?.replace(/[$,]/g, '')) || 0;
      totals.permJobs += parseInt(result['Net permanent jobs created']?.replace(/,/g, '')) || 0;
      totals.tempJobs += parseInt(result['Total temporary jobs created']?.replace(/,/g, '')) || 0;
      totals.savings += parseFloat(result['Annual customer savings (mn USD)']?.replace(/[$,]/g, '')) || 0;
    });

    return totals;
  }, [impactResults, selectedCountry]);

  // Get unique countries
  const countries = useMemo(() => {
    const countrySet = new Set(impactResults.map(r => r['Location']).filter(Boolean));
    return Array.from(countrySet).sort();
  }, [impactResults]);

  // Get country-level data for charts
  const countryData = useMemo(() => {
    if (impactResults.length === 0) return [];

    const countryMap = new Map();
    
    impactResults.forEach(result => {
      const country = result['Location'];
      if (!country) return;

      if (!countryMap.has(country)) {
        countryMap.set(country, {
          country,
          plants: new Set(),
          co2: 0,
          deaths: 0,
          investment: 0,
          savings: 0,
        });
      }

      const data = countryMap.get(country);
      data.plants.add(result['Unique plant name']);
      data.co2 += parseFloat(result['Total avoided CO2 emissions (Mt)']) || 0;
      data.deaths += parseInt(result['Total avoided deaths']?.replace(/,/g, '')) || 0;
      data.investment += parseFloat(result['Total investment (mn. USD)']?.replace(/[$,]/g, '')) || 0;
      data.savings += parseFloat(result['Annual customer savings (mn USD)']?.replace(/[$,]/g, '')) || 0;
    });

    return Array.from(countryMap.values()).map(d => ({
      ...d,
      plantCount: d.plants.size
    })).sort((a, b) => b.co2 - a.co2);
  }, [impactResults]);

  // Get top plants by selected metric
  const topPlants = useMemo(() => {
    if (impactResults.length === 0) return [];

    const plantMap = new Map();
    
    const filtered = selectedCountry === 'all' 
      ? impactResults 
      : impactResults.filter(r => r['Location'] === selectedCountry);

    filtered.forEach(result => {
      const plantName = result['Unique plant name'];
      if (!plantMap.has(plantName)) {
        plantMap.set(plantName, {
          name: plantName,
          country: result['Location'],
          units: 0,
          co2: 0,
          deaths: 0,
          wlds: 0,
          investment: 0,
          savings: 0,
          jobs: 0,
        });
      }

      const data = plantMap.get(plantName);
      data.units++;
      data.co2 += parseFloat(result['Total avoided CO2 emissions (Mt)']) || 0;
      data.deaths += parseInt(result['Total avoided deaths']?.replace(/,/g, '')) || 0;
      data.wlds += parseInt(result['Total avoided Work Loss Days (WLDs)']?.replace(/,/g, '')) || 0;
      data.investment += parseFloat(result['Total investment (mn. USD)']?.replace(/[$,]/g, '')) || 0;
      data.savings += parseFloat(result['Annual customer savings (mn USD)']?.replace(/[$,]/g, '')) || 0;
      data.jobs += (parseInt(result['Net permanent jobs created']?.replace(/,/g, '')) || 0) + 
                   (parseInt(result['Total temporary jobs created']?.replace(/,/g, '')) || 0);
    });

    const plants = Array.from(plantMap.values());
    plants.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return plants.slice(0, 20);
  }, [impactResults, selectedCountry, sortBy, sortOrder]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-gray-600">Loading impact data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-white to-cyan-50/30 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-cyan-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Impact Explorer</h1>
              <p className="text-sm text-gray-500 mt-1">Analyze coal plant transition impacts across regions</p>
            </div>
            
            {/* Country Filter */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Region:</label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="px-4 py-2 border border-cyan-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 bg-white"
              >
                <option value="all">All Regions</option>
                {countries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                viewMode === 'overview'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('plants')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                viewMode === 'plants'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Plant Rankings
            </button>
            <button
              onClick={() => setViewMode('comparison')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                viewMode === 'comparison'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Country Comparison
            </button>
            <button
              onClick={() => setViewMode('explorer')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                viewMode === 'explorer'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Interactive Explorer
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Overview Tab */}
        {viewMode === 'overview' && statistics && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-5">
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Total Plants</p>
                <p className="text-4xl font-bold text-gray-800 mb-2">{statistics.totalPlants}</p>
                <p className="text-xs text-gray-400">{statistics.totalUnits} units</p>
              </div>
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">CO₂ Avoided</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-4xl font-bold text-gray-800">{statistics.co2.toFixed(1)}</p>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded">Mt</span>
                </div>
                <p className="text-xs text-gray-400">Million Tonnes</p>
              </div>
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Lives Saved</p>
                <p className="text-4xl font-bold text-gray-800 mb-2">{statistics.deaths.toLocaleString()}</p>
                <p className="text-xs text-gray-400">Deaths Avoided</p>
              </div>
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Investment</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-4xl font-bold text-gray-800">${(statistics.investment / 1000).toFixed(1)}B</p>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">USD</span>
                </div>
                <p className="text-xs text-gray-400">Total Capital</p>
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-4 gap-5">
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Health Impact</p>
                <p className="text-3xl font-bold text-gray-800 mb-2">{(statistics.wlds / 1000).toFixed(0)}K</p>
                <p className="text-xs text-gray-400">Work Days Recovered</p>
              </div>
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Economic Impact</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-3xl font-bold text-gray-800">${statistics.spillover.toFixed(0)}M</p>
                </div>
                <p className="text-xs text-gray-400">Spillover Effect</p>
              </div>
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Jobs Created</p>
                <p className="text-3xl font-bold text-gray-800 mb-2">{(statistics.permJobs + statistics.tempJobs).toLocaleString()}</p>
                <p className="text-xs text-gray-400">{statistics.permJobs.toLocaleString()} permanent</p>
              </div>
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Customer Savings</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-3xl font-bold text-gray-800">${statistics.savings.toFixed(0)}M</p>
                  <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 text-xs font-semibold rounded">Annual</span>
                </div>
                <p className="text-xs text-gray-400">Customer Benefits</p>
              </div>
            </div>

            {/* Top 10 Plants */}
            <div className="bg-white rounded-xl p-6 border border-cyan-100 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 10 Plants by CO₂ Impact</h3>
              <div className="space-y-3">
                {topPlants.slice(0, 10).map((plant, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{plant.name}</p>
                      <p className="text-xs text-gray-500">{plant.country} • {plant.units} units</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">{plant.co2.toFixed(1)} Mt</p>
                      <p className="text-xs text-gray-500">{plant.deaths.toLocaleString()} lives saved</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Plant Rankings Tab */}
        {viewMode === 'plants' && (
          <div className="space-y-4">
            {/* Sort Controls */}
            <div className="bg-white rounded-xl p-4 border border-cyan-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                >
                  <option value="co2">CO₂ Avoided</option>
                  <option value="deaths">Lives Saved</option>
                  <option value="investment">Investment</option>
                  <option value="savings">Customer Savings</option>
                  <option value="jobs">Jobs Created</option>
                </select>
              </div>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                {sortOrder === 'desc' ? '↓ Highest First' : '↑ Lowest First'}
              </button>
            </div>

            {/* Plant List */}
            <div className="bg-white rounded-xl border border-cyan-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plant Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Units</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CO₂ (Mt)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Lives Saved</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Investment ($M)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Savings ($M)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topPlants.map((plant, idx) => (
                    <tr key={idx} className="hover:bg-cyan-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold text-sm">
                          {idx + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-800">{plant.name}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{plant.country}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">{plant.units}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-emerald-600">{plant.co2.toFixed(1)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-blue-600">{plant.deaths.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-amber-600">{plant.investment.toFixed(0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-cyan-600">{plant.savings.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Country Comparison Tab */}
        {viewMode === 'comparison' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-cyan-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-800">Country-Level Impact Analysis</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Plants</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CO₂ Avoided (Mt)</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Lives Saved</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Investment ($M)</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Savings ($M)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {countryData.map((country, idx) => (
                      <tr key={idx} className="hover:bg-cyan-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-800">{country.country}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">{country.plantCount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="font-semibold text-emerald-600">{country.co2.toFixed(1)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="font-semibold text-blue-600">{country.deaths.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="font-semibold text-amber-600">{country.investment.toFixed(0)}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="font-semibold text-cyan-600">{country.savings.toFixed(1)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Visual Comparison Bars */}
            <div className="grid grid-cols-2 gap-6">
              {/* CO2 by Country */}
              <div className="bg-white rounded-xl p-6 border border-cyan-100 shadow-sm">
                <h4 className="font-semibold text-gray-800 mb-4">CO₂ Impact by Country</h4>
                <div className="space-y-3">
                  {countryData.slice(0, 5).map((country, idx) => {
                    const maxCo2 = countryData[0].co2;
                    const percentage = (country.co2 / maxCo2) * 100;
                    return (
                      <div key={idx}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{country.country}</span>
                          <span className="text-emerald-600 font-semibold">{country.co2.toFixed(1)} Mt</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Investment by Country */}
              <div className="bg-white rounded-xl p-6 border border-cyan-100 shadow-sm">
                <h4 className="font-semibold text-gray-800 mb-4">Investment by Country</h4>
                <div className="space-y-3">
                  {countryData.slice(0, 5).map((country, idx) => {
                    const maxInvestment = countryData[0].investment;
                    const percentage = (country.investment / maxInvestment) * 100;
                    return (
                      <div key={idx}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{country.country}</span>
                          <span className="text-amber-600 font-semibold">${country.investment.toFixed(0)}M</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Explorer Tab */}
        {viewMode === 'explorer' && annualData.length > 0 && (
          <div className="space-y-6">
            {/* Plant Selector */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-3">Select a Plant to Explore</label>
              <select
                value={selectedPlantForExplorer || ''}
                onChange={(e) => {
                  const plantName = e.target.value;
                  setSelectedPlantForExplorer(plantName);
                  // Reset retirement year when plant changes
                  const plantData = annualData.filter(d => d['Unique plant name'] === plantName);
                  if (plantData.length > 0) {
                    const originalYear = parseInt(plantData[0]['Planned Retirement Year']) || 0;
                    setAdjustedRetirementYear(originalYear);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
              >
                <option value="">-- Choose a plant --</option>
                {Array.from(new Set(annualData.map(d => d['Unique plant name']).filter(Boolean))).sort().map(plant => (
                  <option key={plant} value={plant}>{plant}</option>
                ))}
              </select>
            </div>

            {selectedPlantForExplorer && (() => {
              // Get data for selected plant
              const plantAnnualData = annualData.filter(d => d['Unique plant name'] === selectedPlantForExplorer);
              if (plantAnnualData.length === 0) return null;

              const firstRecord = plantAnnualData[0];
              const location = firstRecord['Location'];
              const originalRetirementYear = parseInt(firstRecord['Planned Retirement Year']) || 0;
              const currentYear = new Date().getFullYear();
              
              // Calculate default retirement year if not specified
              const defaultYearsToRetirement = countryRetirementDefaults[location] || 35;
              const effectiveRetirementYear = originalRetirementYear === 0 
                ? currentYear + defaultYearsToRetirement 
                : originalRetirementYear;
              
              // Use adjusted year if set, otherwise use effective
              const retirementYear = adjustedRetirementYear || effectiveRetirementYear;
              
              // Calculate totals based on years until retirement
              const yearsUntilRetirement = retirementYear - currentYear;
              const calculateTotals = (years) => {
                return plantAnnualData.reduce((acc, d) => ({
                  co2: acc.co2 + (parseFloat(d['Annual avoided CO2 emissions (Mt)']) || 0) * years,
                  deaths: acc.deaths + (parseInt(d['Annual avoided deaths']) || 0) * years,
                  wlds: acc.wlds + (parseInt(d['Annual avoided Work Loss Days (WLDs)']) || 0) * years,
                  investment: acc.investment + (parseFloat(d['Total investment (mn. USD)']) || 0),
                  spillover: acc.spillover + (parseFloat(d['Economic spillover (mn. USD)']) || 0) * years,
                  savings: acc.savings + (parseFloat(d['Annual customer savings (mn USD)']) || 0) * years,
                }), { co2: 0, deaths: 0, wlds: 0, investment: 0, spillover: 0, savings: 0 });
              };

              const totals = calculateTotals(yearsUntilRetirement);
              
              // For the chart, we'll create year-by-year projections
              const minYear = currentYear;
              const maxYear = currentYear + 50; // Show up to 50 years ahead

              return (
                <div className="space-y-6">
                  {/* Plant Info Card */}
                  <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-6 border border-cyan-100">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{selectedPlantForExplorer}</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Location:</span>
                        <span className="ml-2 font-semibold text-gray-800">{location}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Original Retirement:</span>
                        <span className="ml-2 font-semibold text-gray-800">
                          {originalRetirementYear === 0 ? `~${effectiveRetirementYear} (assumed)` : originalRetirementYear}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Units:</span>
                        <span className="ml-2 font-semibold text-gray-800">{plantAnnualData.length} unit{plantAnnualData.length > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Retirement Year Adjuster */}
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Adjust Retirement Year
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={minYear}
                        max={maxYear}
                        value={retirementYear}
                        onChange={(e) => setAdjustedRetirementYear(parseInt(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={minYear}
                          max={maxYear}
                          value={retirementYear}
                          onChange={(e) => setAdjustedRetirementYear(parseInt(e.target.value))}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        />
                        <button
                          onClick={() => setAdjustedRetirementYear(effectiveRetirementYear)}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Slide to see how changing the retirement date affects cumulative impacts
                    </p>
                  </div>

                  {/* Impact Totals */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">CO₂ Avoided</p>
                      <div className="flex items-baseline gap-2 mb-2">
                        <p className="text-4xl font-bold text-gray-800">{totals.co2.toFixed(2)}</p>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded">Mt</span>
                      </div>
                      <p className="text-xs text-gray-400">Through {retirementYear}</p>
                    </div>
                    <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Lives Saved</p>
                      <p className="text-4xl font-bold text-gray-800 mb-2">{totals.deaths.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">Deaths Avoided</p>
                    </div>
                    <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Investment</p>
                      <div className="flex items-baseline gap-2 mb-2">
                        <p className="text-4xl font-bold text-gray-800">${totals.investment.toFixed(0)}M</p>
                      </div>
                      <p className="text-xs text-gray-400">Total Capital</p>
                    </div>
                  </div>

                  {/* Degradation Assumptions */}
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-gray-800">Plant Degradation Assumptions</h4>
                        <p className="text-xs text-gray-500 mt-1">Model how plant aging affects avoided emissions</p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableDegradation}
                          onChange={(e) => setEnableDegradation(e.target.checked)}
                          className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Enable Degradation</span>
                      </label>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      {/* Efficiency Degradation */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700">Efficiency Degradation</label>
                          <span className="text-sm font-bold text-cyan-600">{efficiencyDegradation.toFixed(1)}% / year</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1.5"
                          step="0.1"
                          value={efficiencyDegradation}
                          onChange={(e) => setEfficiencyDegradation(parseFloat(e.target.value))}
                          disabled={!enableDegradation}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500">
                          As plant ages, thermal efficiency decreases → burns more coal per MWh → higher emissions avoided
                        </p>
                      </div>
                      
                      {/* Capacity Factor Degradation */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-700">Capacity Factor Degradation</label>
                          <span className="text-sm font-bold text-amber-600">{capacityDegradation.toFixed(1)}% / year</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="2.0"
                          step="0.1"
                          value={capacityDegradation}
                          onChange={(e) => setCapacityDegradation(parseFloat(e.target.value))}
                          disabled={!enableDegradation}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500">
                          More outages, less dispatch → plant runs fewer hours → less total emissions avoided
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-xs text-blue-800">
                        <strong>Net Effect:</strong> Efficiency degradation increases CO₂ per MWh (↑ avoided), while capacity degradation reduces operating hours (↓ avoided). 
                        Typical values: Efficiency 0.3-0.5%/yr, Capacity 0.5-1.5%/yr based on coal plant aging studies.
                      </p>
                    </div>
                  </div>

                  {/* Time Series Chart */}
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-800">Annual Impact Over Time</h4>
                      <select
                        value={selectedMetric}
                        onChange={(e) => setSelectedMetric(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                      >
                        <option value="co2">CO₂ Avoided (Mt)</option>
                        <option value="deaths">Deaths Avoided</option>
                        <option value="investment">Investment ($M)</option>
                        <option value="savings">Customer Savings ($M)</option>
                      </select>
                    </div>
                    
                    {/* Area Chart */}
                    <div className="relative" style={{ height: '300px' }}>
                      {(() => {
                        // Generate year-by-year data with degradation
                        const yearData = [];
                        const baseAnnualCO2 = plantAnnualData.reduce((sum, d) => sum + (parseFloat(d['Annual avoided CO2 emissions (Mt)']) || 0), 0);
                        const baseAnnualDeaths = plantAnnualData.reduce((sum, d) => sum + (parseInt(d['Annual avoided deaths']) || 0), 0);
                        const totalAnnualInvestment = plantAnnualData.reduce((sum, d) => sum + (parseFloat(d['Total investment (mn. USD)']) || 0), 0);
                        const baseAnnualSavings = plantAnnualData.reduce((sum, d) => sum + (parseFloat(d['Annual customer savings (mn USD)']) || 0), 0);
                        
                        // Extend to retirement year + 5 years for context
                        const endYear = Math.max(adjustedRetirementYear + 5, currentYear + 10);
                        
                        for (let year = currentYear; year <= Math.min(endYear, maxYear); year++) {
                          const yearsElapsed = year - currentYear;
                          
                          // Calculate degradation factors
                          let efficiencyFactor = 1.0;
                          let capacityFactor = 1.0;
                          
                          if (enableDegradation && yearsElapsed > 0) {
                            // Efficiency degradation: exponential decline in thermal efficiency
                            // Lower efficiency = higher heat rate = MORE coal burned per MWh = MORE emissions
                            // Factor increases exponentially as plant ages
                            efficiencyFactor = Math.pow(1 + (efficiencyDegradation / 100), yearsElapsed);
                            
                            // Capacity factor degradation: exponential decline in operating hours
                            // More outages and derating = plant runs LESS = FEWER emissions
                            // Factor decreases exponentially as plant ages
                            capacityFactor = Math.pow(1 - (capacityDegradation / 100), yearsElapsed);
                          }
                          
                          // Net effect on CO2: efficiency increases it, capacity decreases it
                          const co2Factor = efficiencyFactor * capacityFactor;
                          
                          // For health impacts, capacity factor dominates (less operation = less pollution)
                          const healthFactor = capacityFactor;
                          
                          yearData.push({
                            year,
                            co2: baseAnnualCO2 * co2Factor,
                            deaths: baseAnnualDeaths * healthFactor,
                            investment: year === currentYear ? totalAnnualInvestment : 0,
                            savings: baseAnnualSavings * capacityFactor,
                            efficiencyFactor,
                            capacityFactor,
                            co2Factor
                          });
                        }
                        
                        // Calculate cumulative values for selected metric
                        let cumulative = 0;
                        const values = yearData.map(d => {
                          let annualValue;
                          if (selectedMetric === 'co2') annualValue = d.co2;
                          else if (selectedMetric === 'deaths') annualValue = d.deaths;
                          else if (selectedMetric === 'investment') annualValue = d.investment;
                          else annualValue = d.savings;
                          
                          cumulative += annualValue;
                          return cumulative;
                        });
                        
                        const maxValue = Math.max(...values);
                        const chartHeight = 250;
                        const chartWidthPx = 1000; // SVG coordinate width
                        const padding = { top: 10, bottom: 40, left: 60, right: 20 };
                        
                        // Create points with actual pixel coordinates
                        const points = yearData.map((d, i) => {
                          const x = (i / (yearData.length - 1)) * chartWidthPx;
                          const value = values[i];
                          const y = chartHeight - (value / maxValue) * (chartHeight - padding.top);
                          return { x, y, year: d.year, value };
                        });
                        
                        // Helper function to create smooth curves using cubic bezier
                        const createSmoothPath = (points, close = false) => {
                          if (points.length === 0) return '';
                          if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
                          
                          let path = `M ${points[0].x},${points[0].y}`;
                          
                          for (let i = 0; i < points.length - 1; i++) {
                            const current = points[i];
                            const next = points[i + 1];
                            const controlPointDistance = (next.x - current.x) / 3;
                            
                            // Create smooth curve using cubic bezier
                            const cp1x = current.x + controlPointDistance;
                            const cp1y = current.y;
                            const cp2x = next.x - controlPointDistance;
                            const cp2y = next.y;
                            
                            path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`;
                          }
                          
                          if (close) {
                            path += ` L ${points[points.length - 1].x},${chartHeight} L ${points[0].x},${chartHeight} Z`;
                          }
                          
                          return path;
                        };
                        
                        // Create smooth paths
                        const linePath = createSmoothPath(points);
                        
                        // Split points at retirement
                        const pointsBeforeRetirement = points.filter(p => p.year <= retirementYear);
                        const pointsAfterRetirement = points.filter(p => p.year >= retirementYear);
                        
                        // Create area paths
                        const areaBeforePath = pointsBeforeRetirement.length > 0 ?
                          createSmoothPath(pointsBeforeRetirement) + ` L ${pointsBeforeRetirement[pointsBeforeRetirement.length - 1].x},${chartHeight} L ${pointsBeforeRetirement[0].x},${chartHeight} Z` : '';
                        
                        const areaAfterPath = pointsAfterRetirement.length > 0 ?
                          createSmoothPath(pointsAfterRetirement) + ` L ${pointsAfterRetirement[pointsAfterRetirement.length - 1].x},${chartHeight} L ${pointsAfterRetirement[0].x},${chartHeight} Z` : '';
                        
                        // Find retirement marker position
                        const retirementIndex = points.findIndex(p => p.year === retirementYear);
                        const retirementX = retirementIndex >= 0 ? points[retirementIndex].x : null;
                        const retirementXPercent = retirementX !== null ? (retirementX / chartWidthPx) * 100 : null;
                        
                        return (
                          <>
                            {/* Y-axis labels */}
                            <div className="absolute left-0 top-0 bottom-10 flex flex-col justify-between text-xs text-gray-500" style={{ width: '50px' }}>
                              <span className="text-right">{maxValue.toFixed(1)}</span>
                              <span className="text-right">{(maxValue * 0.5).toFixed(1)}</span>
                              <span className="text-right">0</span>
                            </div>
                            
                            {/* Chart area */}
                            <div className="absolute" style={{ left: '60px', right: '20px', top: 0, bottom: '40px' }}>
                              <svg viewBox={`0 0 ${chartWidthPx} ${chartHeight}`} preserveAspectRatio="none" className="w-full h-full">
                                {/* Grid lines */}
                                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                                  <line
                                    key={i}
                                    x1="0"
                                    y1={chartHeight - ratio * (chartHeight - padding.top)}
                                    x2={chartWidthPx}
                                    y2={chartHeight - ratio * (chartHeight - padding.top)}
                                    stroke="#e5e7eb"
                                    strokeWidth="0.5"
                                    vectorEffect="non-scaling-stroke"
                                  />
                                ))}
                                
                                {/* Retirement line */}
                                {retirementX !== null && (
                                  <line
                                    x1={retirementX}
                                    y1="0"
                                    x2={retirementX}
                                    y2={chartHeight}
                                    stroke="#06b6d4"
                                    strokeWidth="2"
                                    strokeDasharray="4,4"
                                    vectorEffect="non-scaling-stroke"
                                  />
                                )}
                                
                                {/* Area fill - split into before and after retirement */}
                                {retirementX !== null ? (
                                  <>
                                    {/* Area before retirement */}
                                    <path
                                      d={areaBeforePath}
                                      fill="url(#areaGradient)"
                                      opacity="0.8"
                                    />
                                    {/* Area after retirement - faded */}
                                    <path
                                      d={areaAfterPath}
                                      fill="#d1d5db"
                                      opacity="0.4"
                                    />
                                  </>
                                ) : (
                                  <path
                                    d={createSmoothPath(points) + ` L ${points[points.length - 1].x},${chartHeight} L ${points[0].x},${chartHeight} Z`}
                                    fill="url(#areaGradient)"
                                    opacity="0.8"
                                  />
                                )}
                                
                                {/* Line on top */}
                                <path
                                  d={linePath}
                                  fill="none"
                                  stroke="#06b6d4"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  vectorEffect="non-scaling-stroke"
                                />
                                
                                {/* Data points */}
                                {points.map((p, i) => (
                                  <circle
                                    key={i}
                                    cx={p.x}
                                    cy={p.y}
                                    r={p.year === retirementYear ? "4" : "2"}
                                    fill={p.year > retirementYear ? "#9ca3af" : "#06b6d4"}
                                    stroke="white"
                                    strokeWidth="1"
                                    vectorEffect="non-scaling-stroke"
                                  />
                                ))}
                                
                                {/* Gradient definition */}
                                <defs>
                                  <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
                                  </linearGradient>
                                </defs>
                              </svg>
                            </div>
                            
                            {/* X-axis labels */}
                            <div className="absolute left-14 right-5 bottom-0 flex justify-between text-xs text-gray-500" style={{ height: '30px' }}>
                              {yearData.filter((_, i) => i % Math.ceil(yearData.length / 6) === 0).map((d, i) => (
                                <span key={i} className={d.year === retirementYear ? 'font-bold text-cyan-600' : ''}>
                                  {d.year}
                                </span>
                              ))}
                            </div>
                            
                            {/* Retirement marker label */}
                            {retirementX !== null && (
                              <div 
                                className="absolute top-2 text-xs font-semibold text-cyan-600 bg-white px-2 py-1 rounded shadow-sm border border-cyan-200"
                                style={{ left: `calc(60px + ${retirementX}% - 50px)` }}
                              >
                                Retirement: {retirementYear}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImpactCalculator;
