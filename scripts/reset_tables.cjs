// Reset all tables and make all columns TEXT for flexible data import
const { Client } = require('pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const PG_CONNECTION_STRING = 'postgresql://postgres.nohouhstbuysnimquvtx:BlackfriarsPier25@54.247.26.119:5432/postgres';

async function main() {
  const c = new Client({ 
    connectionString: PG_CONNECTION_STRING, 
    ssl: { rejectUnauthorized: false } 
  });
  await c.connect();
  
  // Drop existing tables
  console.log('Dropping existing tables...');
  const tablesToDrop = ['impact_results_v0', 'impact_results_v1_annual', 'project_specific_data', 'global_coal_plants'];
  for (const table of tablesToDrop) {
    try {
      await c.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`  Dropped: ${table}`);
    } catch (err) {
      console.log(`  Error dropping ${table}:`, err.message);
    }
  }
  
  // Recreate tables with all TEXT columns
  console.log('\nCreating tables with TEXT columns...');
  
  // impact_results_v0 - based on Impact Results V0.csv
  await c.query(`
    CREATE TABLE impact_results_v0 (
      id SERIAL PRIMARY KEY,
      unique_plant_name TEXT,
      location TEXT,
      total_avoided_co2_emissions_mt TEXT,
      total_avoided_deaths TEXT,
      total_avoided_work_loss_days TEXT,
      total_investment_mn_usd TEXT,
      economic_spillover_mn_usd TEXT,
      net_permanent_jobs_created TEXT,
      total_temporary_jobs_created TEXT,
      annual_customer_savings_mn_usd TEXT,
      savings_per_kwh_percent TEXT
    )
  `);
  console.log('  Created: impact_results_v0');
  
  // impact_results_v1_annual - based on Impact Results V1_Annual.csv
  await c.query(`
    CREATE TABLE impact_results_v1_annual (
      id SERIAL PRIMARY KEY,
      gem_unique_id TEXT,
      unique_plant_name TEXT,
      unit_name TEXT,
      location TEXT,
      planned_retirement_year TEXT,
      annual_avoided_co2_emissions_mt TEXT,
      annual_avoided_deaths TEXT,
      annual_avoided_work_loss_days_wlds TEXT,
      total_investment_mn_usd TEXT,
      economic_spillover_mn_usd TEXT,
      net_permanent_jobs_created TEXT,
      total_temporary_jobs_created TEXT,
      annual_customer_savings_mn_usd TEXT,
      savings_per_kwh TEXT
    )
  `);
  console.log('  Created: impact_results_v1_annual');
  
  // project_specific_data - based on data.csv
  await c.query(`
    CREATE TABLE project_specific_data (
      id SERIAL PRIMARY KEY,
      no TEXT,
      plant_name TEXT,
      email_extension TEXT,
      unit_name TEXT,
      capacity_mw TEXT,
      country TEXT,
      information_status TEXT,
      information_owner TEXT,
      location_coordinates TEXT,
      operator TEXT,
      owner TEXT,
      parent TEXT,
      operational_status TEXT,
      start_year TEXT,
      original_end_of_life_year TEXT,
      planned_retirement_year TEXT,
      actual_retirement_year TEXT,
      lifetime_sox TEXT,
      lifetime_nox TEXT,
      lifetime_co2 TEXT,
      grid_connection_type_and_role TEXT,
      intelligence_on_transaction_status TEXT,
      transition_type TEXT,
      financial_mechanism TEXT,
      lender_s_funder_s_involved TEXT,
      planned_post_retirement_status TEXT,
      technical_assistance_provided_to_date TEXT,
      source TEXT,
      project_name TEXT,
      last_updated TEXT
    )
  `);
  console.log('  Created: project_specific_data');
  
  // global_coal_plants - based on global_coal_plants.xlsx
  await c.query(`
    CREATE TABLE global_coal_plants (
      id SERIAL PRIMARY KEY,
      gem_unique_id TEXT,
      plant_name TEXT,
      unit_name TEXT,
      country_area TEXT,
      capacity_mw TEXT,
      status TEXT,
      year TEXT,
      latitude TEXT,
      longitude TEXT,
      geo_location TEXT,
      owner TEXT,
      parent TEXT,
      coal_type TEXT,
      operating_or_construction_year TEXT
    )
  `);
  console.log('  Created: global_coal_plants');
  
  console.log('\nAll tables reset successfully!');
  await c.end();
}

main().catch(console.error);
