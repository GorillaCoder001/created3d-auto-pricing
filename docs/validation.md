# Validation

## Automated

`npm test` exercises 49 cases covering binary/ASCII STL, closed/open/winding/degenerate geometry, core/external-component 3MF transforms, units, unsliced/sliced separation, validated metadata, unsafe archive/XML rejection, printer bounds, material/support/purge estimates, calibration classification, SGD costs, S$0.31/kWh, 35% margin, fixed/percentage fees, S$5 minimum, batching, one-time fees and customer quotation privacy.

`npm run build` runs TypeScript checks then builds production bundles. GitHub Actions repeats both before deployment. Runtime dependencies were audited and updated to remove the initially detected XML/PDF advisories.

Fixtures are synthetic tetrahedra and explicitly synthetic Bambu-format metadata. They are not real sliced jobs and do not establish Bambu Studio accuracy. No model, slicer benchmark or measured average power supplied by the user was invented.

## Browser checks

The working interface is exercised through file chooser uploads, model analysis, persisted settings, quotation generation and a 390 px embedded viewport. WebGL is disabled in the test browser; the interactive CPU fallback is tested. GPU rendering needs a normal WebGL-enabled browser for complete validation.

Production deployment must additionally have a successful GitHub Actions Pages run and a live application load under `/created3d-auto-pricing/`. Do not infer deployment success from a local build alone.
