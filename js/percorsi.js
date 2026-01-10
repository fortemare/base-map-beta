/* Fortemare Base Map Beta Version */

// Global variables
let map = null
const layers = {}
const layerStates = {}

// Layer registry: add new layers here
// `alwaysVisible` = true → ignore zoom thresholds
const layerRegistry = {
  percorso_a: { url: "data/percorsi/percorso-a_consigliato.geojson", loader: loadPercorsoA, alwaysVisible: true },
  percorso_a_torri: { url: "data/percorsi/percorso-a_torri.geojson", loader: loadPercorsoATorri, alwaysVisible: false }
}

// -------------------- Initialization --------------------
document.addEventListener("DOMContentLoaded", () => {
  waitForLeaflet()
    .then(() => initializeMap())
    .catch((error) => {
      console.error("Failed to load Leaflet:", error)
      showErrorMessage("Failed to load map library. Please refresh the page.")
    })
})

function waitForLeaflet(maxAttempts = 50) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const checkLeaflet = () => {
      attempts++
      if (typeof window.L !== "undefined" && window.L.map) resolve()
      else if (attempts >= maxAttempts) reject(new Error("Leaflet library failed to load"))
      else setTimeout(checkLeaflet, 100)
    }
    checkLeaflet()
  })
}

// -------------------- Map Setup --------------------
function initializeMap() {
  delete window.L.Icon.Default.prototype._getIconUrl
  window.L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  })

  map = L.map("map").setView([37.599, 14.015], 8)

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map)

  map.on("zoomend", handleZoomChange)

  document.getElementById("loading").style.display = "none"
  document.getElementById("layer-controls").style.display = "block"

  loadGeoJSONLayers()
}

// -------------------- Zoom & Visibility --------------------
function canShowLayer(layerName, zoom) {
  const SHAPES_MIN_ZOOM = 2
  const ROUTES_MIN_ZOOM = 12
  if (layerName === "percorso_a") return zoom >= SHAPES_MIN_ZOOM
  //if (layerName === "routes") return zoom >= ROUTES_MIN_ZOOM
  return true
}

function handleZoomChange() {
  const currentZoom = map.getZoom()
  Object.keys(layers).forEach((layerName) => {
    const layer = layers[layerName]
    if (!layer) return
    const { alwaysVisible } = layerRegistry[layerName] || {}

    if (layerStates[layerName] && (alwaysVisible || canShowLayer(layerName, currentZoom))) {
      if (!map.hasLayer(layer)) map.addLayer(layer)
    } else {
      if (!alwaysVisible && map.hasLayer(layer)) map.removeLayer(layer)
    }
  })
  updateZoomBasedControlFeedback(currentZoom)
}

// -------------------- Layer Control --------------------
function toggleLayer(layerName) {
  if (!map || !layers[layerName]) return

  const checkbox = document.getElementById(layerName)
  const newState = checkbox.checked
  layerStates[layerName] = newState
  const currentZoom = map.getZoom()
  const { alwaysVisible } = layerRegistry[layerName] || {}

  // Remove if unchecked
  if (!newState && map.hasLayer(layers[layerName])) {
    map.removeLayer(layers[layerName])
    showLayerFeedback(`${layerName} layer disabled`)
  }

  // Add if checked and either always visible or zoom allows
  if (newState && (alwaysVisible || canShowLayer(layerName, currentZoom))) {
    if (!map.hasLayer(layers[layerName])) {
      map.addLayer(layers[layerName])
      showLayerFeedback(`${layerName} layer enabled`)
    }
  }

  updateZoomBasedControlFeedback(currentZoom)
}

function updateControlVisualFeedback(layerName, isEnabled) {
  const label = document.querySelector(`label[for="${layerName}"]`)
  const controlItem = label?.parentElement
  if (!label || !controlItem) return
  if (isEnabled) {
    controlItem.style.opacity = "1"
    label.style.color = "var(--foreground)"
  } else {
    controlItem.style.opacity = "0.6"
    label.style.color = "var(--muted-foreground)"
  }
}

function updateZoomBasedControlFeedback(currentZoom) {
  Object.keys(layers).forEach((layerName) => {
    const label = document.querySelector(`label[for="${layerName}"]`)
    const checkbox = document.getElementById(layerName)
    if (!label || !checkbox) return
    const { alwaysVisible } = layerRegistry[layerName] || {}
    if (!alwaysVisible && !canShowLayer(layerName, currentZoom)) {
      label.style.opacity = "0.4"
      label.title = `${layerName} visible at higher zoom (current: ${currentZoom})`
    } else {
      label.style.opacity = checkbox.checked ? "1" : "0.6"
      label.title = ""
    }
  })
}

function showLayerFeedback(message) {
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
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
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
  setTimeout(() => { feedback.style.opacity = "0" }, 2000)
}

function registerLayer(layerName, layerObject) {
  layers[layerName] = layerObject
  if (layerStates[layerName] === undefined) layerStates[layerName] = true
}

function initializeLayerControls() {
  Object.keys(layers).forEach((layerName) => {
    const checkbox = document.getElementById(layerName)
    const label = document.querySelector(`label[for="${layerName}"]`)
    if (!checkbox || !label) return

    checkbox.checked = !!layerStates[layerName]

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
  })

  handleZoomChange()
}

// -------------------- GeoJSON Loading --------------------
async function loadGeoJSONLayers() {
  const loadingStates = {}
  try {
    updateLoadingProgress("Loading map data...")

    const loadPromises = Object.keys(layerRegistry).map(async (layerName) => {
      loadingStates[layerName] = false
      const { loader } = layerRegistry[layerName]
      await loadLayerWithRetry(layerName, loader, loadingStates)
    })

    await Promise.allSettled(loadPromises)

    const successfulLayers = Object.values(loadingStates).filter(Boolean).length
    if (successfulLayers === 0) throw new Error("Failed to load any layers")

    updateLoadingProgress(`Loaded ${successfulLayers}/${Object.keys(layerRegistry).length} layers successfully`)

    setTimeout(() => {
      initializeLayerControls()
      updateLoadingProgress("Map ready!")
      setTimeout(() => hideLoadingIndicator(), 500)
    }, 500)

  } catch (error) {
    console.error("Error loading layers:", error)
    showErrorMessage("Failed to load map data. Please refresh the page.")
  }
}

async function loadLayerWithRetry(layerName, loadFunction, loadingStates, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      updateLoadingProgress(`Loading ${layerName}... (${attempt}/${maxRetries})`)
      await loadFunction()
      loadingStates[layerName] = true
      return
    } catch (error) {
      if (attempt === maxRetries) {
        loadingStates[layerName] = false
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
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }
}

function updateLoadingProgress(message) {
  const loadingText = document.querySelector(".loading-text")
  if (loadingText) loadingText.textContent = message
}

function hideLoadingIndicator() {
  document.getElementById("loading").style.display = "none"
  document.getElementById("layer-controls").style.display = "block"
}

function showErrorMessage(message) {
  const loadingContainer = document.getElementById("loading")
  const loadingText = document.querySelector(".loading-text")
  if (loadingText) {
    loadingText.textContent = message
    loadingText.style.color = "var(--destructive)"
  }
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
    retryButton.addEventListener("click", () => location.reload())
    loadingContainer.appendChild(retryButton)
  }
}

async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "Cache-Control": "no-cache" } })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

// -------------------- Layer Loaders --------------------

// Utility: dynamically load a script
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script")
    s.src = url
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${url}`))
    document.head.appendChild(s)
  })
}

// Ensure proj4 is available and EPSG:32633 is defined
async function ensureProj4() {
  if (window.proj4) return
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.8.0/proj4.js")
  if (!window.proj4) throw new Error("proj4 failed to load")
  if (!proj4.defs || !proj4.defs['EPSG:32633']) {
    // UTM zone 33N, WGS84
    proj4.defs('EPSG:32633', '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs')
  }
}

// Reproject GeoJSON coordinates from `fromProj` to `toProj`
function reprojectGeoJSON(geojson, fromProj = 'EPSG:32633', toProj = 'WGS84') {
  if (!geojson || !geojson.features) return

  const transformCoords = (coords) => {
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      // coords: [x, y]
      const [lon, lat] = proj4(fromProj, toProj, coords)
      return [lon, lat]
    }
    return coords.map(transformCoords)
  }

  geojson.features.forEach((feat) => {
    if (!feat.geometry) return
    feat.geometry.coordinates = transformCoords(feat.geometry.coordinates)
  })

  // Remove CRS to avoid confusion
  if (geojson.crs) delete geojson.crs
}

// Percorso A (respect zoom) — now handles EPSG:32633 by reprojecting to WGS84
async function loadPercorsoA() {
  const data = await fetchWithTimeout("data/percorsi/percorso-a_consigliato.geojson")

  // If file declares a projected CRS, reproject to WGS84
  const crsName = data?.crs?.properties?.name || ''
  if (/32633/.test(crsName) || /EPSG:\:\:32633/.test(crsName)) {
    await ensureProj4()
    reprojectGeoJSON(data, 'EPSG:32633', 'WGS84')
  }

  const percorsoALayer = L.geoJSON(data, {
    style: {
      color: "#1100ffff",
      weight: 3,
      opacity: 1,
      //dashArray: "3",
    },
    onEachFeature: (feature, layer) => {
      const title = feature.properties?.DENOM || feature.properties?.name || (feature.properties?.id ? `ID: ${feature.properties.id}` : '')
      if (title) layer.bindPopup(`<strong>${title}</strong><br>${feature.properties?.description || ''}`)
    },
  })

  // register with the same key used in layerRegistry and control IDs
  registerLayer("percorso_a", percorsoALayer)

  // Center map on percorso_a: fit bounds if available
  if (map) {
    const bounds = percorsoALayer.getBounds()
    if (bounds && typeof bounds.isValid === 'function' ? bounds.isValid() : (bounds && bounds.getNorthWest)) {
      try {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
      } catch (e) {
        console.warn('fitBounds failed:', e)
      }
    }
  }

  if (canShowLayer("percorso_a", map.getZoom())) map.addLayer(percorsoALayer)
}

// Percorso A - Torri (respect zoom)
async function loadPercorsoATorri() {
  const data = await fetchWithTimeout("data/percorsi/percorso-a_torri.geojson")

  // If file declares a projected CRS, reproject to WGS84
  const crsName = data?.crs?.properties?.name || ''
  if (/32633/.test(crsName) || /EPSG:\:\:32633/.test(crsName)) {
    await ensureProj4()
    reprojectGeoJSON(data, 'EPSG:32633', 'WGS84')
  }

  const percorsoATorriLayer = L.geoJSON(data, {
    style: {
      color: "#ff5500ff",
      weight: 3,
      opacity: 1,
      //dashArray: "5,5",
    },
    onEachFeature: (feature, layer) => {
      const title = feature.properties?.DENOM || feature.properties?.name || (feature.properties?.id ? `ID: ${feature.properties.id}` : '')
      if (title) layer.bindPopup(`<strong>${title}</strong><br>${feature.properties?.description || ''}`)
    },
  })

  // register with the same key used in layerRegistry and control IDs
  registerLayer("percorso_a_torri", percorsoATorriLayer)

  if (canShowLayer("percorso_a_torri", map.getZoom())) map.addLayer(percorsoATorriLayer)
}

