# Validation

## Automated

`npm test` exercises 49 cases covering binary/ASCII STL, closed/open/winding/degenerate geometry, core/external-component 3MF transforms, units, unsliced/sliced separation, validated metadata, unsafe archive/XML rejection, printer bounds, material/support/purge estimates, calibration classification, SGD costs, S$0.31/kWh, 35% margin, fixed/percentage fees, S$5 minimum, batching, one-time fees and customer quotation privacy.

`npm run build` runs TypeScript checks then builds production bundles. GitHub Actions repeats both before deployment. Runtime dependencies were audited and updated to remove the initially detected XML/PDF advisories.

Fixtures are synthetic tetrahedra and explicitly synthetic Bambu-format metadata. They are not real sliced jobs and do not establish Bambu Studio accuracy. No model, slicer benchmark or measured average power supplied by the user was invented.

## Browser checks

The working interface is exercised through file chooser uploads, model analysis, persisted settings, quotation generation and a 390 px embedded viewport. WebGL is disabled in the test browser; the interactive CPU fallback is tested. GPU rendering needs a normal WebGL-enabled browser for complete validation.

Production deployment must additionally have a successful GitHub Actions Pages run and a live application load under `/created3d-auto-pricing/`. Do not infer deployment success from a local build alone.

## Release verification — 3 November 2026

- Initial production commit `ed7d5ba5bd8bece8a1a88bf52aeb427159ee7f6a`: GitHub Actions run 41595308091 completed successfully, including Pages deployment.
- Live GitHub Pages loaded with the correct project path; the real sample coaster produced 12.4 g / approximately 28 minutes and the S$5 minimum at default rates.
- Browser uploads validated binary STL and a synthetic sliced 3MF (100 g / 2 hours). Pricing settings persisted across reloads; 200 W average power and 10 setup minutes changed the synthetic slice price to S$12.50 at S$0.31/kWh.
- An image upload required intended dimensions and manual quantities. With 80 × 80 × 4 mm, 25 g and 1 hour, it produced a Preliminary estimate, never Slicer-derived.
- The 390 px embedded mobile viewport stacked cards without horizontal clipping. The test browser lacks WebGL; the interactive canvas fallback was visible.
- Both internal and customer PDFs were generated directly through the production export function in a Node canvas harness, checked for valid A4 PDF structure and raster-rendered for inspection. Browser generation produced a valid save link; this automation browser did not deliver a download event, so end-to-end browser download capture remains unverified. Its policy also blocks opening local blob URLs. No workaround was used for that blocked browser operation.
- No real Bambu Studio benchmark was performed. Accuracy remains unverified for geometry estimates and calibration remains user-supplied.
