/* global L */

// Global variables
let map = null
const layers = {
  towers: null,
  mazara: null,
}
const layerStates = {
 towers: true,
 mazara: true,
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing map application")
  // Wait for Leaflet to be available
  waitForLeaflet()
    .then(() => {
      initializeMap()
    })
    .catch((error) => {
      console.error("Failed to load Leaflet:", error)
      showErrorMessage("Failed to load map library. Please refresh the page.")
    })
})

// Wait for Leaflet library to be available
function waitForLeaflet(maxAttempts = 50) {
  return new Promise((resolve, reject) => {
    let attempts = 0

    const checkLeaflet = () => {
      attempts++

      if (typeof window.L !== "undefined" && window.L.map) {
        console.log("Leaflet library loaded successfully")
        resolve()
      } else if (attempts >= maxAttempts) {
        reject(new Error("Leaflet library failed to load"))
      } else {
        setTimeout(checkLeaflet, 100)
      }
    }

    checkLeaflet()
  })
}

// Initialize the Leaflet map
function initializeMap() {
  console.log("Initializing map")

  // Verify Leaflet is available
  if (typeof window.L === "undefined") {
    showErrorMessage("Map library not available. Please refresh the page.")
    return
  }

  // Fix default marker icons
  delete window.L.Icon.Default.prototype._getIconUrl
  window.L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  })

  // Create map centered on Sicily
  map = window.L.map("map").setView([37.599, 14.015], 8);

  // Add OpenStreetMap tiles
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map)

  map.on("zoomend", handleZoomChange)

  // Hide loading indicator and show controls
  document.getElementById("loading").style.display = "none"
  document.getElementById("layer-controls").style.display = "block"

  // Load GeoJSON layers
  loadGeoJSONLayers()
}

function handleZoomChange() {
  const currentZoom = map.getZoom()
  console.log("Zoom changed to:", currentZoom)

  // Define zoom thresholds
  const ROUTES_MIN_ZOOM = 12 // Routes visible at zoom 12 and above
  const SHAPES_MIN_ZOOM = 5 // Towers and cities visible at zoom 10 and above

  // Handle routes layer visibility
  if (layers.routes && layerStates.routes) {
    if (currentZoom >= ROUTES_MIN_ZOOM) {
      if (!map.hasLayer(layers.routes)) {
        map.addLayer(layers.routes)
        showZoomFeedback("Routes layer shown (zoom ≥ 12)")
      }
    } else {
      if (map.hasLayer(layers.routes)) {
        map.removeLayer(layers.routes)
        showZoomFeedback("Routes layer hidden (zoom < 12)")
      }
    }
  }

  // Handle shapes layers (towers and cities) visibility
  const shapeLayers = ["towers", "cities"]
  shapeLayers.forEach((layerName) => {
    if (layers[layerName] && layerStates[layerName]) {
      if (currentZoom >= SHAPES_MIN_ZOOM) {
        if (!map.hasLayer(layers[layerName])) {
          map.addLayer(layers[layerName])
          showZoomFeedback(`${layerName} layer shown (zoom ≥ 10)`)
        }
      } else {
        if (map.hasLayer(layers[layerName])) {
          map.removeLayer(layers[layerName])
          showZoomFeedback(`${layerName} layer hidden (zoom < 10)`)
        }
      }
    }
  })

  // Update control visual feedback based on zoom visibility
  updateZoomBasedControlFeedback(currentZoom)
}

function updateZoomBasedControlFeedback(currentZoom) {
  const ROUTES_MIN_ZOOM = 12
  const SHAPES_MIN_ZOOM = 10

  // Update routes control
  const routesLabel = document.querySelector('label[for="routes"]')
  const routesCheckbox = document.getElementById("routes")
  if (routesLabel && routesCheckbox) {
    if (currentZoom < ROUTES_MIN_ZOOM) {
      routesLabel.style.opacity = "0.4"
      routesLabel.title = `Routes visible at zoom ${ROUTES_MIN_ZOOM}+ (current: ${currentZoom})`
    } else {
      routesLabel.style.opacity = routesCheckbox.checked ? "1" : "0.6"
      routesLabel.title = ""
    }
  }

  // Update shapes controls
  const shapeControls = ["towers", "cities"]
  shapeControls.forEach((layerName) => {
    const label = document.querySelector(`label[for="${layerName}"]`)
    const checkbox = document.getElementById(layerName)
    if (label && checkbox) {
      if (currentZoom < SHAPES_MIN_ZOOM) {
        label.style.opacity = "0.4"
        label.title = `${layerName} visible at zoom ${SHAPES_MIN_ZOOM}+ (current: ${currentZoom})`
      } else {
        label.style.opacity = checkbox.checked ? "1" : "0.6"
        label.title = ""
      }
    }
  })
}

/*------ONLY FOR DEBUGGING------*/
function showZoomFeedback(message) {
  // Create or update feedback element
  let feedback = document.getElementById("zoom-feedback")
  if (!feedback) {
    feedback = document.createElement("div")
    feedback.id = "zoom-feedback"
    feedback.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: var(--secondary);
            color: var(--secondary-foreground);
            padding: 8px 16px;
            border-radius: var(--radius);
            border: 1px solid var(--border);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            font-size: 0.875rem;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            max-width: 250px;
        `
    document.body.appendChild(feedback)
  }

  feedback.textContent = message
  feedback.style.opacity = "1"

  // Hide after 3 seconds
  setTimeout(() => {
    feedback.style.opacity = "0"
  }, 3000)
}

/*------DATA LOADING------*/

// Enhanced data loading system with error handling and retry
async function loadGeoJSONLayers() {
  const loadingStates = {
    towers: false,
  }

  try {
    console.log("Loading GeoJSON layers")
    updateLoadingProgress("Loading map data...")

    // Load all layers concurrently with individual error handling
    const loadPromises = [
     // loadLayerWithRetry("pins", loadPinsLayer, loadingStates),
      loadLayerWithRetry("towers", loadTowersLayer, loadingStates),
      loadLayerWithRetry("mazara", loadMazaraLayer, loadingStates),
     // loadLayerWithRetry("routes", loadRoutesLayer, loadingStates),
    ]

    await Promise.allSettled(loadPromises)

    // Check if at least one layer loaded successfully
    const successfulLayers = Object.values(loadingStates).filter(Boolean).length
    if (successfulLayers === 0) {
      throw new Error("Failed to load any map layers")
    }

    console.log("Layers loaded successfully:", loadingStates)
    updateLoadingProgress(`Loaded ${successfulLayers}/4 layers successfully`)

    // Initialize layer controls after layers are loaded
    setTimeout(() => {
      initializeLayerControls()
      updateLoadingProgress("Map ready!")
      setTimeout(() => hideLoadingIndicator(), 1000)
    }, 500)
  } catch (error) {
    console.error("Error loading GeoJSON data:", error)
    showErrorMessage("Failed to load map data. Please refresh the page to try again.")
  }
}

// Load layer with retry mechanism
async function loadLayerWithRetry(layerName, loadFunction, loadingStates, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      updateLoadingProgress(`Loading ${layerName}... (${attempt}/${maxRetries})`)
      await loadFunction()
      loadingStates[layerName] = true
      console.log(`${layerName} loaded successfully`)
      return
    } catch (error) {
      console.warn(`Failed to load ${layerName} (attempt ${attempt}):`, error)
      if (attempt === maxRetries) {
        console.error(`Failed to load ${layerName} after ${maxRetries} attempts`)
        loadingStates[layerName] = false
        // Disable the checkbox for failed layers
        setTimeout(() => {
          const checkbox = document.getElementById(layerName)
          const label = document.querySelector(`label[for="${layerName}"]`)
          if (checkbox && label) {
            checkbox.disabled = true
            checkbox.checked = false
            label.style.opacity = "0.5"
            label.title = `Failed to load ${layerName} data`
          }
        }, 100)
      } else {
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      }
    }
  }
}

// Update loading progress message
function updateLoadingProgress(message) {
  const loadingText = document.querySelector(".loading-text")
  if (loadingText) {
    loadingText.textContent = message
  }
}

// Hide loading indicator
function hideLoadingIndicator() {
  document.getElementById("loading").style.display = "none"
  document.getElementById("layer-controls").style.display = "block"
}

// Show error message
function showErrorMessage(message) {
  const loadingContainer = document.getElementById("loading")
  const loadingText = document.querySelector(".loading-text")

  if (loadingText) {
    loadingText.textContent = message
    loadingText.style.color = "var(--destructive)"
  }

  // Add retry button
  if (!document.getElementById("retry-button")) {
    const retryButton = document.createElement("button")
    retryButton.id = "retry-button"
    retryButton.textContent = "Retry"
    retryButton.style.cssText = `
            margin-top: 1rem;
            padding: 0.5rem 1rem;
            background: var(--primary);
            color: var(--primary-foreground);
            border: none;
            border-radius: var(--radius);
            cursor: pointer;
            font-family: var(--font-sans);
        `
    retryButton.addEventListener("click", () => {
      location.reload()
    })
    loadingContainer.appendChild(retryButton)
  }
}

// Enhanced fetch with timeout
async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } finally {
    clearTimeout(timeoutId)
  }
}

/*------LAYER LOADINGS------*/

// Clustered Towers Layer
async function loadTowersLayer() {
  const data = await fetchWithTimeout("data/towers.geojson")
  console.log("Towers data loaded (for clustering):", data)

  const markersCluster = window.L.markerClusterGroup({
    disableClusteringAtZoom: 18, // never stop clustering until max zoom
    maxClusterRadius: 200,       // large enough to cluster all markers at low zoom
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false
  })

  const towersLayer = window.L.geoJSON(data, {
    onEachFeature: (feature, layer) => {
      if (feature.properties && feature.properties.name) {
        layer.bindPopup(`<strong>${feature.properties.DENOM}</strong><br>${feature.properties.description || ""}`)
      }
    },
  })

  markersCluster.addLayer(towersLayer)
  map.addLayer(markersCluster)
  layers.towers = markersCluster
}

/* Load Val di Mazara Layer */
async function loadMazaraLayer() {
  const data = await fetchWithTimeout("data/val-di-mazara.geojson")
  console.log("Val di Mazara data loaded:", data)

  const mazaraLayer = window.L.geoJSON(data, {
    style: {
      fillColor: "#228B22",
      weight: 2,
      opacity: 1,
      color: "#006400",
      dashArray: "3",
      fillOpacity: 0.4,
    },
    onEachFeature: (feature, layer) => {
      if (feature.properties && feature.properties.name) {
        layer.bindPopup(`<strong>Tower: ${feature.properties.DENOM}</strong><br>${feature.properties.description || ""}`)
      }
    },
  })

  map.addLayer(mazaraLayer)
  layers.mazara = mazaraLayer
}
 

/*------LAYER UI------*/

// Initialize layer control event listeners
function initializeLayerControls() {
  console.log("Initializing layer controls")

  // Add event listeners for each checkbox
  const checkboxes = ["pins", "towers", "mazara"]

  checkboxes.forEach((layerName) => {
    const checkbox = document.getElementById(layerName)
    const label = document.querySelector(`label[for="${layerName}"]`)

    if (checkbox && label) {
      checkbox.addEventListener("change", () => {
        toggleLayer(layerName)
        updateControlVisualFeedback(layerName, checkbox.checked)
      })

      checkbox.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          checkbox.checked = !checkbox.checked
          checkbox.dispatchEvent(new Event("change"))
        }
      })

      label.addEventListener("click", (e) => {
        if (e.target === label) {
          checkbox.checked = !checkbox.checked
          checkbox.dispatchEvent(new Event("change"))
        }
      })
    }
  })

  const currentZoom = map.getZoom()
  updateZoomBasedControlFeedback(currentZoom)
}

function updateControlVisualFeedback(layerName, isEnabled) {
  const label = document.querySelector(`label[for="${layerName}"]`)
  const controlItem = label?.parentElement

  if (controlItem) {
    if (isEnabled) {
      controlItem.style.opacity = "1"
      label.style.color = "var(--foreground)"
    } else {
      controlItem.style.opacity = "0.6"
      label.style.color = "var(--muted-foreground)"
    }
  }
}

// Toggle layer visibility
function toggleLayer(layerName) {
  console.log("Toggling layer:", layerName)

  if (!map || !layers[layerName]) {
    console.log("Map or layer missing:", { map: !!map, layer: !!layers[layerName] })
    return
  }

  const checkbox = document.getElementById(layerName)
  const newState = checkbox.checked
  layerStates[layerName] = newState  // <-- ONLY this matters

  const currentZoom = map.getZoom()

  // If zoom already high enough, show immediately
  if (newState && canShowLayer(layerName, currentZoom)) {
    if (!map.hasLayer(layers[layerName])) {
      map.addLayer(layers[layerName])
    }
    showLayerFeedback(`${layerName} layer enabled`)
  }

  // If disabled, always remove immediately
  if (!newState && map.hasLayer(layers[layerName])) {
    map.removeLayer(layers[layerName])
    showLayerFeedback(`${layerName} layer disabled`)
  }

  // Update UI
  updateZoomBasedControlFeedback(currentZoom)
}



function showLayerFeedback(message) {
  // Create or update feedback element
  let feedback = document.getElementById("layer-feedback")
  if (!feedback) {
    feedback = document.createElement("div")
    feedback.id = "layer-feedback"
    feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--card);
            color: var(--card-foreground);
            padding: 8px 16px;
            border-radius: var(--radius);
            border: 1px solid var(--border);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            font-size: 0.875rem;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        `
    document.body.appendChild(feedback)
  }

  feedback.textContent = message
  feedback.style.opacity = "1"

  // Hide after 2 seconds
  setTimeout(() => {
    feedback.style.opacity = "0"
  }, 2000)
}
