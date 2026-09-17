# Editing The Suit

The editable model, lighting, controls and interface are in `src/`.

Run `npm install`, `npm run check`, then `npm run build`. Commit the updated source and generated root `index.html`. GitHub Pages publishes the main branch root automatically.

The model uses eight independent layers and preserves the four sliding abdominal lames, concealed neck collar and unplated waist. The assembled view adds studio reflections and screen-space contact shading. Transparent inspection disables contact shading to avoid ghost-layer artifacts.

Version 1.2 adds individual component inspection, layer colors, chrome shells and NETFORCE-inspired glove exteriors. `src/inspection.js` contains the visibility and camera-fit logic. `npm run check` includes raycast regressions around both boots, individual component masks and camera framing. Full-suit orbit stays above the ground; isolated components permit full orbit with the floor hidden.

Version 1.3 adds full wrap straps, fixed base-layer coordinates during separation, biceps and rear-thigh shells, revised D3O zones, and a separate removable groin-cup concept. The waist belt and right rigid stab flank are removed. A reserved canvas column keeps the model clear of the scrollable inspector. Any selected component is isolated with a soft glow, and each layer or component exposes sourced product features or clearly identified custom design details in `src/products.js`. Muted military colors remain optional; the standard finish is chrome.

Geometry checks cover shell face winding, complete strap loops, stationary Cutlon, independent component masks and the soft waist gap. Custom geometry is an illustrative design study, not a protective equipment specification. Browser UI can be inspected without WebGL; GPU rendering must be checked on a WebGL-capable device.

Version 1.4 replaces generic pads with photo-referenced D3O Ghost lattices: full chest, size M back, L2 shoulder and knee/elbow, and LP size M met guards. All dimensions come from the linked D3O datasheets. Ten inserts sit in external Cutlon pockets; the instep pockets are beneath the boot uppers. Pocket fabric, seams and foot sleeves remain fixed to the body. The Hyper Concealable vest now uses the reference neckline, soft panel outlines, flat binding and six closures. Armor thickness (0.19 in) and carrier thickness (0.03 in) come from Safe Life Defense. Overall carrier size and NG-referenced limb shells remain custom model geometry, with model bounds explicitly distinguished from catalog dimensions. No NG limb-specific drawing or dimensions were available on its supplied page.

`src/ghost.js` generates hollow triangular cells, backing and pocket geometry. Product cards show three features, dimensions, purpose and source links. Manufacturer ratings belong to the cited products and do not certify this modeled integration. The component picker remains usable if WebGL is unavailable.
