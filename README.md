# Created3D — Print Pricing

Internal browser-only quotation workbench for **Created3D — Made With Purpose.**

**Production:** https://gorillacoder001.github.io/created3d-auto-pricing/

React + TypeScript + Vite + Tailwind, Three.js, fflate, fast-xml-parser, jsPDF and Vitest. Hosted only on GitHub Pages. No backend, account, database, external file-processing service or paid API.

## Run locally

Requires Node.js 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Vite's base path is `/created3d-auto-pricing/`. Open that path when using a local server. `dist/` is the production output.

## Workflow

1. Upload STL, 3MF or an image; alternatively try the real sample coaster or enter manual values.
2. Inspect dimensions and topology. Choose the printer, nozzle, material, quality, infill, supports and quantity.
3. Review the estimate classification and assumptions. Unsliced meshes use labelled Geometry estimates with separate walls/skins/infill and explicit time budgets, **not slicing**. Unknown time/waste stays flagged; customer export requires review, a complete planning range or a measured reference.
4. Set measured-average printer power and hands-on time in Pricing settings; these default to zero and are flagged as excluded.
5. Choose Customer (costs/margins hidden) or Internal, then copy the quotation or download a PDF.

### Confirmed defaults

| Cost | Default |
|---|---:|
| Currency | SGD |
| Filament | S$25/kg |
| Labour | S$15/hour |
| Machine | S$1.50/hour |
| Electricity | **S$0.31/kWh** |
| Target profit margin | 35% |
| Minimum order | S$5 |
| Printer / nozzle / material / quality | X2D / 0.4 mm / PLA / Standard |

Machine rate includes depreciation and routine maintenance. Power, labour minutes, design, packaging, finishing, overhead, payment fees and failure reserve are unconfirmed and default to zero. All filament types start at the user-provided S$25/kg rate; set individual rates as needed. Density, effective extrusion flow and geometry/support factors are explicitly editable practical assumptions.

Pricing settings persist in browser localStorage and support validated JSON import/export. Resetting a job preserves saved settings. Clearing browser storage removes them. Job files are held only in memory; there is no job history or remote upload.

## Pricing

```text
Material = grams / 1000 × material price/kg
Machine = hours × machine rate
Electricity = average watts / 1000 × hours × S$0.31/kWh
Labour = (order setup + item handling × quantity + batch handling × batches) / 60 × labour rate
Manufacturing = material + machine + electricity + labour + design + packaging + finishing + overhead + failure reserve
Price = max((manufacturing + fixed selling fee) / (1 - margin/100 - percentage fee/100), minimum order)
```

Price rounds **up** to the next cent. Net profit subtracts manufacturing and payment fees; the displayed margin is the actual resulting margin, including minimum-order effects.

Design, order setup, fixed payment fees and overhead are charged once per order. Packaging, finishing and item handling scale with quantity. Failure reserve applies once to repeatable printing costs (material, machine, electricity and per-batch labour); it excludes design, order setup and packaging. Do not add the same reprint cost separately.

### Quantities and batching

- Geometry estimates treat the complete uploaded geometry as one design. Model and support grams/base hours scale by quantity. Explicit purge/tower mass and tool/AMS change time are shared once per batch. Arrangement is not simulated.
- Slicer-derived values cover **one selected plate**, not one object. Enter how many items it contains. The entire plate repeats for `ceil(quantity / itemsPerBatch)`, including a partially needed last plate.
- Manual values can cover one item or a complete batch. Include all supports, purge, warm-up and tool-change overhead in those totals.
- A multi-plate project must be quoted plate by plate. Preview dimensions cover all printable project items, not only the selected plate.

## File support and validation

- Binary and ASCII STL, including binary files whose header begins with `solid`. STL units are assumed millimetres; scale is editable.
- Core 3MF geometry with mesh objects, component instances, external production-extension model files, build transforms and supported units. Multipart geometry is previewed in a single display colour.
- Bambu `Metadata/slice_info.config`: positive numeric plate prediction in seconds and total weight in grams, with provenance recorded for any matching `plate_N.gcode`. Per-filament `used_g` is a fallback if a total weight is absent. Complete saved metadata without G-code is explicitly marked for confirmation. Bambu G-code total-time and weight headers are also supported; conflicting summaries are rejected. Metadata is not authenticated and does not prove that a job will print successfully.
- Unsliced 3MF files never acquire invented print statistics. Unsupported or incomplete summaries fall back to geometry/manual input.
- JPG/JPEG/PNG/WEBP are on-device photo references. A bounded canvas analysis (maximum 192 pixels on the longest side) attempts to isolate the largest foreground silhouette on a consistent background, capturing approximate proportions, fill, and boundary density. When detection is reliable enough, it adjusts an illustrative category-based quote with **100 mm assumed longest side**, not physical dimensions. When detection fails, the app explicitly identifies a generic fallback. The user can refine physical dimensions, category, colour assumptions, grams and print time. Photos do not reveal actual scale, depth, wall thickness, infill, supports or AMS changes; they never produce slicer-equivalent totals or customer-ready prices. No machine-learning service or model download is involved.
- Limits: 160 MB models, 20 MB images, 40 MP decoded images, 1,000,000 expanded triangles, 3,000 ZIP entries, 180 MB per ZIP entry, 380 MB total declared expansion, 90-second cancellable worker timeout. Unsupported ZIP64, encryption, unsafe paths, XML DTDs/entities and circular/missing components are rejected.
- Closed-edge, winding, degeneracy and non-manifold checks run in a worker. Self-intersections, overlapping/nested solids and printability are not certified. Open, non-manifold or modifier-heavy geometry receives a low-confidence envelope-based fallback range; it is not a validated volume estimate and cannot be exported as a customer quote. Invalid dimensions and unsafe archives still fail.
- Three.js WebGL preview has an interactive CPU canvas fallback; meshes over 6,000 triangles are sampled **for fallback display only**, leaving analysis intact.

## Printer references

X2D, H2D, X1 Carbon, P1S, P2S, A1 and A1 mini are selectable. Hardware envelopes and supported nozzle diameters use official Bambu material and profile data. This app does **not** claim to reproduce Bambu's full slicing/performance profiles. The original Z orientation is retained; automatic arrangement/rotation is not performed.

See [estimation audit](docs/estimation-audit.md), [actual benchmarks](docs/benchmark-results.md), [printer sources](docs/printer-sources.md), [slicing feasibility](docs/browser-slicing.md) and [validation](docs/validation.md).

## Deployment

`.github/workflows/deploy.yml` runs calculation/parsing tests and the TypeScript/Vite production build on pushes and PRs. Successful pushes to `main` upload `dist/` and deploy with GitHub's official Pages actions.

In repository **Settings → Pages → Build and deployment**, Source must be **GitHub Actions**. No secrets or external hosting are required. Pull requests run checks without deployment.

## Current limitations

Real browser slicing is **not enabled**. Material and time estimates for unsliced models are uncalibrated unless you explicitly enter a matching Bambu Studio reference. Four genuine Bambu Studio 02.08.02.61 CLI reference cases now cover single-colour, supported, dual-nozzle two-colour and three-colour jobs. Signed errors are reported in [benchmark results](docs/benchmark-results.md). They expose large unbudgeted geometry errors and are not shipped as default calibration. The specific Gengar file has not been supplied for verification.

No per-layer support generation, toolpath planning, acceleration simulation, automatic AMS purge calculation, prime-tower geometry, painted-colour rendering, negative-volume/modifier evaluation or mixed-material rate allocation is performed. Invalid-topology fallback scenarios deliberately use crude bounding-envelope assumptions and must not be treated as slicer predictions. Use final Bambu Studio statistics for production quotes. All recorded filament in a selected plate is costed at one chosen material rate.

PDF quotations use rasterized browser text for multilingual names; PDF text is not selectable/searchable. Tax and shipping are excluded unless entered as explicit costs. The public site and repository have no access protection.

## Estimator accuracy update

Geometry time is no longer presented as reliable based on flow or triangles alone. Add explicit preparation/travel/acceleration/cooling and tool/AMS budgets, enter a planning range, or use real stored slice totals. Colour count can be unknown; the preview is deliberately monochrome.

Separate measured calibration records bind printer, material, nozzle and quality plus relevant settings. Unverified factors and legacy algorithm factors are not labelled calibrated. No arbitrary price uplift or default uncertainty multiplier was introduced.

The full [audit](docs/estimation-audit.md) explains mass/time assumptions, provenance, cost deduplication, ranges, actual reference reproduction and remaining limitations.
