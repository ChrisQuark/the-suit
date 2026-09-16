# Editing The Suit

The editable model, lighting, controls and interface are in `src/`.

Run `npm install`, `npm run check`, then `npm run build`. Commit the updated source and generated root `index.html`. GitHub Pages publishes the main branch root automatically.

The model uses eight independent layers and preserves the four sliding abdominal lames, concealed neck collar and unplated waist. The assembled view adds studio reflections and screen-space contact shading. Transparent inspection disables contact shading to avoid ghost-layer artifacts.

Version 1.2 adds individual component inspection, layer colors, chrome shells and NETFORCE-inspired glove exteriors. `src/inspection.js` contains the visibility and camera-fit logic. `npm run check` includes raycast regressions around both boots, individual component masks and camera framing. Full-suit orbit stays above the ground; isolated components permit full orbit with the floor hidden.
