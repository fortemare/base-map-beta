/* Fortemare Base Map Beta Version - Uniform loaders */

// -------------------- Global variables --------------------
let map = null
const layers = {}
const layerStates = {}

// Layer registry
const layerRegistry = {
  percorso_a: { url: "data/percorsi/percorso-a_consigliato.geojson", loader: loadPercorsoA, alwaysVisible: true },
  percorso_marittimo: { url: "data/percorsi/percorso-marittimo.geojson", loader: loadPercorsoMarittimo, alwaysVisible: false },
  towers: { url: "data/towers.geojson", loader: loadPercorsoATorri, alwaysVisible: true },
  aree_archeologiche: { url: "data/aree_archeologiche.geojson", loader: loadPercorsoAAreeArcheologiche, alwaysVisible: true },
  aree_marine_protette: { url: "data/aree-marine-protette.geojson", loader: loadAreeMarineProtette, alwaysVisible: true },
  riserve_regionali: { url: "data/riserve-regionali.geojson", loader: loadRiserveRegionali, alwaysVisible: true },
}

// cache per evitare duplicati (SVG inline)
const svgPatternsLoaded = new Set()

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
  if (layerName === "percorso_a") return zoom >= SHAPES_MIN_ZOOM
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

  if (!newState && map.hasLayer(layers[layerName])) {
    map.removeLayer(layers[layerName])
    showLayerFeedback(`${layerName} layer disabled`)
  }

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
  setTimeout(() => {
    feedback.style.opacity = "0"
  }, 2000)
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
      console.warn(`Load failed for ${layerName} (attempt ${attempt}/${maxRetries})`, error)
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
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
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

// -------------------- Proj utils --------------------
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

async function ensureProj4(requiredCode) {
  if (!window.proj4) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.8.0/proj4.js")
    if (!window.proj4) throw new Error("proj4 failed to load")
  }

  if (!proj4.defs || !proj4.defs["EPSG:32633"]) {
    proj4.defs("EPSG:32633", "+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs")
  }

  if (requiredCode) {
    const key = `EPSG:${requiredCode}`
    if (!proj4.defs[key]) {
      try {
        const res = await fetch(`https://epsg.io/${requiredCode}.proj4`)
        if (!res.ok) throw new Error(`Failed to fetch proj4 definition for EPSG:${requiredCode}`)
        const proj4def = (await res.text()).trim()
        if (proj4def) proj4.defs(key, proj4def)
      } catch (err) {
        console.warn(`Could not load proj4 def for EPSG:${requiredCode}:`, err)
      }
    }
  }
}

function reprojectGeoJSON(geojson, fromProj = "EPSG:32633", toProj = "WGS84") {
  if (!geojson || !geojson.features) return

  const transformCoords = (coords) => {
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lon, lat] = proj4(fromProj, toProj, coords)
      return [lon, lat]
    }
    return coords.map(transformCoords)
  }

  geojson.features.forEach((feat) => {
    if (!feat.geometry) return
    feat.geometry.coordinates = transformCoords(feat.geometry.coordinates)
  })

  if (geojson.crs) delete geojson.crs
}

// -------------------- NEW: Shared helpers (NO plugin) --------------------
async function loadGeoJsonReprojected(url) {
  const data = await fetchWithTimeout(url)

  const crsName = data?.crs?.properties?.name || ""
  const has32633 = /32633/.test(crsName) || /EPSG:\:\:32633/.test(crsName)
  const codeMatch = crsName.match(/(\d{3,5})/)

  if (has32633) {
    await ensureProj4()
    reprojectGeoJSON(data, "EPSG:32633", "WGS84")
    return data
  }

  if (codeMatch) {
    const code = codeMatch[1]
    await ensureProj4(code)
    const key = `EPSG:${code}`
    if (proj4?.defs?.[key]) reprojectGeoJSON(data, key, "WGS84")
    else console.warn(`CRS ${crsName} detected but no proj4 definition available for EPSG:${code}; skipping reprojection`)
  }

  return data
}

function applyInlinePatternOnAdd(layer, patternId) {
  if (!patternId) return
  layer.on("add", () => {
    requestAnimationFrame(() => {
      const el = layer.getElement && layer.getElement()
      if (!el) return
      const nodes = el.nodeName === "g" ? el.querySelectorAll("path,polygon,rect") : [el]
      nodes.forEach((n) => n.setAttribute("fill", `url(#${patternId})`))
    })
  })
}

async function buildGeoJsonLayer({
  layerName,
  url,
  filterFn,
  style,
  popupTitleFn,
  popupBodyFn,
  inlinePattern, // { id, url, w, h } or null
  autoAdd = true,
}) {
  const data = await loadGeoJsonReprojected(url)

  let inlinePatternId = null
  if (inlinePattern) {
    inlinePatternId = await ensureSvgPattern(
      inlinePattern.id,
      inlinePattern.url,
      inlinePattern.w ?? 40,
      inlinePattern.h ?? 40
    )
  }

  const geoLayer = L.geoJSON(data, {
    filter: filterFn,
    style: typeof style === "function" ? style : style,
    onEachFeature: (feature, layer) => {
      const title = popupTitleFn?.(feature) || ""
      const body = popupBodyFn?.(feature) || ""
      if (title || body) layer.bindPopup(`<strong>${title}</strong><br>${body}`)
      if (inlinePatternId) applyInlinePatternOnAdd(layer, inlinePatternId)
    },
  })

  registerLayer(layerName, geoLayer)

  if (autoAdd && map && canShowLayer(layerName, map.getZoom())) {
    map.addLayer(geoLayer)
  }

  return geoLayer
}

// -------------------- Layer Loaders (uniform) --------------------

// Percorso A (line)
async function loadPercorsoA() {
  const layer = await buildGeoJsonLayer({
    layerName: "percorso_a",
    url: "data/percorsi/percorso-a_consigliato.geojson",
    style: {
      color: "#1100ffff",
      weight: 3,
      opacity: 1,
    },
    popupTitleFn: (f) =>
      f.properties?.DENOM || f.properties?.name || (f.properties?.id ? `ID: ${f.properties.id}` : ""),
    popupBodyFn: (f) => f.properties?.description || "",
    inlinePattern: null,
  })

  // fit bounds
  if (map && layer?.getBounds) {
    const bounds = layer.getBounds()
    const ok = bounds && (typeof bounds.isValid === "function" ? bounds.isValid() : true)
    if (ok) {
      try {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
      } catch (e) {
        console.warn("fitBounds failed:", e)
      }
    }
  }
}

// Percorso Marittimo (line)
async function loadPercorsoMarittimo() {
  await buildGeoJsonLayer({
    layerName: "percorso_marittimo",
    url: "data/percorsi/percorso-a_marittimo.geojson",
    style: {
      color: "#0000ffff",
      weight: 3,
      opacity: 1,
      dashArray: "8,4",
    },
    popupTitleFn: (f) =>
      f.properties?.DENOM || f.properties?.name || (f.properties?.id ? `ID: ${f.properties.id}` : ""),
    popupBodyFn: (f) => f.properties?.description || "",
    inlinePattern: null,
  })
}

// Aree Archeologiche (polygon + inline pattern)
async function loadPercorsoAAreeArcheologiche() {
  await buildGeoJsonLayer({
    layerName: "aree_archeologiche",
    url: "data/aree-archeologiche.geojson",
    filterFn: (f) => f?.properties?.percorso === "percorso-a",
    style: () => ({
      color: "#00aa00ff",
      weight: 3,
      opacity: 1,
      fillOpacity: 1,
      fillColor: "#ffffff", // base (verrà sovrascritto dal pattern via attribute)
    }),
    popupTitleFn: (f) =>
      f.properties?.DENOM || f.properties?.name || f.properties?.["SITIPOLY-ID"] || "",
    popupBodyFn: (f) => f.properties?.description || "",
    inlinePattern: { id: "arch-pattern", url: "icons/arch-pattern.svg", w: 40, h: 40 },
  })
}

// Aree Marine Protette (polygon + inline pattern)
async function loadAreeMarineProtette() {
  await buildGeoJsonLayer({
    layerName: "aree_marine_protette",
    url: "data/aree-marine-protette.geojson",
    filterFn: (f) => f?.properties?.percorso === "percorso-a",
    style: () => ({
      color: "#0000ffff",
      weight: 2,
      opacity: 0.7,
      fillOpacity: 1,
      fillColor: "#ffffff",
    }),
    popupTitleFn: (f) => f.properties?.nome_gazze || "",
    popupBodyFn: (f) => f.properties?.description || "",
    inlinePattern: { id: "aree-marine-pattern", url: "icons/aree-marine-pattern.svg", w: 40, h: 40 },
  })
}

// Riserve Regionali (polygon + inline pattern)
async function loadRiserveRegionali() {
  await buildGeoJsonLayer({
    layerName: "riserve_regionali",
    url: "data/riserve-regionali.geojson",
    filterFn: (f) => f?.properties?.percorso === "percorso-a",
    style: () => ({
      color: "#8dcd1fff",
      weight: 2,
      opacity: 0.7,
      fillOpacity: 1,
      fillColor: "#ffffff",
    }),
    popupTitleFn: (f) => f.properties?.nome_gazze || f.properties?.DENOM || f.properties?.name || "",
    popupBodyFn: (f) => f.properties?.description || "",
    inlinePattern: { id: "riserve-pattern", url: "icons/riserve-pattern.svg", w: 40, h: 40 },
  })
}

// Torri (markers + cluster) — left specific but uses shared reprojection
async function loadPercorsoATorri() {
  const data = await loadGeoJsonReprojected("data/towers.geojson")

  const towerIcon = L.icon({
    iconUrl: "icons/tower.svg",
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -36],
  })

  const markersCluster = L.markerClusterGroup()

  const geo = L.geoJSON(data, {
    filter: (feature) => feature?.properties?.percorso === "percorso-a",
    pointToLayer: (feature, latlng) => {
      const marker = L.marker(latlng, { icon: towerIcon })
      const title = feature.properties?.DENOM || feature.properties?.name || "Torre"
      marker.bindPopup(`<strong>${title}</strong><br>${feature.properties?.description || ""}`)
      return marker
    },
  })

  markersCluster.addLayer(geo)

  registerLayer("towers", markersCluster)
  if (canShowLayer("towers", map.getZoom())) map.addLayer(markersCluster)
}

// -------------------- SVG Pattern injection in Leaflet SVG <defs> --------------------
async function ensureSvgPattern(patternId, svgUrl, width = 40, height = 40) {
  if (svgPatternsLoaded.has(patternId)) return patternId

  function waitForMapSvg() {
    return new Promise((resolve) => {
      function check() {
        const svg = document.querySelector("svg.leaflet-zoom-animated")
        if (svg) resolve(svg)
        else setTimeout(check, 50)
      }
      check()
    })
  }

  const svg = await waitForMapSvg()

  let defs = svg.querySelector("defs")
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
    svg.insertBefore(defs, svg.firstChild)
  }

  if (defs.querySelector(`#${patternId}`)) {
    svgPatternsLoaded.add(patternId)
    return patternId
  }

  const response = await fetch(svgUrl)
  if (!response.ok) throw new Error(`Pattern SVG not found: ${svgUrl} (${response.status})`)
  const patternSvgText = await response.text()

  const temp = document.createElement("div")
  temp.innerHTML = patternSvgText.trim()
  const patternContent = temp.querySelector("svg") || temp.firstChild

  const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern")
  pattern.setAttribute("id", patternId)
  pattern.setAttribute("patternUnits", "userSpaceOnUse")
  pattern.setAttribute("width", width)
  pattern.setAttribute("height", height)

  while (patternContent.firstChild) {
    pattern.appendChild(patternContent.firstChild)
  }

  defs.appendChild(pattern)
  svgPatternsLoaded.add(patternId)

  return patternId
}
