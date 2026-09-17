# Editing The Suit

The editable model, lighting, controls and interface are in `src/`. Run `npm install`, `npm run check`, then `npm run build`. Commit the source and generated root `index.html`; GitHub Pages publishes the main branch root.

## Current model — version 1.6

Ten independently controlled groups contain 41 inspectable components: Cutlon, D3O, NovaSteel torso, NovaSteel shoulders, concealed neck lames, straps/carriers, fitted limb shells, gloves/boots, helmet/mandible and buckler. Component selection isolates its own meshes and trim. Layer colors retain physical material textures. Cutlon and its external pockets stay on the mannequin during separation; hiding Cutlon does not hide D3O.

NovaSteel front and back shells replace Hyperline, PPSS, the custom chest/back plates, the four abdominal lames and their tracks. Integral shoulder and complete torso straps replace the former torso harness. No waist belt remains. The floating groin module is separate from the torso. NovaSteel shoulder shells sit over the D3O pockets on independent textile suspension.

`src/armor.js` builds the reference-shaped NovaSteel assemblies and custom limb shells. The torso has stamped channels, a central crest and folded edges. The shoulders use the same anatomical surface as the Ghost pockets with additional clearance. Forearm, biceps, quadriceps, hamstring and shin shells follow the garment cross-sections, taper toward their ends and leave the wrist, elbow, knee and hip creases free. These are visual design clearances, not a motion simulation or verified wearer fit.

The added high-cut helmet has suspension, retention straps, a dedicated flip-mandible circlet and a separate solid face guard with an open eye gap. The supplied face-shield URL describes a solid Gen 2 mandible, not a transparent visor or complete helmet. The compatible NovaSteel high-cut shell is an additional visual reference; the manufacturer currently lists it as unavailable for retail purchase. The faceted buckler includes a central boss, stamped ribs and an ambidextrous handle, independent of the forearm armor.

NETFORCE cards describe its commercial contact electric-impulse function and the manufacturer-listed rechargeable 1,800 mAh / USB-C battery. Glove geometry is an exterior approximation; internal electronics, wiring and functional operation are not modeled.

## References and dimensions

| Component | Reference | Treatment |
| --- | --- | --- |
| Torso | https://www.ade.pt/product/novasteel-breastplate/ | L/XL reference 350 × 432 mm; published thickness below 2.54 mm. Front/back photo profiles approximated. RF1 upgrade excluded. |
| Torso suspension | https://www.ade.pt/wp-content/uploads/2024/05/Breastplate_guide.pdf | Separate front/back shells with shoulder and side straps. |
| Shoulders | https://www.ade.pt/product/shoulder-armor-plates/ | Curved steel above D3O. No published outline dimensions; model bounds identified separately. |
| Helmet | https://www.ade.pt/product/novasteel-helmet-high-cut/ | High-cut reference silhouette and retention, approximate dimensions. |
| Face module | https://www.ade.pt/product/ballistic-face-shield/ | Gen 2 solid flip mandible and its dedicated welded circlet. Standard circlets are incompatible. |
| Buckler | https://www.ade.pt/product/ballistic-buckler/ | Nominal 310 mm span; faceted photo outline and central grip. |
| Gloves | https://netforce-defense.com/ | G.I.E exterior and sourced product features. |
| Limb shells | https://ngballistics.com/ | Material reference only; no dimensioned limb products supplied. Shapes remain custom and unrated. |

D3O Ghost inserts retain published flat sizes: chest 335 × 245 × 8.25 mm, back M 262 × 404 × 8 mm, L2 shoulder 193 × 154 × 11 mm, L2 knee/elbow 240 × 147 × 11 mm, and LP M met guard 134 × 108 × 6 mm. `src/ghost.js` builds genuine hollow cells and backing. All ten inserts occupy external Cutlon pockets; instep pockets lie under boot uppers. Product-specific pages and datasheets are linked in `src/products.js`.

`src/materials.js` generates seamless metre-scaled albedo, normal and roughness maps, including the satin coated-steel finish used by NovaSteel. Chrome Nanovate-style finish remains on the custom limb shells. Textures and meshes are procedural visual approximations, not manufacturer scans or fabrication-ready CAD.

## Validation

Checks cover removed components, 588 mannequin-clearance rays, independent pad visibility, stationary Cutlon, full strap loops, limb/garment clearances, shoulder-over-pocket clearance, open joint spaces, helmet and shield face winding, the open eye gap, boot surfaces, all-component isolation, camera fit, texture UVs and concise sourced cards. The ten-group interface and complete peel sequence are also checked in a DOM test harness.

Product ratings belong to the cited products. This visualization does not establish protection, actual concealability, range of motion or certification of the combined suit. GPU rendering remains unverified in the cloud browser, which has WebGL disabled.
