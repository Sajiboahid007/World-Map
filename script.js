/**
 * ==============================================================================
 * Interactive Zoomable World Map (2026 Ultra Edition)
 * Continents • Countries • States & Provinces • Cities • Towns • Villages
 * Ultra High Performance (60+ FPS) • Up to 60x Zoom • Clean Hover & Select
 * ==============================================================================
 */

(function () {
  'use strict';

  // Base SVG Dimensions
  const SVG_WIDTH = 1010;
  const SVG_HEIGHT = 666;

  // Global State
  const state = {
    // Transform parameters
    x: 0,
    y: 0,
    scale: 1,
    minScale: 0.75,
    maxScale: 60.0, // Deep zoom so every state/province is clearly visible!

    // Pointer & Drag Tracking
    isDragging: false,
    dragMoved: false,
    startX: 0,
    startY: 0,
    prevPointerX: 0,
    prevPointerY: 0,

    // Touch & Pinch
    activeTouches: new Map(),
    initialPinchDist: 0,
    initialPinchScale: 1,
    pinchCenter: { x: 0, y: 0 },

    // Animation & RAF Render Queue
    renderScheduled: false,
    animating: false,
    rafId: null,

    // Map Data
    countries: {},
    places: [],
    selectedCountryId: null,
    hoveredCountryId: null,

    // UI Configuration
    activeContinent: 'all',
    theme: 'light',
    currentLodLevel: 'zoom-level-1',

    // Search Autocomplete
    searchResults: [],
    selectedResultIndex: -1
  };

  // Continent Bounding Boxes for Quick Jump
  const CONTINENT_BOUNDS = {
    'North America': { x: 0, y: 50, width: 420, height: 420 },
    'South America': { x: 230, y: 390, width: 200, height: 260 },
    'Europe': { x: 440, y: 150, width: 220, height: 240 },
    'Africa': { x: 440, y: 320, width: 220, height: 320 },
    'Asia': { x: 570, y: 100, width: 380, height: 400 },
    'Oceania': { x: 760, y: 460, width: 240, height: 200 },
    'all': { x: 0, y: 0, width: SVG_WIDTH, height: SVG_HEIGHT }
  };

  // DOM Elements Cache
  const dom = {};

  /**
   * Initialize Map Application
   */
  async function initMap() {
    cacheDomElements();
    setupTheme();

    try {
      const data = await loadCountryData();
      state.countries = data.countries || {};
      state.places = data.cities || [];
    } catch (err) {
      console.error('Failed to load dataset:', err);
    }

    renderLabelsAndPlaces();
    bindEvents();

    fitWorldToViewport(false);

    console.log(`[WorldMap 2026] Ready. Loaded ${Object.keys(state.countries).length} countries, ${state.places.length} places (including states & provinces).`);
  }

  function cacheDomElements() {
    dom.viewport = document.getElementById('map-viewport');
    dom.stage = document.getElementById('map-stage');
    dom.overlays = document.getElementById('map-overlays');
    dom.svg = document.getElementById('svg-world-map');
    dom.countries = document.querySelectorAll('.country');

    dom.searchInput = document.getElementById('search-input');
    dom.searchResults = document.getElementById('search-results');
    dom.clearSearchBtn = document.getElementById('clear-search-btn');
    dom.themeToggleBtn = document.getElementById('theme-toggle-btn');
    dom.themeIconMoon = document.getElementById('theme-icon-moon');
    dom.themeIconSun = document.getElementById('theme-icon-sun');

    dom.continentPills = document.getElementById('continent-pills');
    dom.countryCard = document.getElementById('country-card');
    dom.closeCardBtn = document.getElementById('close-card-btn');
    dom.zoomToCountryBtn = document.getElementById('zoom-to-country-btn');
    dom.resetCardBtn = document.getElementById('reset-card-btn');

    dom.cardFlag = document.getElementById('card-flag');
    dom.cardName = document.getElementById('card-name');
    dom.cardNative = document.getElementById('card-native');
    dom.cardContinentTag = document.getElementById('card-continent-tag');
    dom.cardCodeTag = document.getElementById('card-code-tag');
    dom.cardCapital = document.getElementById('card-capital');
    dom.cardPopulation = document.getElementById('card-population');
    dom.cardArea = document.getElementById('card-area');
    dom.cardCurrency = document.getElementById('card-currency');
    dom.cardLanguages = document.getElementById('card-languages');

    dom.zoomInBtn = document.getElementById('zoom-in-btn');
    dom.zoomOutBtn = document.getElementById('zoom-out-btn');
    dom.resetViewBtn = document.getElementById('reset-view-btn');
    dom.zoomSlider = document.getElementById('zoom-slider');
    dom.zoomIndicator = document.getElementById('zoom-indicator');
    dom.fullscreenBtn = document.getElementById('fullscreen-btn');

    dom.scaleGraphic = document.getElementById('scale-graphic');
    dom.scaleLabel = document.getElementById('scale-label');
    dom.coordsLabel = document.getElementById('coords-label');
    dom.tooltip = document.getElementById('country-tooltip');
    dom.tooltipFlag = document.getElementById('tooltip-flag');
    dom.tooltipText = document.getElementById('tooltip-text');

    // Ensure zoom slider supports deep 60x zoom
    if (dom.zoomSlider) {
      dom.zoomSlider.max = '60';
    }
  }

  async function loadCountryData() {
    try {
      const response = await fetch('countries.json');
      if (response.ok) return await response.json();
    } catch (e) {}

    const fallbackElem = document.getElementById('embedded-countries');
    if (fallbackElem && fallbackElem.textContent.trim()) {
      return JSON.parse(fallbackElem.textContent);
    }
    return { countries: {}, cities: [] };
  }

  /**
   * Render Country Labels & Places (States, Cities, Towns, Villages)
   */
  function renderLabelsAndPlaces() {
    dom.overlays.innerHTML = '';
    const fragment = document.createDocumentFragment();

    // 1. Country Labels
    for (const [code, c] of Object.entries(state.countries)) {
      if (!c.center || c.center.x === 0) continue;

      const label = document.createElement('div');
      label.className = `country-label tier-${c.lod}`;
      label.id = `label-${code.toLowerCase()}`;
      label.textContent = c.name;
      label.style.left = `${c.center.x}px`;
      label.style.top = `${c.center.y}px`;

      fragment.appendChild(label);
    }

    // 2. Places (States, Cities, Towns, Villages)
    for (const place of state.places) {
      const marker = document.createElement('div');
      const placeType = place.type || (place.isCapital ? 'capital' : 'city');
      const tier = place.tier || (place.isCapital ? 1 : (place.type === 'state' ? 3 : 2));

      marker.className = `place-marker type-${placeType} tier-${tier}`;
      marker.style.left = `${place.x}px`;
      marker.style.top = `${place.y}px`;

      if (placeType === 'state') {
        // State and province label (clean, uppercase cartographic text)
        const name = document.createElement('span');
        name.className = 'place-name';
        name.textContent = place.name;
        marker.appendChild(name);
      } else {
        // City / Town / Village marker
        const content = document.createElement('div');
        content.className = 'place-content';

        const dot = document.createElement('div');
        dot.className = 'place-dot';

        const name = document.createElement('span');
        name.className = 'place-name';
        name.textContent = place.name;

        content.appendChild(dot);
        content.appendChild(name);
        marker.appendChild(content);

        if (place.area) {
          const sub = document.createElement('span');
          sub.className = 'place-sub';
          sub.textContent = place.area;
          marker.appendChild(sub);
        }

        marker.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetZoom = placeType === 'village' ? 16.0 : (placeType === 'town' ? 10.0 : 6.0);
          zoomToLocation(place.x, place.y, targetZoom);
          if (place.countryCode) {
            showCountryInfo(place.countryCode);
          }
        });
      }

      fragment.appendChild(marker);
    }

    dom.overlays.appendChild(fragment);
  }

  /**
   * Ultra-Fast Hardware Accelerated Render Loop
   * Uses single requestAnimationFrame queue to prevent any layout thrashing or lag
   */
  function requestTransform() {
    if (state.renderScheduled) return;
    state.renderScheduled = true;

    requestAnimationFrame(() => {
      // 1. Direct GPU transform
      dom.stage.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;

      // 2. Update inverse scale CSS variables
      const inverse = 1 / state.scale;
      dom.viewport.style.setProperty('--zoom-scale', state.scale);
      dom.viewport.style.setProperty('--inverse-scale', inverse.toFixed(4));

      // 3. Update slider and percentage readout
      if (dom.zoomSlider) dom.zoomSlider.value = state.scale;
      if (dom.zoomIndicator) dom.zoomIndicator.textContent = `${Math.round(state.scale * 100)}%`;

      // 4. Update LOD class only when crossing threshold boundaries
      updateLODClass();

      // 5. Update scale bar
      updateScaleBar();

      state.renderScheduled = false;
    });
  }

  /**
   * Update Level-of-Detail class only when crossing threshold boundaries
   */
  function updateLODClass() {
    const s = state.scale;
    let target = 'zoom-level-1';

    if (s >= 10.0) {
      target = 'zoom-level-4'; // Deep state, towns, and villages
    } else if (s >= 4.5) {
      target = 'zoom-level-3'; // States, provinces, and regional hubs
    } else if (s >= 1.8) {
      target = 'zoom-level-2'; // Major regional cities
    }

    if (state.currentLodLevel !== target) {
      dom.viewport.classList.remove(state.currentLodLevel);
      dom.viewport.classList.add(target);
      state.currentLodLevel = target;
    }
  }

  /**
   * Google Maps style cursor-centric zoom
   */
  function handleZoom(zoomFactor, originX, originY) {
    const rect = dom.viewport.getBoundingClientRect();
    const cursorX = originX !== undefined ? originX - rect.left : rect.width / 2;
    const cursorY = originY !== undefined ? originY - rect.top : rect.height / 2;

    const oldScale = state.scale;
    let newScale = oldScale * zoomFactor;

    newScale = Math.max(state.minScale, Math.min(state.maxScale, newScale));
    if (Math.abs(newScale - oldScale) < 0.0001) return;

    const factor = newScale / oldScale;
    state.x = cursorX - (cursorX - state.x) * factor;
    state.y = cursorY - (cursorY - state.y) * factor;
    state.scale = newScale;

    clampBounds();
    requestTransform();
  }

  /**
   * Direct Pan translation
   */
  function handlePan(dx, dy) {
    state.x += dx;
    state.y += dy;
    clampBounds();
    requestTransform();
  }

  function clampBounds() {
    const vw = dom.viewport.clientWidth;
    const vh = dom.viewport.clientHeight;
    const mapW = SVG_WIDTH * state.scale;
    const mapH = SVG_HEIGHT * state.scale;

    const marginX = vw * 0.45;
    const marginY = vh * 0.45;

    const minX = vw - mapW - marginX;
    const maxX = marginX;
    const minY = vh - mapH - marginY;
    const maxY = marginY;

    state.x = Math.max(minX, Math.min(maxX, state.x));
    state.y = Math.max(minY, Math.min(maxY, state.y));
  }

  function fitWorldToViewport(animate = true) {
    const vw = dom.viewport.clientWidth || window.innerWidth;
    const vh = dom.viewport.clientHeight || window.innerHeight;

    const padding = 25;
    const scaleX = (vw - padding * 2) / SVG_WIDTH;
    const scaleY = (vh - padding * 2) / SVG_HEIGHT;
    const targetScale = Math.max(state.minScale, Math.min(scaleX, scaleY, 1.4));

    const targetX = (vw - SVG_WIDTH * targetScale) / 2;
    const targetY = (vh - SVG_HEIGHT * targetScale) / 2;

    if (animate) {
      smoothAnimateCamera(targetX, targetY, targetScale);
    } else {
      state.x = targetX;
      state.y = targetY;
      state.scale = targetScale;
      requestTransform();
    }
  }

  function zoomToBBox(bbox, maxZoom = 18.0) {
    const vw = dom.viewport.clientWidth;
    const vh = dom.viewport.clientHeight;

    const isMobile = window.innerWidth <= 640;
    const leftPad = isMobile ? 30 : 380;
    const rightPad = 30;
    const topPad = isMobile ? 80 : 60;
    const bottomPad = isMobile ? 220 : 60;

    const availW = Math.max(200, vw - leftPad - rightPad);
    const availH = Math.max(200, vh - topPad - bottomPad);

    const padBoxW = Math.max(bbox.width, 10);
    const padBoxH = Math.max(bbox.height, 10);

    const sX = availW / padBoxW;
    const sY = availH / padBoxH;
    let targetScale = Math.min(sX, sY);

    targetScale = Math.max(1.2, Math.min(maxZoom, targetScale));

    const centerX = bbox.cx || (bbox.x + bbox.width / 2);
    const centerY = bbox.cy || (bbox.y + bbox.height / 2);

    const targetX = leftPad + (availW / 2) - (centerX * targetScale);
    const targetY = topPad + (availH / 2) - (centerY * targetScale);

    smoothAnimateCamera(targetX, targetY, targetScale);
  }

  function zoomToLocation(worldX, worldY, targetScale = 8.0) {
    const vw = dom.viewport.clientWidth;
    const vh = dom.viewport.clientHeight;

    const isMobile = window.innerWidth <= 640;
    const offsetX = isMobile ? vw / 2 : (vw + 340) / 2;
    const offsetY = isMobile ? (vh - 120) / 2 : vh / 2;

    const targetX = offsetX - (worldX * targetScale);
    const targetY = offsetY - (worldY * targetScale);

    smoothAnimateCamera(targetX, targetY, targetScale);
  }

  function smoothAnimateCamera(targetX, targetY, targetScale, duration = 650) {
    if (state.rafId) cancelAnimationFrame(state.rafId);

    const startX = state.x;
    const startY = state.y;
    const startScale = state.scale;
    const startTime = performance.now();

    state.animating = true;

    function ease(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = ease(progress);

      state.x = startX + (targetX - startX) * eased;
      state.y = startY + (targetY - startY) * eased;
      state.scale = startScale + (targetScale - startScale) * eased;

      requestTransform();

      if (progress < 1) {
        state.rafId = requestAnimationFrame(step);
      } else {
        state.animating = false;
        state.rafId = null;
        clampBounds();
        requestTransform();
      }
    }

    state.rafId = requestAnimationFrame(step);
  }

  /**
   * Country Selection & Detail Card Display
   * IMPORTANT: Called ONLY on click, never on hover!
   */
  function showCountryInfo(code) {
    if (!code) return;
    const upperCode = code.toUpperCase();
    const c = state.countries[upperCode];
    if (!c) return;

    state.selectedCountryId = upperCode;

    // Highlight selected country path and clear previous
    dom.countries.forEach(p => {
      if (p.getAttribute('data-id') === upperCode) {
        p.classList.add('active-selected');
        p.parentNode.appendChild(p);
      } else {
        p.classList.remove('active-selected');
      }
    });

    // Populate Info Card
    dom.cardFlag.textContent = c.flag || '🌍';
    dom.cardName.textContent = c.name;
    dom.cardNative.textContent = c.native !== c.name ? c.native : '';
    dom.cardContinentTag.textContent = c.continent;
    dom.cardCodeTag.textContent = c.id;

    dom.cardCapital.textContent = c.capital || 'N/A';
    dom.cardPopulation.textContent = c.populationFormatted || '—';
    dom.cardArea.textContent = c.areaFormatted || '—';
    dom.cardCurrency.textContent = c.currency || '—';
    dom.cardLanguages.textContent = Array.isArray(c.languages) ? c.languages.join(', ') : (c.languages || '—');

    dom.countryCard.classList.add('active');

    dom.zoomToCountryBtn.onclick = () => {
      if (c.bbox && c.bbox.width > 0) {
        zoomToBBox(c.bbox);
      }
    };
  }

  function hideCountryInfo() {
    state.selectedCountryId = null;
    dom.countryCard.classList.remove('active');
    dom.countries.forEach(p => p.classList.remove('active-selected'));
  }

  /**
   * Autocomplete Search
   */
  function searchCountry(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      dom.searchResults.innerHTML = '';
      dom.searchResults.classList.remove('active');
      state.searchResults = [];
      state.selectedResultIndex = -1;
      return;
    }

    const matches = [];

    // 1. Match Countries
    for (const [code, c] of Object.entries(state.countries)) {
      const nameMatch = c.name.toLowerCase().includes(q);
      const capMatch = (c.capital || '').toLowerCase().includes(q);
      const codeMatch = code.toLowerCase() === q;
      const contMatch = c.continent.toLowerCase().includes(q);

      if (nameMatch || capMatch || codeMatch || contMatch) {
        let priority = 10;
        if (c.name.toLowerCase().startsWith(q)) priority = 1;
        else if (codeMatch) priority = 2;
        else if (capMatch) priority = 3;
        else if (nameMatch) priority = 4;

        matches.push({
          type: 'country',
          item: c,
          priority,
          label: c.name,
          sub: `Capital: ${c.capital} • ${c.continent}`,
          flag: c.flag || '🌍'
        });
      }
    }

    // 2. Match Places (States, Cities, Towns, Villages)
    for (const place of state.places) {
      const pNameMatch = place.name.toLowerCase().includes(q);
      const pAreaMatch = (place.area || '').toLowerCase().includes(q);

      if (pNameMatch || pAreaMatch) {
        let priority = 12;
        if (place.name.toLowerCase().startsWith(q)) priority = 2;
        else if (pNameMatch) priority = 5;

        const icon = place.type === 'state' ? '🏛️' : (place.type === 'village' ? '🏡' : '📍');
        matches.push({
          type: 'place',
          item: place,
          priority,
          label: place.name,
          sub: `${(place.type || 'CITY').toUpperCase()} • ${place.area || place.countryCode || ''} ${place.pop ? '(' + place.pop + ')' : ''}`,
          flag: icon
        });
      }
    }

    matches.sort((a, b) => a.priority - b.priority);
    state.searchResults = matches.slice(0, 9);
    state.selectedResultIndex = -1;

    renderSearchResults();
  }

  function renderSearchResults() {
    if (state.searchResults.length === 0) {
      dom.searchResults.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 13px;">No matching results found</div>';
      dom.searchResults.classList.add('active');
      return;
    }

    dom.searchResults.innerHTML = '';
    const fragment = document.createDocumentFragment();

    state.searchResults.forEach((res, index) => {
      const el = document.createElement('div');
      el.className = `search-item ${index === state.selectedResultIndex ? 'selected' : ''}`;
      el.dataset.index = index;

      el.innerHTML = `
        <span class="search-flag">${res.flag}</span>
        <div class="search-item-info">
          <div class="search-item-name">${res.label}</div>
          <div class="search-item-sub">${res.sub}</div>
        </div>
        <span class="search-item-badge">${res.type === 'country' ? res.item.id : (res.item.type || 'CITY')}</span>
      `;

      el.addEventListener('click', () => {
        selectSearchResult(res);
      });

      fragment.appendChild(el);
    });

    dom.searchResults.appendChild(fragment);
    dom.searchResults.classList.add('active');
  }

  function selectSearchResult(res) {
    dom.searchInput.value = res.label;
    dom.clearSearchBtn.style.display = 'block';
    dom.searchResults.classList.remove('active');

    if (res.type === 'country') {
      const country = res.item;
      if (country.bbox && country.bbox.width > 0) {
        zoomToBBox(country.bbox);
      }
      showCountryInfo(country.id);
    } else {
      const place = res.item;
      const targetZoom = place.type === 'village' ? 16.0 : (place.type === 'state' ? 7.0 : (place.type === 'town' ? 10.0 : 6.0));
      zoomToLocation(place.x, place.y, targetZoom);
      if (place.countryCode) {
        showCountryInfo(place.countryCode);
      }
    }
  }

  function updateScaleBar() {
    if (!dom.scaleGraphic || !dom.scaleLabel) return;

    const kmPerPixel = 39.67 / state.scale;
    const targetPixelWidth = 70;
    const approxKm = targetPixelWidth * kmPerPixel;

    let niceKm = 1000;
    if (approxKm > 5000) niceKm = Math.round(approxKm / 2000) * 2000;
    else if (approxKm > 2000) niceKm = Math.round(approxKm / 1000) * 1000;
    else if (approxKm > 500) niceKm = Math.round(approxKm / 500) * 500;
    else if (approxKm > 100) niceKm = Math.round(approxKm / 100) * 100;
    else if (approxKm > 20) niceKm = Math.round(approxKm / 20) * 20;
    else niceKm = Math.max(2, Math.round(approxKm / 2) * 2);

    const actualWidth = Math.max(20, Math.min(120, niceKm / kmPerPixel));
    dom.scaleGraphic.style.width = `${actualWidth}px`;
    dom.scaleLabel.textContent = niceKm >= 1000 ? `${(niceKm / 1000).toLocaleString()} ,000 km` : `${niceKm} km`;
  }

  function setupTheme() {
    const savedTheme = localStorage.getItem('world_map_theme') || 'light';
    setTheme(savedTheme);

    dom.themeToggleBtn.addEventListener('click', () => {
      const nextTheme = state.theme === 'light' ? 'dark' : 'light';
      setTheme(nextTheme);
    });
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('world_map_theme', theme);

    if (theme === 'dark') {
      dom.themeIconMoon.style.display = 'none';
      dom.themeIconSun.style.display = 'block';
    } else {
      dom.themeIconMoon.style.display = 'block';
      dom.themeIconSun.style.display = 'none';
    }
  }

  /**
   * Bind All Interactive Event Listeners
   */
  function bindEvents() {
    // 1. Mouse Wheel Zoom
    dom.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.20 : 0.82;
      handleZoom(zoomFactor, e.clientX, e.clientY);
    }, { passive: false });

    // 2. High Performance Drag & Pan (Mouse, Pen, Touch)
    dom.viewport.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.search-container, .map-controls, .country-card, .continent-pills, .layer-switcher, .map-status-bar')) {
        return;
      }

      state.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (state.activeTouches.size === 1) {
        state.isDragging = true;
        state.dragMoved = false;
        state.startX = e.clientX;
        state.startY = e.clientY;
        state.prevPointerX = e.clientX;
        state.prevPointerY = e.clientY;
        dom.viewport.classList.add('panning');
      } else if (state.activeTouches.size === 2) {
        state.isDragging = false;
        const pts = Array.from(state.activeTouches.values());
        state.initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        state.initialPinchScale = state.scale;
        state.pinchCenter = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2
        };
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (state.activeTouches.has(e.pointerId)) {
        state.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // 2-Finger Pinch Zoom
      if (state.activeTouches.size === 2) {
        const pts = Array.from(state.activeTouches.values());
        const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (state.initialPinchDist > 0) {
          const pinchFactor = currentDist / state.initialPinchDist;
          const targetScale = Math.max(state.minScale, Math.min(state.maxScale, state.initialPinchScale * pinchFactor));
          const zoomRatio = targetScale / state.scale;
          handleZoom(zoomRatio, state.pinchCenter.x, state.pinchCenter.y);
        }
        return;
      }

      // 1-Finger Drag (Instant, no layout recalculations)
      if (!state.isDragging) return;

      const dx = e.clientX - state.prevPointerX;
      const dy = e.clientY - state.prevPointerY;

      if (Math.abs(e.clientX - state.startX) > 4 || Math.abs(e.clientY - state.startY) > 4) {
        state.dragMoved = true;
      }

      state.prevPointerX = e.clientX;
      state.prevPointerY = e.clientY;

      handlePan(dx, dy);
    });

    function endPointer(e) {
      state.activeTouches.delete(e.pointerId);
      if (state.activeTouches.size === 0) {
        state.isDragging = false;
        dom.viewport.classList.remove('panning');
      }
    }

    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);

    // 3. Country Interactivity: Clean Hover (Tooltip only) and Click (Select & Mark)
    dom.countries.forEach(path => {
      const code = path.getAttribute('data-id');

      path.addEventListener('mouseenter', () => {
        state.hoveredCountryId = code;
        const c = state.countries[code];
        if (c) {
          dom.tooltipFlag.textContent = c.flag || '🌍';
          dom.tooltipText.textContent = `${c.name} (${c.capital || c.continent})`;
          dom.tooltip.classList.add('visible');
        }
      });

      path.addEventListener('mousemove', (e) => {
        dom.tooltip.style.left = `${e.clientX}px`;
        dom.tooltip.style.top = `${e.clientY - 14}px`;
      });

      path.addEventListener('mouseleave', () => {
        state.hoveredCountryId = null;
        dom.tooltip.classList.remove('visible');
      });

      path.addEventListener('click', (e) => {
        // Prevent click when dragging/panning
        if (state.dragMoved) return;
        e.stopPropagation();
        // ONLY on click: mark country and show card
        showCountryInfo(code);
      });
    });

    // Dismiss selection on background click
    dom.viewport.addEventListener('click', (e) => {
      if (state.dragMoved) return;
      if (!e.target.closest('.country, .place-marker, .country-card, .search-container, .map-controls')) {
        hideCountryInfo();
      }
    });

    // 4. Search Bar & Autocomplete
    dom.searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      dom.clearSearchBtn.style.display = val ? 'block' : 'none';
      searchCountry(val);
    });

    dom.searchInput.addEventListener('focus', () => {
      if (dom.searchInput.value.trim()) {
        searchCountry(dom.searchInput.value);
      }
    });

    dom.clearSearchBtn.addEventListener('click', () => {
      dom.searchInput.value = '';
      dom.clearSearchBtn.style.display = 'none';
      dom.searchResults.classList.remove('active');
      dom.searchInput.focus();
    });

    dom.searchInput.addEventListener('keydown', (e) => {
      if (!dom.searchResults.classList.contains('active') || state.searchResults.length === 0) {
        if (e.key === 'Enter' && dom.searchInput.value.trim()) {
          searchCountry(dom.searchInput.value);
          if (state.searchResults.length > 0) {
            selectSearchResult(state.searchResults[0]);
          }
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.selectedResultIndex = (state.selectedResultIndex + 1) % state.searchResults.length;
        renderSearchResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.selectedResultIndex = (state.selectedResultIndex - 1 + state.searchResults.length) % state.searchResults.length;
        renderSearchResults();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const sel = state.searchResults[state.selectedResultIndex >= 0 ? state.selectedResultIndex : 0];
        if (sel) selectSearchResult(sel);
      } else if (e.key === 'Escape') {
        dom.searchResults.classList.remove('active');
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        dom.searchResults.classList.remove('active');
      }
    });

    // 5. Continent Navigation
    dom.continentPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;

      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const cont = btn.dataset.continent;
      state.activeContinent = cont;

      const bounds = CONTINENT_BOUNDS[cont] || CONTINENT_BOUNDS['all'];
      if (cont === 'all') {
        fitWorldToViewport();
      } else {
        zoomToBBox(bounds, 4.5);
      }
    });

    // 6. Navigation Controls
    dom.zoomInBtn.addEventListener('click', () => {
      handleZoom(1.35);
    });

    dom.zoomOutBtn.addEventListener('click', () => {
      handleZoom(0.74);
    });

    dom.resetViewBtn.addEventListener('click', () => {
      fitWorldToViewport();
    });

    dom.zoomSlider.addEventListener('input', (e) => {
      const targetScale = parseFloat(e.target.value);
      const ratio = targetScale / state.scale;
      handleZoom(ratio);
    });

    dom.fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // 7. Country Card Actions
    dom.closeCardBtn.addEventListener('click', () => {
      hideCountryInfo();
    });

    dom.resetCardBtn.addEventListener('click', () => {
      hideCountryInfo();
      fitWorldToViewport();
    });

    // 8. Window Resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        clampBounds();
        requestTransform();
      }, 100);
    });

    // 9. Keyboard Navigation
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;

      if (e.key === 'Escape') {
        hideCountryInfo();
      } else if (e.key === '+' || e.key === '=') {
        handleZoom(1.25);
      } else if (e.key === '-' || e.key === '_') {
        handleZoom(0.8);
      } else if (e.key === '0') {
        fitWorldToViewport();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
  } else {
    initMap();
  }

  window.WorldMap = {
    state,
    initMap,
    handleZoom,
    handlePan,
    showCountryInfo,
    searchCountry,
    fitWorldToViewport,
    zoomToLocation,
    zoomToBBox
  };

})();
