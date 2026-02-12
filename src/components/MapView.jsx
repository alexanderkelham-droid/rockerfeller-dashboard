import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { supabase } from '../lib/supabaseClient';
import AddPlantSearch from './AddPlantSearch';
import ProjectDetail from './ProjectDetail';
import CreateProject from './CreateProject';

// Helper to normalize project_specific_data from Supabase
const normalizeProjectData = (row) => ({
  ...row,
  'No': row.no,
  'Plant Name': row.plant_name,
  'Email extension': row.email_extension,
  'Unit name': row.unit_name,
  'Capacity (MW)': row.capacity_mw,
  'Country': row.country,
  'Information Status': row.information_status,
  'Information Owner': row.information_owner,
  'Location (coordinates)': row.location_coordinates,
  'Operator': row.operator,
  'Owner': row.owner,
  'Parent': row.parent,
  'Operational Status': row.operational_status,
  'Start year': row.start_year,
  'Original end of life year': row.original_end_of_life_year,
  'Planned retirement year': row.planned_retirement_year,
  'Actual retirement year': row.actual_retirement_year,
  'Intelligence on Transaction Status': row.intelligence_on_transaction_status,
  'Transition type': row.transition_type,
  'Financial mechanism': row.financial_mechanism,
  'Lender(s)/ Funder(s) involved': row.lender_s_funder_s_involved,
  'Planned post-retirement status': row.planned_post_retirement_status,
  'Technical Assistance provided to date': row.technical_assistance_provided_to_date,
  'Source': row.source,
  'Project Name': row.project_name,
  'Last Updated': row.last_updated,
});

// Helper to normalize impact_results_v0 from Supabase
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

const MapView = ({ userEmail }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapData, setMapData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [selectedPlantProjects, setSelectedPlantProjects] = useState([]); // Store all projects for selected plant
  const [previousView, setPreviousView] = useState(null); // Store previous map view
  const [markers, setMarkers] = useState([]); // Store marker references
  const [showAllGlobalPlants, setShowAllGlobalPlants] = useState(false);
  const [globalPlants, setGlobalPlants] = useState([]);
  const [filteredGlobalPlants, setFilteredGlobalPlants] = useState([]);
  const [panelHeight, setPanelHeight] = useState(35); // Panel height in vh (35% of viewport height)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(35);
  const [impactResults, setImpactResults] = useState([]); // Store impact results data
  const [selectedUnit, setSelectedUnit] = useState('all'); // Track which unit is selected in the popup
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState(null); // Track which project is opened in detail modal
  const [showCreateProject, setShowCreateProject] = useState(false); // Track if create project modal is open
  const [provisionalMarker, setProvisionalMarker] = useState(null); // Store provisional marker reference
  const provisionalMarkerRef = useRef(null); // Ref for provisional marker DOM element
  const [transactions, setTransactions] = useState([]); // Store CRM transactions
  const [selectedPopupTab, setSelectedPopupTab] = useState('details'); // 'details', 'plants', or 'impact'
  const [expandedPlantKey, setExpandedPlantKey] = useState(null); // Track which coal plant node is expanded
  const expandedPlantKeyRef = useRef(null); // Ref to avoid stale closures
  const radialMarkersRef = useRef([]); // Store radial transaction markers and lines
  const radialLinesRef = useRef([]); // Store SVG line elements
  const moveHandlerRef = useRef(null); // Store map move handler for cleanup
  
  // Popup drag state
  const [popupPosition, setPopupPosition] = useState({ x: null, y: null }); // null means use default centered position
  const [isPopupDragging, setIsPopupDragging] = useState(false);
  const [popupDragStart, setPopupDragStart] = useState({ x: 0, y: 0 });
  const [popupDragOffset, setPopupDragOffset] = useState({ x: 0, y: 0 });

  // Transaction status colors for triangles
  const TRANSACTION_STATUS_COLORS = {
    green: '#10b981',    // emerald-500
    amber: '#f59e0b',    // amber-500
    red: '#ef4444',      // red-500
    closed: '#6b7280',   // gray-500
    default: '#3b82f6',  // blue-500 (for transactions without status)
  };

  // MapTiler API key - Get your free key from https://cloud.maptiler.com/
  // Sign up, go to Account > Keys, and copy your key here
  const MAPTILER_API_KEY = 'YnAuJTg55khmx1RkyRXM'; // Replace with your actual API key

  // Handle drag start for resizable panel
  const handleDragStart = (e) => {
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragStartHeight(panelHeight);
    e.preventDefault();
  };

  // Handle drag move
  const handleDragMove = (e) => {
    if (!isDragging) return;
    const deltaY = dragStartY - e.clientY; // Inverted because dragging up increases height
    const viewportHeight = window.innerHeight;
    const deltaVh = (deltaY / viewportHeight) * 100;
    const newHeight = Math.min(Math.max(dragStartHeight + deltaVh, 20), 80); // Min 20vh, max 80vh
    setPanelHeight(newHeight);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Handle popup drag start
  const handlePopupDragStart = (e) => {
    e.preventDefault();
    setIsPopupDragging(true);
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    setPopupDragStart({ x: clientX, y: clientY });
    setPopupDragOffset({ x: popupPosition.x || 0, y: popupPosition.y || 0 });
  };

  // Handle popup drag move
  const handlePopupDragMove = useCallback((e) => {
    if (!isPopupDragging) return;
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - popupDragStart.x;
    const deltaY = clientY - popupDragStart.y;
    setPopupPosition({
      x: popupDragOffset.x + deltaX,
      y: popupDragOffset.y + deltaY
    });
  }, [isPopupDragging, popupDragStart, popupDragOffset]);

  // Handle popup drag end
  const handlePopupDragEnd = useCallback(() => {
    setIsPopupDragging(false);
  }, []);

  // Handle provisional marker for new project creation
  const handleProvisionalMarker = (markerData) => {
    // Remove existing provisional marker if any
    if (provisionalMarkerRef.current) {
      provisionalMarkerRef.current.remove();
      provisionalMarkerRef.current = null;
    }

    if (!markerData || !map.current) {
      setProvisionalMarker(null);
      return;
    }

    // Create a pulsing provisional marker
    const el = document.createElement('div');
    el.className = 'provisional-marker';
    el.innerHTML = `
      <div style="
        width: 24px;
        height: 24px;
        background: #f59e0b;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.3), 0 2px 8px rgba(0,0,0,0.3);
        animation: pulse 1.5s ease-in-out infinite;
      "></div>
    `;

    // Add CSS animation if not already added
    if (!document.getElementById('provisional-marker-styles')) {
      const style = document.createElement('style');
      style.id = 'provisional-marker-styles';
      style.textContent = `
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.3), 0 2px 8px rgba(0,0,0,0.3); transform: scale(1); }
          50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.2), 0 2px 8px rgba(0,0,0,0.3); transform: scale(1.1); }
        }
      `;
      document.head.appendChild(style);
    }

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([markerData.lng, markerData.lat])
      .addTo(map.current);

    provisionalMarkerRef.current = marker;
    setProvisionalMarker(markerData);

    // Fly to the location
    map.current.flyTo({
      center: [markerData.lng, markerData.lat],
      zoom: 8,
      duration: 1500,
    });
  };

  // Handle new project created
  const handleProjectCreated = async (newProject) => {
    // Remove provisional marker
    handleProvisionalMarker(null);

    // Refresh data from Supabase
    const { data: projectData, error: projectError } = await supabase
      .from('project_specific_data')
      .select('*');
    
    if (!projectError && projectData) {
      const normalizedProjects = projectData.map(normalizeProjectData);
      const processedData = normalizedProjects.map(row => {
        const coords = row['Location (coordinates)'] || '';
        const [lat, lng] = coords.split(',').map(s => parseFloat(s?.trim()));
        return {
          ...row,
          latitude: lat || 0,
          longitude: lng || 0,
          'Operational Status': row['Operational Status'] || 'Unknown',
        };
      }).filter(row => row.latitude && row.longitude);
      
      setMapData(processedData);
    }
  };

  // Add/remove mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, dragStartY, dragStartHeight]);

  // Add/remove event listeners for popup dragging
  useEffect(() => {
    if (isPopupDragging) {
      document.addEventListener('mousemove', handlePopupDragMove);
      document.addEventListener('mouseup', handlePopupDragEnd);
      document.addEventListener('touchmove', handlePopupDragMove);
      document.addEventListener('touchend', handlePopupDragEnd);
      return () => {
        document.removeEventListener('mousemove', handlePopupDragMove);
        document.removeEventListener('mouseup', handlePopupDragEnd);
        document.removeEventListener('touchmove', handlePopupDragMove);
        document.removeEventListener('touchend', handlePopupDragEnd);
      };
    }
  }, [isPopupDragging, handlePopupDragMove, handlePopupDragEnd]);

  // Reset popup position when a new plant is selected
  useEffect(() => {
    if (selectedPlant) {
      setPopupPosition({ x: null, y: null });
    }
  }, [selectedPlant]);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      // Fetch project specific data
      const { data: projectData, error: projectError } = await supabase
        .from('project_specific_data')
        .select('*');
      if (projectError) {
        console.error('Error loading project specific data from Supabase:', projectError);
      } else {
        // Normalize column names for compatibility
        const normalizedData = (projectData || []).map(normalizeProjectData);
        filterAndProcessData(normalizedData, userEmail);
      }
      // Fetch impact results data
      const { data: impactResultsData, error: impactError } = await supabase
        .from('impact_results_v0')
        .select('*');
      if (impactError) {
        console.error('Error loading impact results from Supabase:', impactError);
      } else {
        // Normalize column names for compatibility
        setImpactResults((impactResultsData || []).map(normalizeImpactResult));
      }
      // Fetch CRM transactions
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select('*');
      if (transactionError) {
        console.error('Error loading transactions from Supabase:', transactionError);
      } else {
        setTransactions(transactionData || []);
      }
      setIsLoading(false);
    }
    fetchData();
  }, [userEmail]);

  const filterAndProcessData = (data, email) => {
    let filteredData = data;

    // TEMPORARILY DISABLED - Apply email domain filtering if user is logged in
    // if (email) {
    //   const emailDomain = '@' + email.split('@')[1];
    //   filteredData = data.filter(row => {
    //     const rowEmailExt = row['Email extension'];
    //     if (!rowEmailExt) return false;
    //     const cleanEmailExt = rowEmailExt.replace(/['"]/g, '').trim();
    //     return cleanEmailExt.toLowerCase() === emailDomain.toLowerCase();
    //   });
    // }

    // Process coordinates and prepare map data
    const processedData = filteredData
      .map(row => {
        const coords = row['Location (coordinates)'];
        if (!coords) return null;

        // Parse coordinates (format: "lat, lon")
        const [lat, lon] = coords.split(',').map(c => parseFloat(c.trim()));
        
        if (isNaN(lat) || isNaN(lon)) return null;

        return {
          ...row,
          latitude: lat,
          longitude: lon,
        };
      })
      .filter(item => item !== null);

    setMapData(processedData);
    setIsLoading(false);
  };

  const handleAddPlant = (newPlant) => {
    // Add the new plant to the map data
    const updatedData = [...mapData, newPlant];
    setMapData(updatedData);
    
    // Fly to the plant location
    if (map.current) {
      map.current.flyTo({
        center: [newPlant.longitude, newPlant.latitude],
        zoom: 8,
        duration: 2000,
        essential: true
      });
    }
  };
  
  // Update markers when filters change and global plants are showing
  useEffect(() => {
    if (showAllGlobalPlants && map.current) {
      console.log('Updating markers with filtered plants:', filteredGlobalPlants.length);
      
      // Remove existing global markers
      markers.forEach(marker => {
        const plantData = marker._element?.__plantData;
        if (plantData?.isGlobal) {
          marker.remove();
        }
      });
      
      const newMarkers = markers.filter(m => !m._element?.__plantData?.isGlobal);
      setMarkers(newMarkers);
      
      // Add filtered markers in batches
      if (filteredGlobalPlants.length > 0) {
        const batchSize = 100;
        let index = 0;
        
        const addBatch = () => {
          const batch = filteredGlobalPlants.slice(index, index + batchSize);
          batch.forEach(plant => addMarkerToMap(plant, false, true));
          
          index += batchSize;
          if (index < filteredGlobalPlants.length) {
            setTimeout(addBatch, 10);
          }
        };
        
        addBatch();
      }
    }
  }, [filteredGlobalPlants, showAllGlobalPlants]);

  const loadGlobalPlants = useCallback(async (callback) => {
    try {
      // Fetch all operating plants from the database (paginated)
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('global_coal_plants')
          .select('*')
          .eq('status', 'operating')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = allData.concat(data);
          page++;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`Global plants query returned ${allData.length} total operating plants`);
      
      // Get the list of plant names from impact results for marking
      const impactPlantNames = new Set(
        impactResults
          .map(result => result['Unique plant name']?.toLowerCase()?.trim())
          .filter(Boolean)
      );
      
      // Group by unique plant (not by unit) and store unit details
      const uniquePlants = new Map();
      const plantUnitsMap = new Map(); // Store unit details for each plant
      
      let skippedNoCoords = 0;
      
      allData.forEach(plant => {
        if (!plant.latitude || !plant.longitude) {
          skippedNoCoords++;
          return;
        }
        
        const plantKey = `${plant.plant_name}_${plant.latitude}_${plant.longitude}`;
        
        // Store unit details
        if (!plantUnitsMap.has(plantKey)) {
          plantUnitsMap.set(plantKey, []);
        }
        plantUnitsMap.get(plantKey).push({
          unitName: plant.unit_name,
          capacity: parseFloat(plant.capacity_mw) || 0
        });
        
        // Check if this plant has impact data
        const plantName = plant.plant_name?.toLowerCase()?.trim();
        const hasImpactData = plantName && impactPlantNames.has(plantName);
        
        // If we haven't seen this plant yet, or if this unit has higher capacity, use it
        if (!uniquePlants.has(plantKey)) {
          uniquePlants.set(plantKey, { ...plant, unitDetails: [], hasImpactData });
        } else {
          const existing = uniquePlants.get(plantKey);
          const currentCapacity = parseFloat(plant.capacity_mw) || 0;
          const existingCapacity = parseFloat(existing.capacity_mw) || 0;
          
          // Sum up capacities for the same plant
          uniquePlants.set(plantKey, {
            ...existing,
            capacity_mw: existingCapacity + currentCapacity,
            hasImpactData: existing.hasImpactData || hasImpactData,
          });
        }
      });
      
      console.log(`Skipped ${skippedNoCoords} plants with no coordinates`);
      
      // Attach unit details to each plant
      uniquePlants.forEach((plant, key) => {
        plant.unitDetails = plantUnitsMap.get(key) || [];
      });
      
      // Convert to array and process
      const processedGlobal = Array.from(uniquePlants.values()).map(plant => ({
        'No': `GLOBAL-${plant.gem_location_id || Math.random()}`,
        'Plant Name': plant.plant_name || 'Unknown',
        'Unit name': 'Combined Units',
        'Capacity (MW)': plant.capacity_mw || 0,
        'Country': plant.country_area || '',
        'Operational Status': 'Operating',
        'Start year': plant.start_year || '',
        'Planned retirement year': plant.planned_retirement || '',
        'Location (coordinates)': `${plant.latitude}, ${plant.longitude}`,
        'Operator': plant.owner || '',
        'Owner': plant.owner || '',
        'Parent': plant.parent || '',
        'Transition type': '',
        'Financial mechanism': '',
        'Information Status': 'Global Database',
        'Email extension': '',
        latitude: parseFloat(plant.latitude),
        longitude: parseFloat(plant.longitude),
        isGlobal: true,
        hasImpactData: plant.hasImpactData || false,
        unitDetails: plant.unitDetails || [], // Include unit details!
      }));
      
      console.log(`Loaded ${processedGlobal.length} unique plants from global database`);
      const withImpact = processedGlobal.filter(p => p.hasImpactData).length;
      console.log(`${withImpact} plants have impact data available`);
      
      setGlobalPlants(processedGlobal);
      if (callback) callback(processedGlobal);
    } catch (error) {
      console.error('Error loading global plants:', error);
    }
  }, [impactResults]);

  const toggleGlobalPlants = () => {
    if (!showAllGlobalPlants) {
      // Load and show global plants
      const plantsToShow = filteredGlobalPlants.length > 0 ? filteredGlobalPlants : globalPlants;
      
      if (plantsToShow.length === 0) {
        loadGlobalPlants((plants) => {
          // Add markers in batches to prevent UI blocking
          const batchSize = 100;
          let index = 0;
          
          const addBatch = () => {
            const batch = plants.slice(index, index + batchSize);
            batch.forEach(plant => addMarkerToMap(plant, false, true));
            
            index += batchSize;
            if (index < plants.length) {
              setTimeout(addBatch, 10); // Small delay between batches
            }
          };
          
          addBatch();
        });
      } else {
        // Add markers in batches
        const batchSize = 100;
        let index = 0;
        
        const addBatch = () => {
          const batch = plantsToShow.slice(index, index + batchSize);
          batch.forEach(plant => addMarkerToMap(plant, false, true));
          
          index += batchSize;
          if (index < plantsToShow.length) {
            setTimeout(addBatch, 10);
          }
        };
        
        addBatch();
      }
    } else {
      // Hide global plants - remove their markers
      markers.forEach(marker => {
        const plantData = marker._element?.__plantData;
        if (plantData?.isGlobal) {
          marker.remove();
        }
      });
      setMarkers(prev => prev.filter(m => !m._element?.__plantData?.isGlobal));
    }
    setShowAllGlobalPlants(!showAllGlobalPlants);
  };

  const addMarkerToMap = (plant, isNewlyAdded = false, isGlobal = false) => {
    if (!map.current) return;

    // Create custom marker element with simpler styling for global plants
    const el = document.createElement('div');
    el.className = 'custom-marker';
    
    if (isGlobal) {
      // Global plants: keep as circles
      const size = '16px';
      el.style.width = size;
      el.style.height = size;
      el.style.borderRadius = '50%';
      el.style.position = 'absolute';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.opacity = '0.5';
    } else {
      // Project plants: make triangles
      el.style.width = '0';
      el.style.height = '0';
      el.style.borderLeft = '15px solid transparent';
      el.style.borderRight = '15px solid transparent';
      el.style.borderBottom = '26px solid'; // Will be colored below
      el.style.position = 'absolute';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.opacity = '1';
    }
    
    // Store plant data on element for filtering
    el.__plantData = plant;
    
    // Color code by operational status
    const statusColors = {
      'Operating': '#10b981',
      'operating': '#10b981', // lowercase version
      'Retired': '#f59e0b',
      'Planning': '#3b82f6',
    };
    const baseColor = statusColors[plant['Operational Status']] || '#6b7280';
    
    if (isGlobal) {
      el.style.backgroundColor = baseColor;
      el.style.border = '1px solid white';
      el.style.boxShadow = '0 1px 2px rgba(0,0,0,0.2)';
    } else {
      el.style.borderBottomColor = baseColor;
      el.style.filter = isNewlyAdded ? 'drop-shadow(0 0 4px #3b82f6)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
    }
    
    el.style.cursor = 'pointer';

    // Only add hover for non-global or simplified hover for global
    if (!isGlobal) {
      el.addEventListener('mouseenter', () => {
        el.style.borderLeft = '18px solid transparent';
        el.style.borderRight = '18px solid transparent';
        el.style.borderBottom = '31px solid';
        el.style.borderBottomColor = baseColor;
        el.style.filter = 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))';
      });
      el.addEventListener('mouseleave', () => {
        el.style.borderLeft = '15px solid transparent';
        el.style.borderRight = '15px solid transparent';
        el.style.borderBottom = '26px solid';
        el.style.borderBottomColor = baseColor;
        el.style.filter = isNewlyAdded ? 'drop-shadow(0 0 4px #3b82f6)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
      });
    } else {
      el.addEventListener('mouseenter', () => {
        el.style.opacity = '0.8';
      });
      el.addEventListener('mouseleave', () => {
        el.style.opacity = '0.5';
      });
    }

    // Create marker
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([plant.longitude, plant.latitude])
      .addTo(map.current);

    // Store reference for later removal
    marker._element = el;

    // Click handler
    el.addEventListener('click', () => {
      // Only show pipeline for curated data points, not global plants
      if (isGlobal) {
        // For global plants, keep the old behavior
        const currentCenter = map.current.getCenter();
        const currentZoom = map.current.getZoom();
        setPreviousView({ center: [currentCenter.lng, currentCenter.lat], zoom: currentZoom });
        
        setSelectedPlant(plant);
        setSelectedPlantProjects([]);
        setSelectedUnit('all'); // Reset to show all units
        
        map.current.flyTo({
          center: [plant.longitude, plant.latitude],
          zoom: 10,
          duration: 1500,
          essential: true
        });
      } else {
        // For curated plants, show all projects for this plant in pipeline table
        const currentCenter = map.current.getCenter();
        const currentZoom = map.current.getZoom();
        setPreviousView({ center: [currentCenter.lng, currentCenter.lat], zoom: currentZoom });
        
        const plantName = plant['Plant Name'];
        const allProjects = mapData.filter(p => p['Plant Name'] === plantName);
        
        console.log(`Found ${allProjects.length} projects for ${plantName}`);
        setSelectedPlantProjects(allProjects);
        setSelectedPlant(plant);
        
        // Zoom to plant
        map.current.flyTo({
          center: [plant.longitude, plant.latitude],
          zoom: 10,
          duration: 1500,
          essential: true
        });
      }
    });

    setMarkers(prev => [...prev, marker]);
  };

  // Clean up radial markers and lines
  const clearRadialMarkers = () => {
    radialMarkersRef.current.forEach(m => m.remove());
    radialMarkersRef.current = [];
    // Remove SVG overlay if it exists
    const svg = document.getElementById('radial-lines-svg');
    if (svg) svg.remove();
    // Remove map move handler
    if (moveHandlerRef.current && map.current) {
      map.current.off('move', moveHandlerRef.current);
      map.current.off('zoom', moveHandlerRef.current);
      moveHandlerRef.current = null;
    }
  };

  // Group transactions by plant location key
  const getPlantGroups = (txns) => {
    const groups = {};
    txns.forEach(t => {
      const coords = t.location_coordinates;
      if (!coords) return;
      const [lat, lng] = coords.split(',').map(s => parseFloat(s?.trim()));
      if (isNaN(lat) || isNaN(lng)) return;
      
      // Use plant_name + rounded coords as grouping key
      const key = `${(t.plant_name || t.project_name || '').toLowerCase().trim()}_${lat.toFixed(3)}_${lng.toFixed(3)}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          plantName: t.plant_name || t.project_name || 'Unknown Plant',
          lat, lng,
          transactions: [],
        };
      }
      groups[key].transactions.push(t);
    });
    return groups;
  };

  // Add coal plant node (grey circle) for a group of transactions
  const addPlantNode = (group) => {
    if (!map.current) return;
    
    const { key, plantName, lat, lng, transactions: groupTxns } = group;
    const count = groupTxns.length;

    // Wrapper element for the marker (MapLibre controls transform on this)
    const wrapper = document.createElement('div');
    wrapper.className = 'plant-node-marker';
    wrapper.style.cursor = 'pointer';
    
    // Inner circle that we scale for hover (avoids conflicting with MapLibre's transform)
    const el = document.createElement('div');
    el.style.width = '44px';
    el.style.height = '44px';
    el.style.borderRadius = '50%';
    el.style.background = 'linear-gradient(135deg, #f8fafc, #cbd5e1)';
    el.style.border = '3px solid #94a3b8';
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.6)';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease';
    el.style.position = 'relative';
    el.style.zIndex = '10';
    
    // Count badge
    el.innerHTML = `<span style="
      font-size: 14px;
      font-weight: 700;
      color: #334155;
      line-height: 1;
      pointer-events: none;
    ">${count}</span>`;
    
    wrapper.appendChild(el);
    
    // Tooltip
    wrapper.title = `${plantName} — ${count} transaction${count !== 1 ? 's' : ''}`;
    
    // Hover effects on the inner circle (not the wrapper MapLibre controls)
    wrapper.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.15)';
      el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25), inset 0 1px 2px rgba(255,255,255,0.6)';
      el.style.border = '3px solid #64748b';
    });
    wrapper.addEventListener('mouseleave', () => {
      if (expandedPlantKeyRef.current !== key) {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.6)';
        el.style.border = '3px solid #94a3b8';
      }
    });

    const marker = new maplibregl.Marker({ element: wrapper, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map.current);

    marker._element = wrapper;
    wrapper.__plantGroupKey = key;
    wrapper.__plantGroup = group;
    wrapper.__innerEl = el;

    // Click handler — expand/collapse radial
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      
      if (expandedPlantKeyRef.current === key) {
        // Collapse
        clearRadialMarkers();
        expandedPlantKeyRef.current = null;
        setExpandedPlantKey(null);
        el.style.transform = 'scale(1)';
        el.style.border = '3px solid #94a3b8';
        el.style.background = 'linear-gradient(135deg, #f8fafc, #cbd5e1)';
        return;
      }
      
      // Collapse any previously expanded
      clearRadialMarkers();
      // Reset any previously highlighted node
      document.querySelectorAll('.plant-node-marker').forEach(node => {
        const inner = node.__innerEl || node;
        inner.style.transform = 'scale(1)';
        inner.style.border = '3px solid #94a3b8';
        inner.style.background = 'linear-gradient(135deg, #f8fafc, #cbd5e1)';
      });
      
      // Highlight this node
      expandedPlantKeyRef.current = key;
      setExpandedPlantKey(key);
      el.style.transform = 'scale(1.15)';
      el.style.border = '3px solid #475569';
      el.style.background = 'linear-gradient(135deg, #e2e8f0, #94a3b8)';
      
      // Create SVG overlay for lines
      const container = map.current.getContainer();
      let svg = document.getElementById('radial-lines-svg');
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'radial-lines-svg';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '5';
        container.appendChild(svg);
      }
      svg.innerHTML = '';
      
      // Calculate radial positions for transaction nodes
      const centerPoint = map.current.project([lng, lat]);
      const radius = 80 + (count * 10); // Expand radius based on count
      
      groupTxns.forEach((txn, i) => {
        const angle = (2 * Math.PI * i) / count - Math.PI / 2; // Start from top
        const tx = centerPoint.x + radius * Math.cos(angle);
        const ty = centerPoint.y + radius * Math.sin(angle);
        
        // Draw line from center to transaction node
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', centerPoint.x);
        line.setAttribute('y1', centerPoint.y);
        line.setAttribute('x2', tx);
        line.setAttribute('y2', ty);
        
        const statusColor = TRANSACTION_STATUS_COLORS[txn.transaction_status] || TRANSACTION_STATUS_COLORS.default;
        line.setAttribute('stroke', statusColor);
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-opacity', '0.6');
        line.setAttribute('stroke-dasharray', '4 3');
        
        // Animate the line in
        const length = Math.sqrt(Math.pow(tx - centerPoint.x, 2) + Math.pow(ty - centerPoint.y, 2));
        line.setAttribute('stroke-dashoffset', length);
        line.style.transition = 'stroke-dashoffset 0.4s ease';
        svg.appendChild(line);
        
        // Trigger animation
        requestAnimationFrame(() => {
          line.setAttribute('stroke-dasharray', `${length}`);
          line.setAttribute('stroke-dashoffset', '0');
        });
        
        // Create transaction node (smaller colored circle)
        const txnEl = document.createElement('div');
        txnEl.className = 'transaction-radial-node';
        txnEl.style.width = '32px';
        txnEl.style.height = '32px';
        txnEl.style.borderRadius = '50%';
        txnEl.style.backgroundColor = statusColor;
        txnEl.style.border = '2px solid white';
        txnEl.style.boxShadow = '0 3px 8px rgba(0,0,0,0.25)';
        txnEl.style.cursor = 'pointer';
        txnEl.style.display = 'flex';
        txnEl.style.alignItems = 'center';
        txnEl.style.justifyContent = 'center';
        txnEl.style.transition = 'all 0.2s ease';
        txnEl.style.opacity = '0';
        txnEl.style.transform = 'scale(0.3)';
        txnEl.style.position = 'absolute';
        txnEl.style.zIndex = '15';
        
        // Status initial letter
        const statusInitial = (txn.transaction_status || 'N')[0].toUpperCase();
        txnEl.innerHTML = `<span style="
          font-size: 11px;
          font-weight: 700;
          color: white;
          pointer-events: none;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        ">${statusInitial}</span>`;
        
        txnEl.title = `${txn.project_name || 'Transaction'} — ${txn.transaction_status || 'No status'}`;
        
        // Hover
        txnEl.addEventListener('mouseenter', () => {
          txnEl.style.transform = 'scale(1.25)';
          txnEl.style.boxShadow = '0 4px 14px rgba(0,0,0,0.35)';
        });
        txnEl.addEventListener('mouseleave', () => {
          txnEl.style.transform = 'scale(1)';
          txnEl.style.boxShadow = '0 3px 8px rgba(0,0,0,0.25)';
        });
        
        // Click — show transaction popup
        txnEl.addEventListener('click', (ev) => {
          ev.stopPropagation();
          
          const currentCenter = map.current.getCenter();
          const currentZoom = map.current.getZoom();
          setPreviousView({ center: [currentCenter.lng, currentCenter.lat], zoom: currentZoom });
          
          const [tLat, tLng] = txn.location_coordinates.split(',').map(s => parseFloat(s?.trim()));
          
          const plantData = {
            'Plant Name': txn.plant_name || txn.project_name,
            'Country': txn.country,
            'Capacity (MW)': txn.capacity_mw,
            'Operational Status': txn.operational_status || 'Operating',
            'Owner': txn.owner,
            'Start year': txn.start_year,
            latitude: tLat,
            longitude: tLng,
            isTransaction: true,
            transactionData: txn,
          };
          
          setSelectedPlant(plantData);
          setSelectedPlantProjects([]);
          setSelectedUnit('all');
          setSelectedPopupTab('details');
        });

        // Position the transaction node as a fixed overlay element
        const txnWrapper = document.createElement('div');
        txnWrapper.style.position = 'absolute';
        txnWrapper.style.left = `${tx}px`;
        txnWrapper.style.top = `${ty}px`;
        txnWrapper.style.transform = 'translate(-50%, -50%)';
        txnWrapper.style.zIndex = '15';
        txnWrapper.appendChild(txnEl);
        container.appendChild(txnWrapper);
        
        // Animate in with delay
        setTimeout(() => {
          txnEl.style.opacity = '1';
          txnEl.style.transform = 'scale(1)';
        }, 50 + i * 60);
        
        radialMarkersRef.current.push(txnWrapper);
      });

      // Update positions when map moves
      const updatePositions = () => {
        const newCenter = map.current.project([lng, lat]);
        const svgEl = document.getElementById('radial-lines-svg');
        
        groupTxns.forEach((txn, i) => {
          const angle = (2 * Math.PI * i) / count - Math.PI / 2;
          const newTx = newCenter.x + radius * Math.cos(angle);
          const newTy = newCenter.y + radius * Math.sin(angle);
          
          // Update wrapper position
          const wrapper = radialMarkersRef.current[i];
          if (wrapper) {
            wrapper.style.left = `${newTx}px`;
            wrapper.style.top = `${newTy}px`;
          }
          
          // Update line
          if (svgEl && svgEl.children[i]) {
            svgEl.children[i].setAttribute('x1', newCenter.x);
            svgEl.children[i].setAttribute('y1', newCenter.y);
            svgEl.children[i].setAttribute('x2', newTx);
            svgEl.children[i].setAttribute('y2', newTy);
          }
        });
      };
      
      moveHandlerRef.current = updatePositions;
      map.current.on('move', updatePositions);
      map.current.on('zoom', updatePositions);
    });

    setMarkers(prev => [...prev, marker]);
  };

  // Add transaction markers grouped by plant location
  const addTransactionMarkers = () => {
    if (!map.current || transactions.length === 0) return;
    
    const groups = getPlantGroups(transactions);
    Object.values(groups).forEach(group => {
      addPlantNode(group);
    });
  };

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    // Initialize MapLibre map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_API_KEY}`,
      center: [20, 20], // Center of world
      zoom: 2,
      attributionControl: true,
    });

    map.current.on('load', () => {
      // Add transaction markers (grouped as plant nodes with radial expansion)
      addTransactionMarkers();

      // Add navigation controls
      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Add fullscreen control
      map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');

      // Fit bounds to show all transaction markers
      if (transactions.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        let hasValidBounds = false;
        transactions.forEach(t => {
          if (t.location_coordinates) {
            const [lat, lng] = t.location_coordinates.split(',').map(s => parseFloat(s?.trim()));
            if (!isNaN(lat) && !isNaN(lng)) {
              bounds.extend([lng, lat]);
              hasValidBounds = true;
            }
          }
        });
        if (hasValidBounds) {
          map.current.fitBounds(bounds, { padding: 50, maxZoom: 6 });
        }
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="w-full h-[calc(100vh-64px)] flex items-center justify-center bg-secondary-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🗺️</div>
          <p className="text-secondary-600">Loading map...</p>
        </div>
      </div>
    );
  }



  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Add Plant Search */}
      <AddPlantSearch 
        onAddPlant={handleAddPlant} 
        onToggleGlobal={toggleGlobalPlants}
        showingGlobal={showAllGlobalPlants}
        onFilteredPlantsChange={setFilteredGlobalPlants}
        impactResults={impactResults}
      />
      
      {/* New Project Button */}
      <div className="absolute bottom-6 left-6">
        <button
          onClick={() => setShowCreateProject(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Selected plant details panel - positioned near the marker (for global plants only) */}
      {selectedPlant && selectedPlant.isGlobal && (() => {
        // Find impact results for this plant
        const plantImpacts = impactResults.filter(result => 
          result['Unique plant name']?.toLowerCase() === selectedPlant['Plant Name']?.toLowerCase() ||
          result['GEM Unique ID'] === selectedPlant['No']?.replace('GLOBAL-', '')
        );
        
        // Get the capacity to display based on selected unit
        const displayCapacity = selectedUnit === 'all'
          ? selectedPlant['Capacity (MW)']
          : (() => {
              // Look up unit capacity from unitDetails (loaded from global_coal_plants.xlsx)
              const unitDetail = selectedPlant.unitDetails?.find(u => u.unitName === selectedUnit);
              
              // If not found, it means this unit exists in impact results but not in global xlsx
              // In this case, just show the average capacity per unit
              if (!unitDetail && selectedPlant.unitDetails && selectedPlant.unitDetails.length > 0) {
                // Calculate average unit capacity as fallback
                const avgCapacity = selectedPlant['Capacity (MW)'] / plantImpacts.length;
                return Math.round(avgCapacity);
              }
              
              return unitDetail?.capacity || selectedPlant['Capacity (MW)'];
            })();
        
        // Get the impact data to display (either specific unit or aggregated)
        const displayImpact = selectedUnit === 'all' 
          ? plantImpacts.reduce((acc, impact) => {
              return {
                unitName: `All Units (${plantImpacts.length})`,
                co2: acc.co2 + (parseFloat(impact['Total avoided CO2 emissions (Mt)']) || 0),
                deaths: acc.deaths + (parseInt(impact['Total avoided deaths']?.replace(/,/g, '')) || 0),
                wlds: acc.wlds + (parseInt(impact['Total avoided Work Loss Days (WLDs)']?.replace(/,/g, '')) || 0),
                investment: acc.investment + (parseFloat(impact['Total investment (mn. USD)']?.replace(/[$,]/g, '')) || 0),
                spillover: acc.spillover + (parseFloat(impact['Economic spillover (mn. USD)']?.replace(/[$,]/g, '')) || 0),
                permJobs: acc.permJobs + (parseInt(impact['Net permanent jobs created']?.replace(/,/g, '')) || 0),
                tempJobs: acc.tempJobs + (parseInt(impact['Total temporary jobs created']?.replace(/,/g, '')) || 0),
                savings: acc.savings + (parseFloat(impact['Annual customer savings (mn USD)']?.replace(/[$,]/g, '')) || 0),
                savingsPercent: plantImpacts.length > 0 
                  ? (plantImpacts.reduce((sum, i) => sum + (parseFloat(i['Savings per kWh (%)']?.replace(/%/g, '')) || 0), 0) / plantImpacts.length).toFixed(0)
                  : null,
              };
            }, { co2: 0, deaths: 0, wlds: 0, investment: 0, spillover: 0, permJobs: 0, tempJobs: 0, savings: 0 })
          : (() => {
              const unitData = plantImpacts.find(impact => impact['Unit name'] === selectedUnit);
              if (!unitData) return null;
              return {
                unitName: unitData['Unit name'],
                co2: parseFloat(unitData['Total avoided CO2 emissions (Mt)']) || 0,
                deaths: parseInt(unitData['Total avoided deaths']?.replace(/,/g, '')) || 0,
                wlds: parseInt(unitData['Total avoided Work Loss Days (WLDs)']?.replace(/,/g, '')) || 0,
                investment: parseFloat(unitData['Total investment (mn. USD)']?.replace(/[$,]/g, '')) || 0,
                spillover: parseFloat(unitData['Economic spillover (mn. USD)']?.replace(/[$,]/g, '')) || 0,
                permJobs: parseInt(unitData['Net permanent jobs created']?.replace(/,/g, '')) || 0,
                tempJobs: parseInt(unitData['Total temporary jobs created']?.replace(/,/g, '')) || 0,
                savings: parseFloat(unitData['Annual customer savings (mn USD)']?.replace(/[$,]/g, '')) || 0,
                savingsPercent: parseFloat(unitData['Savings per kWh (%)']?.replace(/%/g, '')) || null,
              };
            })();
        
        return (
          <div 
            className="fixed bg-gradient-to-br from-white to-cyan-50/30 rounded-xl shadow-2xl border border-cyan-100/50 backdrop-blur-sm z-[100] max-h-[80vh] overflow-hidden" 
            style={{ 
              width: '640px',
              top: popupPosition.y !== null ? `calc(80px + ${popupPosition.y}px)` : '80px',
              left: popupPosition.x !== null ? `calc(50% + ${popupPosition.x}px)` : '50%',
              transform: popupPosition.x !== null ? 'translateX(-50%)' : 'translateX(-50%)',
            }}
          >
            {/* Draggable Header Bar */}
            <div 
              onMouseDown={handlePopupDragStart}
              onTouchStart={handlePopupDragStart}
              className="flex items-center justify-center py-1.5 cursor-move hover:bg-cyan-50/50 transition-colors rounded-t-xl border-b border-cyan-100/30"
            >
              <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
            </div>
            
            {/* Close button */}
            <button
              onClick={() => {
                if (previousView && map.current) {
                  map.current.flyTo({
                    center: previousView.center,
                    zoom: previousView.zoom,
                    duration: 1500,
                    essential: true
                  });
                }
                setSelectedPlant(null);
                setSelectedUnit('all');
                setSelectedPopupTab('details');
              }}
              className="absolute top-6 right-4 text-gray-400 hover:text-gray-600 transition-colors duration-200 z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Header Section */}
            <div className="px-8 pt-4 pb-6 border-b border-cyan-100/50">
              <h3 className="text-2xl font-semibold text-gray-800 mb-1 pr-8">{selectedPlant['Plant Name']}</h3>
              <p className="text-sm text-gray-500">{selectedPlant['Country']}</p>
              
              {/* Tabs */}
              <div className="flex space-x-4 mt-4">
                <button
                  onClick={() => setSelectedPopupTab('details')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedPopupTab === 'details'
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Plant Details
                </button>
                <button
                  onClick={() => setSelectedPopupTab('impact')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedPopupTab === 'impact'
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Impact Data {plantImpacts.length > 0 ? `(${plantImpacts.length})` : ''}
                </button>
              </div>
            </div>
            
            {/* Scrollable Content */}
            <div className="overflow-y-auto px-8 py-6" style={{ maxHeight: 'calc(80vh - 180px)' }}>
              {/* Plant Details Tab */}
              {selectedPopupTab === 'details' && (
                <>
                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Capacity</p>
                        <p className="text-base font-semibold text-gray-800">{displayCapacity} MW</p>
                        {selectedUnit !== 'all' && plantImpacts.length > 1 && (
                          <p className="text-xs text-gray-500 mt-0.5">Total plant: {selectedPlant['Capacity (MW)']} MW</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          {selectedPlant['Operational Status']}
                        </span>
                      </div>
                      {selectedPlant['Start year'] && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Start Year</p>
                          <p className="text-base font-semibold text-gray-800">{selectedPlant['Start year']}</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 text-sm">
                      {selectedPlant['Operator'] && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Operator</p>
                          <p className="text-base font-medium text-gray-700 leading-tight">{selectedPlant['Operator']}</p>
                        </div>
                      )}
                      {selectedPlant['Planned retirement year'] && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Planned Retirement</p>
                          <p className="text-base font-semibold text-gray-800">{selectedPlant['Planned retirement year']}</p>
                        </div>
                      )}
                      {selectedPlant['Owner'] && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Owner</p>
                          <p className="text-base font-medium text-gray-700 leading-tight">{selectedPlant['Owner']}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Additional Plant Details */}
                  <div className="mt-4 pt-4 border-t border-cyan-100/50">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Additional Information</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedPlant['Subnational unit (province, state)'] && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Region</p>
                          <p className="text-sm font-medium text-gray-700">{selectedPlant['Subnational unit (province, state)']}</p>
                        </div>
                      )}
                      {selectedPlant['Combustion technology'] && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Technology</p>
                          <p className="text-sm font-medium text-gray-700">{selectedPlant['Combustion technology']}</p>
                        </div>
                      )}
                      {selectedPlant['latitude'] && selectedPlant['longitude'] && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Coordinates</p>
                          <p className="text-sm font-medium text-gray-700">
                            {parseFloat(selectedPlant['latitude']).toFixed(4)}, {parseFloat(selectedPlant['longitude']).toFixed(4)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              {/* Impact Data Tab */}
              {selectedPopupTab === 'impact' && (
                <>
                  {plantImpacts.length > 0 ? (
                    <>
                      {/* Section Header with Unit Selector */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800">Impact Assessment</h4>
                          <p className="text-xs text-gray-500 mt-0.5">Baseline year: 2025</p>
                        </div>
                        
                        {/* Unit Selector Dropdown */}
                        {plantImpacts.length > 1 && (
                          <select
                            value={selectedUnit}
                            onChange={(e) => setSelectedUnit(e.target.value)}
                            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-cyan-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 transition-all duration-200 cursor-pointer hover:border-cyan-300"
                          >
                            <option value="all">All Units ({plantImpacts.length})</option>
                            {plantImpacts.map((impact, idx) => (
                              <option key={idx} value={impact['Unit name']}>
                                {impact['Unit name']}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      
                      {displayImpact && (
                        <>
                          {/* Currently viewing indicator */}
                          <div className="mb-4 px-3 py-2 bg-cyan-50/50 border border-cyan-100 rounded-lg">
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">Viewing:</span> {displayImpact.unitName}
                            </p>
                          </div>
                          
                          {/* Metrics Grid */}
                          <div className="grid grid-cols-2 gap-3">
                            {/* CO2 Emissions */}
                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-50/30 p-4 rounded-lg border border-emerald-100/50">
                              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-2">CO₂ Avoided</p>
                              <p className="text-2xl font-bold text-emerald-700">{displayImpact.co2.toFixed(2)}</p>
                              <p className="text-xs text-emerald-600 mt-0.5">Million Tonnes</p>
                            </div>
                            
                            {/* Deaths Avoided */}
                            <div className="bg-gradient-to-br from-blue-50 to-blue-50/30 p-4 rounded-lg border border-blue-100/50">
                              <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">Lives Saved</p>
                              <p className="text-2xl font-bold text-blue-700">{displayImpact.deaths.toLocaleString()}</p>
                              <p className="text-xs text-blue-600 mt-0.5">Deaths Avoided</p>
                            </div>
                            
                            {/* Work Loss Days */}
                            <div className="bg-gradient-to-br from-purple-50 to-purple-50/30 p-4 rounded-lg border border-purple-100/50">
                              <p className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-2">Health Impact</p>
                              <p className="text-2xl font-bold text-purple-700">{displayImpact.wlds.toLocaleString()}</p>
                              <p className="text-xs text-purple-600 mt-0.5">Work Days Recovered</p>
                            </div>
                            
                            {/* Investment */}
                            <div className="bg-gradient-to-br from-amber-50 to-amber-50/30 p-4 rounded-lg border border-amber-100/50">
                              <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-2">Investment</p>
                              <p className="text-2xl font-bold text-amber-700">${displayImpact.investment.toFixed(1)}M</p>
                              <p className="text-xs text-amber-600 mt-0.5">Total Capital</p>
                            </div>
                            
                            {/* Economic Spillover */}
                            <div className="bg-gradient-to-br from-orange-50 to-orange-50/30 p-4 rounded-lg border border-orange-100/50">
                              <p className="text-xs font-medium text-orange-600 uppercase tracking-wide mb-2">Economic Impact</p>
                              <p className="text-2xl font-bold text-orange-700">${displayImpact.spillover.toFixed(1)}M</p>
                              <p className="text-xs text-orange-600 mt-0.5">Spillover Effect</p>
                            </div>
                            
                            {/* Customer Savings */}
                            <div className="bg-gradient-to-br from-cyan-50 to-cyan-50/30 p-4 rounded-lg border border-cyan-100/50">
                              <p className="text-xs font-medium text-cyan-600 uppercase tracking-wide mb-2">Customer Savings</p>
                              <p className="text-2xl font-bold text-cyan-700">${displayImpact.savings.toFixed(1)}M</p>
                              {displayImpact.savingsPercent && (
                                <p className="text-xs text-cyan-600 mt-0.5">~{displayImpact.savingsPercent}% per kWh</p>
                              )}
                            </div>
                            
                            {/* Permanent Jobs */}
                            <div className="bg-gradient-to-br from-teal-50 to-teal-50/30 p-4 rounded-lg border border-teal-100/50">
                              <p className="text-xs font-medium text-teal-600 uppercase tracking-wide mb-2">Jobs Created</p>
                              <p className="text-2xl font-bold text-teal-700">{displayImpact.permJobs.toLocaleString()}</p>
                              <p className="text-xs text-teal-600 mt-0.5">Permanent Positions</p>
                            </div>
                            
                            {/* Temporary Jobs */}
                            <div className="bg-gradient-to-br from-sky-50 to-sky-50/30 p-4 rounded-lg border border-sky-100/50">
                              <p className="text-xs font-medium text-sky-600 uppercase tracking-wide mb-2">Temporary Jobs</p>
                              <p className="text-2xl font-bold text-sky-700">{displayImpact.tempJobs.toLocaleString()}</p>
                              <p className="text-xs text-sky-600 mt-0.5">Construction Phase</p>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-700 mb-2">No Impact Data Available</h4>
                      <p className="text-sm text-gray-500">Impact assessment data for this plant is not yet available.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Transaction Details Popup */}
      {selectedPlant && selectedPlant.isTransaction && (() => {
        const transaction = selectedPlant.transactionData;
        const transactionPlants = transaction?.plants || [];
        
        // Get status color
        const statusColors = {
          green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
          amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
          red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
          closed: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
        };
        const statusStyle = statusColors[transaction?.transaction_status] || statusColors.green;
        
        return (
          <div 
            className="fixed bg-gradient-to-br from-white to-cyan-50/30 rounded-xl shadow-2xl border border-cyan-100/50 backdrop-blur-sm z-[100] max-h-[80vh] overflow-hidden" 
            style={{ 
              width: '680px',
              top: popupPosition.y !== null ? `calc(80px + ${popupPosition.y}px)` : '80px',
              left: popupPosition.x !== null ? `calc(50% + ${popupPosition.x}px)` : '50%',
              transform: popupPosition.x !== null ? 'translateX(-50%)' : 'translateX(-50%)',
            }}
          >
            {/* Draggable Header Bar */}
            <div 
              onMouseDown={handlePopupDragStart}
              onTouchStart={handlePopupDragStart}
              className="flex items-center justify-center py-1.5 cursor-move hover:bg-cyan-50/50 transition-colors rounded-t-xl border-b border-cyan-100/30"
            >
              <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
            </div>
            
            {/* Close button */}
            <button
              onClick={() => {
                if (previousView && map.current) {
                  map.current.flyTo({
                    center: previousView.center,
                    zoom: previousView.zoom,
                    duration: 1500,
                    essential: true
                  });
                }
                setSelectedPlant(null);
                setSelectedUnit('all');
                setSelectedPopupTab('details');
              }}
              className="absolute top-6 right-4 text-gray-400 hover:text-gray-600 transition-colors duration-200 z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Header Section */}
            <div className="px-8 pt-4 pb-6 border-b border-cyan-100/50">
              <div className="flex items-start justify-between pr-8">
                <div>
                  <h3 className="text-2xl font-semibold text-gray-800 mb-1">{transaction?.project_name || 'Transaction'}</h3>
                  <p className="text-sm text-gray-500">{transaction?.country}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} border capitalize`}>
                  {transaction?.transaction_status || 'N/A'}
                </span>
              </div>
              
              {/* Tabs */}
              <div className="flex space-x-4 mt-4">
                <button
                  onClick={() => setSelectedPopupTab('details')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedPopupTab === 'details'
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Transaction Details
                </button>
                <button
                  onClick={() => setSelectedPopupTab('plants')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedPopupTab === 'plants'
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Coal Plants ({transactionPlants.length || 1})
                </button>
                <button
                  onClick={() => setSelectedPopupTab('impact')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    selectedPopupTab === 'impact'
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  Impact Data
                </button>
              </div>
            </div>
            
            {/* Scrollable Content */}
            <div className="overflow-y-auto px-8 py-6" style={{ maxHeight: 'calc(80vh - 180px)' }}>
              {/* Transaction Details Tab */}
              {selectedPopupTab === 'details' && (
                <>
                  <div className="grid grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Transaction Stage</p>
                        <p className="text-base font-semibold text-gray-800 capitalize">{transaction?.transaction_stage?.replace(/_/g, ' ') || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Expected Signing Date</p>
                        <p className="text-base font-semibold text-gray-800">{transaction?.expected_signing_date || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Owner</p>
                        <p className="text-base font-medium text-gray-700">{transaction?.owner || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Capacity</p>
                        <p className="text-base font-semibold text-gray-800">{transaction?.capacity_mw || 'N/A'} MW</p>
                      </div>
                    </div>
                    
                    {/* Right Column */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Transaction Confidence</p>
                        <p className="text-base font-semibold text-gray-800">{transaction?.transaction_confidence_rating || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Target Retirement Year</p>
                        <p className="text-base font-semibold text-gray-800">{transaction?.target_retirement_year || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Initial Retirement Year</p>
                        <p className="text-base font-semibold text-gray-800">{transaction?.initial_retirement_year || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Project Value</p>
                        <p className="text-base font-semibold text-gray-800">
                          {transaction?.project_value 
                            ? `${transaction?.deal_currency || 'USD'} ${parseFloat(transaction.project_value).toLocaleString()}`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Description */}
                  {transaction?.project_description && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Description</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{transaction.project_description}</p>
                    </div>
                  )}
                </>
              )}
              
              {/* Coal Plants Tab */}
              {selectedPopupTab === 'plants' && (
                <>
                  {transactionPlants.length > 0 ? (
                    <div className="space-y-4">
                      {transactionPlants.map((plant, idx) => (
                        <div key={plant.id || idx} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-gray-800">{plant.plant_name}</h4>
                              {plant.unit_name && (
                                <p className="text-sm text-gray-500">Unit: {plant.unit_name}</p>
                              )}
                            </div>
                            <span className="text-xs bg-white px-2 py-1 rounded border border-gray-200 text-gray-600 capitalize">
                              {plant.operational_status || 'Operating'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Capacity</p>
                              <p className="font-medium text-gray-800">{plant.capacity_mw || 'N/A'} MW</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Country</p>
                              <p className="font-medium text-gray-800">{plant.country || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Start Year</p>
                              <p className="font-medium text-gray-800">{plant.start_year || 'N/A'}</p>
                            </div>
                          </div>
                          {plant.owner && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-xs text-gray-500 mb-1">Owner</p>
                              <p className="text-sm text-gray-700">{plant.owner}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-800">{transaction?.plant_name || 'Plant'}</h4>
                        </div>
                        <span className="text-xs bg-white px-2 py-1 rounded border border-gray-200 text-gray-600 capitalize">
                          {transaction?.operational_status || 'Operating'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Capacity</p>
                          <p className="font-medium text-gray-800">{transaction?.capacity_mw || 'N/A'} MW</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Country</p>
                          <p className="font-medium text-gray-800">{transaction?.country || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Start Year</p>
                          <p className="font-medium text-gray-800">{transaction?.start_year || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {/* Impact Data Tab */}
              {selectedPopupTab === 'impact' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">Impact Data Coming Soon</h4>
                  <p className="text-sm text-gray-500">Impact assessment data for transactions will be available after analysis is complete.</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Pipeline Table - Bottom panel for curated plants */}
      {selectedPlantProjects.length > 0 && (
        <div className="fixed left-1/2 bg-white shadow-2xl rounded-lg z-50" style={{ bottom: '16px', height: `${panelHeight}vh`, width: 'calc(100% - 80px)', maxWidth: '1400px', transform: 'translateX(-50%)' }}>
          {/* Drag handle */}
          <div 
            onMouseDown={handleDragStart}
            className="flex items-center justify-center py-1 cursor-ns-resize hover:bg-secondary-100 rounded-t-lg transition-colors"
          >
            <div className="w-12 h-1 bg-secondary-300 rounded-full"></div>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-200">
            <div>
              <h3 className="font-bold text-lg">{selectedPlantProjects[0]['Plant Name']} - Pipeline</h3>
              <p className="text-sm text-secondary-600">{selectedPlantProjects.length} project{selectedPlantProjects.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => {
                // Zoom back out to previous view
                if (previousView && map.current) {
                  map.current.flyTo({
                    center: previousView.center,
                    zoom: previousView.zoom,
                    duration: 1500,
                    essential: true
                  });
                }
                // Close the panel and reset height
                setSelectedPlantProjects([]);
                setSelectedPlant(null);
                setPanelHeight(35);
              }}
              className="text-secondary-400 hover:text-secondary-600 text-xl font-bold w-8 h-8 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          <div className="overflow-x-auto overflow-y-auto" style={{ height: `calc(${panelHeight}vh - 100px)` }}>
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-secondary-700 border-b">Project Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-secondary-700 border-b">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-secondary-700 border-b">Project Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-secondary-700 border-b">Notes</th>
                  <th className="px-4 py-3 text-left font-semibold text-secondary-700 border-b">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {selectedPlantProjects.map((project, index) => (
                  <tr 
                    key={index} 
                    className="border-b border-secondary-100 hover:bg-emerald-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedProjectForDetail(project)}
                    title="Click to view project details and history"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-2">
                        {project['Project Name'] || 'Unnamed Project'}
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                      <div className="text-xs text-secondary-500">{project['Unit name'] || `Unit ${index + 1}`} • {project['Capacity (MW)']} MW</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        project['Operational Status'] === 'Operating' ? 'bg-green-100 text-green-800' :
                        project['Operational Status'] === 'Retired' ? 'bg-orange-100 text-orange-800' :
                        project['Operational Status'] === 'Planning' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {project['Operational Status']}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <div className="space-y-1 text-xs">
                        {project['Transition type'] && (
                          <p><span className="font-medium">Transition:</span> {project['Transition type']}</p>
                        )}
                        {project['Financial mechanism'] && (
                          <p><span className="font-medium">Mechanism:</span> {project['Financial mechanism']}</p>
                        )}
                        {project['Planned post-retirement status'] && (
                          <p><span className="font-medium">Post-retirement:</span> {project['Planned post-retirement status']}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <div className="space-y-1 text-xs">
                        {project['Intelligence on Transaction Status'] && (
                          <p className="text-secondary-700">{project['Intelligence on Transaction Status']}</p>
                        )}
                        {project['Lender(s)/ Funder(s) involved'] && (
                          <p><span className="font-medium">Funders:</span> {project['Lender(s)/ Funder(s) involved']}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary-500">
                      {project['Last Updated'] || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProjectForDetail && (
        <ProjectDetail
          project={selectedProjectForDetail}
          onClose={() => setSelectedProjectForDetail(null)}
          onUpdate={(updatedProject) => {
            // Update the project in our local state
            setSelectedPlantProjects(prev => 
              prev.map(p => p.id === updatedProject.id ? { ...p, ...updatedProject } : p)
            );
            setMapData(prev =>
              prev.map(p => p.id === updatedProject.id ? { ...p, ...updatedProject } : p)
            );
            // Refresh the selected project detail with updated data
            setSelectedProjectForDetail(updatedProject);
          }}
        />
      )}

      {/* Create Project Modal */}
      {showCreateProject && (
        <CreateProject
          onClose={() => {
            setShowCreateProject(false);
            handleProvisionalMarker(null); // Clear provisional marker on close
          }}
          onProjectCreated={handleProjectCreated}
          onProvisionalMarker={handleProvisionalMarker}
        />
      )}
    </div>
  );
};

export default MapView;
