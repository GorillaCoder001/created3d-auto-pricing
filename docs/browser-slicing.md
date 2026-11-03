# Browser-slicing feasibility

Investigation: 3 November 2026. Decision: ship Phase 1 with the mandatory reliable fallback. **No real browser slicer is embedded or claimed.**

| Candidate | Verified capability / license | Missing for this app | Decision |
|---|---|---|---|
| [Bambu Studio](https://github.com/bambulab/BambuStudio) | Native slicer; AGPL-3.0; official Bambu configuration resources | No supported standalone browser/WASM build established from the official project. Porting native libraries, worker integration, profiles and time/waste semantics needs dedicated engineering and benchmarking. | Do not label geometry analysis as Bambu slicing. Read existing plate statistics. |
| [Cura WASM](https://github.com/Cloud-CNC/cura-wasm) | Real browser/Node CuraEngine WASM wrapper; supplies filament/time metadata. README documents worker isolation and definitions. Wrapper licensing and underlying AGPL CuraEngine obligations must both be reviewed. | Cura definitions are not Bambu Studio profiles. No validated X2D dual-nozzle/AMS/tower pipeline was established. README benchmarks use old Cura 4.6.1/Chrome 86, so they are not a current performance promise. | Technically plausible future single-material experiment. Not production-ready for this brief. |
| [Kiri:Moto](https://github.com/GridSpace/grid-apps/wiki/Kiri%3AMoto) | Real browser slicing, JavaScript-based; official repository identifies MIT license | No benchmarked X2D profile or Bambu-compatible dual-tool/AMS statistics integration established here. Browser memory/CPU use depends on mesh complexity. | Plausible separate research branch; do not imply current profile equivalence. |
| [SimplyPrint Bambu Studio Online](https://simplyprint.io/features/slicer/bambustudio) | Vendor describes a browser implementation | A service claim does not establish availability of a redistributable standalone engine compatible with this no-paid-API static site. | Not integrated. |

This is a feasibility review, not a claim that browser slicing is impossible. Engine examples were inspected; no candidate was installed or benchmarked in this project. Redistribution license review must cover the actual chosen binary, wrapper, definitions and source-offer obligations. The current calculator contains no third-party slicer binary and does not inherit a slicer license by copying its code.

## Fallback shipped

- Local worker parses geometry and checks topology.
- A closed mesh can use a clearly labelled approximate volume/surface model.
- Supported sliced Bambu 3MF files can supply original plate totals.
- Manual total grams and hours keep the calculator usable for unsupported files.
- Estimates are labelled Slicer-derived, Calibrated estimate, Preliminary estimate or Manual estimate.
- Image quotes remain preliminary regardless of manual values.

## Geometry model

Approximate shell volume is capped by enclosed volume. Remaining interior volume is multiplied by infill percentage; support mass uses an editable percentage allowance. Density converts volume to grams. An explicitly assumed effective extrusion rate gives approximate time, with nozzle/layer factors and manually entered batch change overhead. This is **not** layer intersection, support generation or toolpath simulation.

The model can be substantially wrong for thin walls, nested/overlapping solids, cavities, modifiers, bridges and complex support. Average power and hands-on time are deliberately not guessed. Multicolour count does not determine purge grams or switch counts; these require an allowance or a real slice.

## Phase 3 calibration and acceptance work

A user can save mass/time adjustment factors for an exact printer/nozzle/material/layer/infill/support/wall/quality/dual configuration. Calibrations apply as practical reference factors, not model-independent accuracy guarantees.

Before enabling a slicer, benchmark identical STL/3MF and settings against Bambu Studio on at least a thin coaster, hollow vessel, functional bracket, detailed figurine and X2D two-tool/multicolour job. Record Bambu Studio version, engine commit, profiles, geometry orientation, supports, AMS/tool-change counts, model/support/flush/tower grams, preparation time, print time, worker elapsed time, peak memory and desktop/mobile hardware. Include multiple materials and nozzles.

Record discrepancies as `(browser - Bambu) / Bambu × 100%` separately for time and filament. Agree acceptance tolerances based on real jobs; none have been invented for this release. No accuracy percentage is advertised. Native Bambu Studio reference benchmarks have since been run for four original models; see [benchmark-results.md](benchmark-results.md). This does not enable browser slicing or establish physical-print accuracy.
