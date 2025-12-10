import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Papa from 'papaparse';
import AddPlantSearch from './AddPlantSearch';

const MapView = ({ userEmail }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapData, setMapData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [previousView, setPreviousView] = useState(null); // Store previous map view
  const [markers, setMarkers] = useState([]); // Store marker references
  const [showAllGlobalPlants, setShowAllGlobalPlants] = useState(false);
  const [globalPlants, setGlobalPlants] = useState([]);
  const [filteredGlobalPlants, setFilteredGlobalPlants] = useState([]);

  // MapTiler API key - Get your free key from https://cloud.maptiler.com/
  // Sign up, go to Account > Keys, and copy your key here
  const MAPTILER_API_KEY = 'YnAuJTg55khmx1RkyRXM'; // Replace with your actual API key

  useEffect(() => {
    // Load CSV data
    fetch('/src/data/data.csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            filterAndProcessData(results.data, userEmail);
          },
          error: (error) => {
            console.error('Error parsing CSV:', error);
            setIsLoading(false);
          }
        });
      })
      .catch(err => {
        console.error('Error loading CSV:', err);
        setIsLoading(false);
      });
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
    
    // Add marker to the map immediately
    if (map.current) {
      addMarkerToMap(newPlant, true); // true flag indicates it's newly added
      
      // Fly to the new plant location
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

  const loadGlobalPlants = async (callback) => {
    try {
      const XLSX = await import('xlsx');
      const response = await fetch('/src/data/global_coal_plants.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      // Group by unique plant (not by unit)
      const uniquePlants = new Map();
      
      data.forEach(plant => {
        if (!plant.Latitude || !plant.Longitude) return;
        if (plant['Status']?.toLowerCase() !== 'operating') return;
        
        const plantKey = `${plant['Plant name']}_${plant.Latitude}_${plant.Longitude}`;
        
        // If we haven't seen this plant yet, or if this unit has higher capacity, use it
        if (!uniquePlants.has(plantKey)) {
          uniquePlants.set(plantKey, plant);
        } else {
          const existing = uniquePlants.get(plantKey);
          const currentCapacity = parseFloat(plant['Capacity (MW)']) || 0;
          const existingCapacity = parseFloat(existing['Capacity (MW)']) || 0;
          
          // Sum up capacities for the same plant
          uniquePlants.set(plantKey, {
            ...existing,
            'Capacity (MW)': existingCapacity + currentCapacity,
          });
        }
      });
      
      // Convert to array and process
      const processedGlobal = Array.from(uniquePlants.values()).map(plant => ({
        'No': `GLOBAL-${plant['GEM location ID'] || Math.random()}`,
        'Plant Name': plant['Plant name'] || 'Unknown',
        'Unit name': 'Combined Units',
        'Capacity (MW)': plant['Capacity (MW)'] || 0,
        'Country': plant['Country/Area'] || '',
        'Operational Status': 'Operating',
        'Start year': plant['Start year'] || '',
        'Planned retirement year': plant['Planned retirement'] || '',
        'Location (coordinates)': `${plant.Latitude}, ${plant.Longitude}`,
        'Operator': plant['Owner'] || '',
        'Owner': plant['Owner'] || '',
        'Parent': plant['Parent'] || '',
        'Transition type': '',
        'Financial mechanism': '',
        'Information Status': 'Global Database',
        'Email extension': '',
        latitude: parseFloat(plant.Latitude),
        longitude: parseFloat(plant.Longitude),
        isGlobal: true,
      }));
      
      console.log(`Loaded ${processedGlobal.length} unique plants from global database`);
      
      setGlobalPlants(processedGlobal);
      if (callback) callback(processedGlobal);
    } catch (error) {
      console.error('Error loading global plants:', error);
    }
  };

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
    
    const size = isGlobal ? '16px' : '30px'; // Even smaller for global
    el.style.width = size;
    el.style.height = size;
    el.style.borderRadius = '50%';
    el.style.position = 'absolute';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.opacity = isGlobal ? '0.5' : '1';
    
    // Store plant data on element for filtering
    el.__plantData = plant;
    
    // Color code by operational status
    const statusColors = {
      'Operating': '#10b981',
      'operating': '#10b981', // lowercase version
      'Retired': '#f59e0b',
      'Planning': '#3b82f6',
    };
    el.style.backgroundColor = statusColors[plant['Operational Status']] || '#6b7280';
    el.style.border = isNewlyAdded ? '3px solid #3b82f6' : isGlobal ? '1px solid white' : '3px solid white';
    el.style.cursor = 'pointer';
    el.style.boxShadow = isGlobal ? '0 1px 2px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.3)';

    // Only add hover for non-global or simplified hover for global
    if (!isGlobal) {
      el.addEventListener('mouseenter', () => {
        el.style.width = '36px';
        el.style.height = '36px';
      });
      el.addEventListener('mouseleave', () => {
        el.style.width = '30px';
        el.style.height = '30px';
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
      const currentCenter = map.current.getCenter();
      const currentZoom = map.current.getZoom();
      setPreviousView({ center: [currentCenter.lng, currentCenter.lat], zoom: currentZoom });
      
      setSelectedPlant(plant);
      
      map.current.flyTo({
        center: [plant.longitude, plant.latitude],
        zoom: 10,
        duration: 1500,
        essential: true
      });
    });

    setMarkers(prev => [...prev, marker]);
  };

  useEffect(() => {
    if (map.current || mapData.length === 0) return; // Initialize map only once

    // Initialize MapLibre map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_API_KEY}`,
      center: [20, 20], // Center of world
      zoom: 2,
      attributionControl: true,
    });

    map.current.on('load', () => {
      // Add markers for each power plant using the helper function
      mapData.forEach((plant) => {
        addMarkerToMap(plant, false);
      });

      // Add navigation controls
      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Add fullscreen control
      map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');

      // Fit bounds to show all markers
      if (mapData.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        mapData.forEach(plant => {
          bounds.extend([plant.longitude, plant.latitude]);
        });
        map.current.fitBounds(bounds, { padding: 50, maxZoom: 6 });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapData]);

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

  if (mapData.length === 0) {
    return (
      <div className="w-full h-[calc(100vh-64px)] flex items-center justify-center bg-secondary-50">
        <div className="text-center">
          <p className="text-secondary-600">No location data available for your organization.</p>
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
      />
      
      {/* Legend */}
      <div className="absolute bottom-6 left-6 bg-white rounded-lg shadow-lg p-4 max-w-xs">
        <h4 className="font-semibold text-sm mb-3">Power Plant Status</h4>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
            <span className="text-xs">Operating ({
              mapData.filter(p => p['Operational Status'] === 'Operating').length + 
              (showAllGlobalPlants ? filteredGlobalPlants.filter(p => p['Operational Status'] === 'Operating').length : 0)
            })</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white"></div>
            <span className="text-xs">Retired ({
              mapData.filter(p => p['Operational Status'] === 'Retired').length + 
              (showAllGlobalPlants ? filteredGlobalPlants.filter(p => p['Operational Status'] === 'Retired').length : 0)
            })</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
            <span className="text-xs">Planning ({
              mapData.filter(p => p['Operational Status'] === 'Planning').length + 
              (showAllGlobalPlants ? filteredGlobalPlants.filter(p => p['Operational Status'] === 'Planning').length : 0)
            })</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-gray-500 border-2 border-white"></div>
            <span className="text-xs">Other/Unknown ({
              mapData.filter(p => !['Operating', 'Retired', 'Planning'].includes(p['Operational Status'])).length + 
              (showAllGlobalPlants ? filteredGlobalPlants.filter(p => !['Operating', 'Retired', 'Planning'].includes(p['Operational Status'])).length : 0)
            })</span>
          </div>
        </div>
        <p className="text-xs text-secondary-500 mt-3">Total: {
          mapData.length + (showAllGlobalPlants ? filteredGlobalPlants.length : 0)
        } plants</p>
      </div>

      {/* Selected plant details panel - positioned near the marker */}
      {selectedPlant && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-xl p-6 max-w-md z-10">
          <button
            onClick={() => {
              // Zoom back out to previous view first
              if (previousView && map.current) {
                map.current.flyTo({
                  center: previousView.center,
                  zoom: previousView.zoom,
                  duration: 1500,
                  essential: true
                });
              }
              // Then close the panel
              setSelectedPlant(null);
            }}
            className="absolute top-2 right-2 text-secondary-400 hover:text-secondary-600 text-xl font-bold w-6 h-6 flex items-center justify-center"
          >
            ✕
          </button>
          <h3 className="font-bold text-lg mb-4">{selectedPlant['Plant Name']}</h3>
          <div className="space-y-2 text-sm">
            {selectedPlant['Unit name'] && (
              <p><span className="font-medium">Unit:</span> {selectedPlant['Unit name']}</p>
            )}
            <p><span className="font-medium">Capacity:</span> {selectedPlant['Capacity (MW)']} MW</p>
            <p><span className="font-medium">Country:</span> {selectedPlant['Country']}</p>
            <p><span className="font-medium">Status:</span> {selectedPlant['Operational Status']}</p>
            {selectedPlant['Operator'] && (
              <p><span className="font-medium">Operator:</span> {selectedPlant['Operator']}</p>
            )}
            {selectedPlant['Start year'] && (
              <p><span className="font-medium">Start Year:</span> {selectedPlant['Start year']}</p>
            )}
            {selectedPlant['Planned retirement year'] && (
              <p><span className="font-medium">Planned Retirement:</span> {selectedPlant['Planned retirement year']}</p>
            )}
            {selectedPlant['Transition type'] && (
              <p className="mt-3"><span className="font-medium">Transition Type:</span> {selectedPlant['Transition type']}</p>
            )}
            {selectedPlant['Financial mechanism'] && (
              <p><span className="font-medium">Financial Mechanism:</span> {selectedPlant['Financial mechanism']}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
