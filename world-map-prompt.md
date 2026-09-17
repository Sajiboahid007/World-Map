# Prompt: Interactive Zoomable World Map (HTML + CSS + Vanilla JS)

Build a single-page interactive world map application, similar in feel to
Google Maps, using **only HTML, CSS, and vanilla JavaScript** (no frameworks,
no build tools — everything must run by just opening index.html).

## Core Requirements

1. **Base Map**
   - Use an SVG world map (equirectangular or Mercator-style projection)
     with each country as its own `<path>` element, grouped by continent.
   - Load the SVG inline or fetch it from a local file (e.g. `world.svg`)
     so paths can be styled and interacted with individually.

2. **Zoom & Pan (Google-Maps-like)**
   - Mouse wheel / pinch to zoom in and out, centered on the cursor
     position (not just the map center).
   - Click-and-drag to pan.
   - Smooth CSS `transform: scale()` + `translate()` transitions, no jank.
   - Zoom limits: min zoom = fit whole world in viewport, max zoom = deep
     enough to clearly read small countries/cities.
   - Optional: `+` / `-` zoom buttons and a zoom slider in a corner,
     like Google Maps controls.

3. **Level-of-detail on zoom**
   - At low zoom: show only continents/country outlines and country names
     for larger countries.
   - As the user zooms in on a region: fade in smaller country labels,
     then major cities, then (optionally) state/province borders —
     mimicking how Google Maps reveals more detail as you zoom.
   - Use CSS opacity/visibility transitions tied to zoom level via JS
     (toggle classes like `.zoom-level-2`, `.zoom-level-3`).

4. **Interactivity**
   - Hover a country → highlight it (color change + subtle glow/shadow)
     and show a tooltip with country name.
   - Click a country → open a small info panel (sidebar or floating card)
     showing: name, capital, population, region — pull this from a local
     JSON file (`countries.json`) you also generate, not an external API.
   - Search box (top-left, like Google Maps) that lets the user type a
     country name and auto-zooms/pans to it.

5. **Visual Style**
   - Ocean: soft blue background.
   - Land: neutral base color, with a distinct highlight color for
     hover/selected state.
   - Clean sans-serif labels that scale legibly with zoom, avoiding
     overlap (basic collision handling or just fade lower-priority
     labels at low zoom).
   - Rounded, minimal UI controls (zoom buttons, search bar) with subtle
     shadows — flat modern style, not skeuomorphic.

6. **Responsiveness**
   - Map and controls should resize correctly on window resize and work
     on both desktop and mobile (touch drag + pinch-to-zoom).

## File Structure
```
/index.html
/style.css
/script.js
/world.svg        (world map paths)
/countries.json    (name, capital, population, region per country)
```

## Deliverable
A fully working, self-contained demo where a user can:
- Load the page and see the whole world.
- Zoom smoothly into any region/country.
- See increasing detail (labels, cities) as they zoom.
- Click a country for quick info.
- Search for a country and jump to it.

Keep the code well-commented and organized into clear functions
(`initMap()`, `handleZoom()`, `handlePan()`, `updateLabels()`,
`showCountryInfo()`, `searchCountry()`) so it's easy to extend later
(e.g. adding real-time data layers, borders overlays, or a dark mode).
