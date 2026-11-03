# Pricing-estimator audit — 3 November 2026

## Reported Gengar case

Reported upload: `Gengar_smartphone_holder.3mf`, 104.9 × 112.1 × 75.7 mm, 316,584 triangles. Screenshot: 57.1 g, about 2h 5m, S$11.56 manufacturing cost, S$17.79 selling price.

The selling-price equation is correct: `11.56 / (1 - 0.35) = 17.7846…`, rounded up to S$17.79. Material at S$25/kg also gives about S$1.43 for 57.1 g. Increasing margin or rates would conceal the estimator issue.

Only the screenshot and reported dimensions/results were supplied. The original Gengar archive and a matching Bambu Studio slice were not available. Its embedded statistics, actual colour assignments, actual grams/hours and percentage error therefore remain **unverified**. Dimensions, triangle count and a monochrome preview cannot reconstruct them. Do not substitute another downloaded Gengar model or fabricate a corrected quote.

## Causes and changes

| Area | Previous calculation / omission | Current treatment |
|---|---|---|
| Walls | `surfaceArea × wallThickness × 0.5` halved the contribution without a geometric basis; multiplied all surfaces together | Oriented side-surface integral × wall loops × explicit line width |
| Solid skins | Bounding rectangle × `layerHeight × 8 × 0.35`; fixed and not derived from oriented model surfaces | Separate upward/downward projected surface integrals × explicit top/bottom layers × layer height |
| Infill | Interior multiplied by percentage after the approximate shell | Percentage applies after the revised wall/skin volumes; physical-pattern, overlap and local-solid behaviour remain unsupported |
| Shell overlap / thin regions | Heuristic shell capped at model volume | Still capped at enclosed volume; exact inward offsets, overlap subtraction and thin-wall toolpaths are not computed. No guarantee that proxy mass is a strict lower/upper bound |
| Duration | Almost entirely grams / density / assumed effective flow; unsupported nozzle power-law multiplier | Flow supplies an ideal deposition component. Optional measured average depositing speed supplies a path-speed constraint; use the larger component. Unsupported nozzle scaling removed |
| Travel / acceleration / cooling | Excluded | Separate additional minutes, default zero and flagged unbudgeted. No motion-planner or per-layer cooling simulation is claimed |
| Preparation | Excluded | Explicit minutes per batch, charged once per batch as machine/electricity time, independently of hands-on labour |
| Supports / interfaces | Off by default or assumed percentage | Import stored support setting when present. Positive explicit grams replace the percentage proxy. Otherwise the percentage remains clearly an assumption. No support generation; downward-facing surfaces only flag candidates |
| Brim / skirt / raft | Excluded | Explicit grams per item, including their deposition time; no perimeter geometry is generated |
| Purge / prime tower | Manual mass only; material's deposition time omitted | Explicit grams per batch plus deposition time, included once. Counts/colours alone do not determine waste |
| Tool / AMS changes | Manual total minutes only | Either a manual total **or** actual entered counts × measured switching seconds. These modes do not stack. Waste extrusion already budgeted must be excluded from switching delays |
| Stored 3MF totals | Only slice_info with a matching G-code entry was accepted | Read positive original slice_info totals, marking metadata-only provenance. Also parse Bambu G-code total-time/total-weight headers and sum used filament channels; do not substitute model-only time |
| Conflicting totals | No cross-check | Conflicting summary sources are rejected instead of silently selecting one. Tolerances are derived from display rounding: 0.005 g × (channel count + 1 total) and 1 second. Once summaries agree, the rounded metadata total weight is retained instead of summing individually rounded channel weights |
| Colours | Missing metadata fell back to 1 | Missing evidence stays unknown (0 in the control). Distinguish configured palette slots, assigned part IDs, painted segmentation and channels with positive recorded usage. The preview remains one display colour |
| Calibration | Algorithm-specific legacy factors; mass factor affected time indirectly; no evidence field | New `surface-v2` records have independent mass/time factors, reference identity and a settings signature. Separate profile keys by printer/material/nozzle/quality. Unsupported legacy factors remain stored but inactive |
| Precision | Geometry results shown with decimal grams, exact minute and cent headline | Approximate whole-gram/5-minute headline values, an incomplete-budget label, and editable low/high totals. No default upper band or confidence percentage is invented |
| Customer export | An incomplete geometry price could be exported as a full customer quote | Requires an explicitly reviewed time budget, complete operator planning range, or matching measured calibration. Internal export retains incomplete-budget warnings |

## New geometry model

```text
wallVolume = orientedSideArea × wallLoops × lineWidth
skinVolume = (upProjectedArea × topLayers + downProjectedArea × bottomLayers) × layerHeight
solidVolume = min(enclosedVolume, wallVolume + skinVolume)
infillVolume = max(0, enclosedVolume - solidVolume) × infillFraction
```

Side area is the integral of each triangle's normal component parallel to XY; upward/downward projected areas use the positive/negative Z components. These depend on geometry and orientation, not tessellation density. Model volume, area and dimensions use 3MF transforms/units or STL millimetre assumptions. An unambiguous stored 3MF density is imported as an editable per-job override; zero uses the configured material assumption. Changing material clears that inherited override. Mixed-density materials are not collapsed into an invented single density.

The sum remains a first-order proxy. Sloped features can receive both side and skin contributions; thin/concave geometry, intersecting solids, local solid infill, infill patterns, modifiers and internal voids can change actual results. Unsupported negative/modifier parts block geometry quoting instead of silently contributing positive mass.

A rounded-rectangle bead area converts deposited volume to approximate deposition-path length. Time is `max(volume / assumedFlow, pathLength / suppliedMeanDepositingSpeed)` plus explicitly entered travel, acceleration, cooling, preparation, waste deposition and switching delays. A missing speed/overhead input is not filled using maximum hardware speed, triangle count or an arbitrary multiplier.

## Calibration

No calibrated values ship by default. Neutral 1× factors are explicitly **unmeasured**.

A measured record requires operator-entered Bambu Studio total grams/hours, confirmed colour count and a reference/model/version label. Known support/brim/purge grams and known time allowances are subtracted before deriving independent mass and time factors. Applying a mass factor does not multiply time again.

Keys separate printer, material, nozzle and quality. Signatures additionally bind layer height, walls, skins, infill, support assumptions, colour count, dual-nozzle mode, scale, flow/density and explicit overheads. A mismatch falls back to Geometry estimate. Price/rate changes do not invalidate a physical calibration. Calibration from one geometry is still not a validated accuracy guarantee on other shapes.

Manually edited factors without a measured reference are shown as unverified assumptions, never Calibrated estimate. Settings JSON import/export preserves records. Historical factors are not silently applied to the revised algorithm.

## Planning ranges and quantities

Low/high grams and hours are operator inputs, not an invented ±percentage. Zero lower values use the current base estimate; zero upper values mean unknown. Both upper values must be supplied for a complete range. Inverted, nonfinite and below-explicit-batch-allowance ranges are rejected.

Both endpoints use the same real cost/margin formula; the cost breakdown uses the midpoint when a complete range is entered. Headline price bounds round up to whole SGD for presentation; this does not change the underlying cost or margin calculations. No cost rate or profit target is multiplied to make the result higher.

Geometry model/support/brim and item time repeat per item; preparation, entered purge/tower and change delays repeat per batch. Slicer-derived totals repeat the whole selected plate for `ceil(quantity / itemsPerBatch)`, including a partial final plate. Their original supports, waste and preparation are not added again. All filament currently uses one selected material rate; mixed-price materials need separate quotes or manual costing.

## Cost audit

Confirmed defaults remain **S$25/kg**, **S$1.50 machine/hour**, **S$15 hands-on/hour**, **S$0.31/kWh**, **35% margin**, **S$5 minimum**. Existing localStorage pricing configurations remain compatible.

- Machine rate already includes depreciation and routine maintenance. No second maintenance line is added.
- Electricity is average measured watts / 1000 × machine hours × tariff; machine rate excludes electricity.
- Machine preparation is machine time; labour uses explicitly entered human setup/item/batch minutes. Concurrent machine and human time can legitimately both incur costs; they are not duplicate charges for the same resource.
- Design, human order setup, overhead and fixed selling fees occur once per order.
- Failure reserve applies once to repeatable material/machine/electricity/per-batch labour costs. It excludes design/order setup/packaging and should not be stacked with separately entered reprints.
- Percentage selling fees and target margin are solved together in the denominator, with a validated sum below 100%.

## Actual native reference tests

See [benchmark-results.md](benchmark-results.md) and `tests/reference-bambu/`. Genuine Bambu Studio **02.08.02.61** produced successful native CLI slices for four original models: a single-colour cube, a tree-supported cantilever, a dual-nozzle two-colour plate and a three-colour plate with **50 recorded filament changes**.

Fixtures preserve actual native result totals, feature times, warnings, profile settings, density and SHA-256 model hashes. Extracted header totals are compared separately with result.json to test rounding-only extraction errors; those are not geometry-accuracy claims. Uncalibrated geometry errors are deliberately reported, including large underestimates for unbudgeted multi-colour work. No constants were fitted to hide them.

Reproduce:

```sh
python3 scripts/generate-benchmark-models.py
python3 scripts/run-bambu-benchmarks.py --binary /path/bin/bambu-studio --resources /path/resources
./node_modules/.bin/esbuild scripts/benchmark-report.ts --bundle --platform=node --format=esm --outfile=.openai/benchmark-report.mjs
node .openai/benchmark-report.mjs
npm test
npm run build
```

The native binary is an offline test dependency only; the website remains browser-only and GitHub Pages-only. Full native slicing is not invoked by the website. Benchmark fixture statistics are not applied automatically to user jobs or shipped as calibrated factors.

GUI parity and physical printed time/weight were not validated. Native CLI warnings about reserved T commands and headless thumbnail rendering are retained, despite successful return_code=0. The specific Gengar comparison remains pending its original file and corresponding Bambu Studio slice.
