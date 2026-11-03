# Actual Bambu Studio benchmark

Generated with Bambu Studio 02.08.02.61, native CLI, official X2D 0.4 mm / 0.20 mm Standard / PLA Basic profiles. All native runs report return_code=0. These are slicer estimates, not measured physical print times.

| Model | Bambu g | Geometry g | Mass error | Bambu min | Geometry min | Time error |
|---|---:|---:|---:|---:|---:|---:|
| single-colour | 3.66 | 3.64 | -0.5% | 13.8 | 8.0 | -41.9% |
| supported | 3.90 | 3.65 | -6.4% | 21.3 | 8.0 | -62.3% |
| multicolour | 4.78 | 1.44 | -69.8% | 27.3 | 3.2 | -88.4% |
| three-colour | 32.16 | 2.16 | -93.3% | 110.9 | 4.8 | -95.7% |

Signed error = (estimate − Bambu) / Bambu × 100%. Negative values underpredict. Geometry uses the same 1.26 g/cm³ density as the actual native material and the application's explicitly assumed 6 mm³/s deposition rate. All unknown time/waste allowances remain zero; no correction multiplier is applied.

These results expose the limits of an uncalibrated geometry model. Particularly for multi-colour work, the unbudgeted result is **not a complete quotation**: waste, tower and switching cannot be inferred from the mesh. The app labels this incomplete and provides editable planning bounds and explicit allowances, or uses actual stored slice totals. No default calibration is shipped.

The supported case has real generated tree supports and interfaces. The two-colour case uses both X2D nozzles; the three-colour case exercises additional filament switching if recorded by the native result. Filament-change counts and feature times are preserved verbatim in references.json; no counts are inferred from preview colours.

Header parsing is independently compared with native result.json, allowing only the header's display rounding (0.01 g per filament and 1 second). This near-zero extraction error is **not** geometry-estimation accuracy.

Reproduce with scripts/generate-benchmark-models.py and scripts/run-bambu-benchmarks.py. The latter requires a genuine Bambu Studio installation/resources and suitable local runtime libraries. Then run scripts/benchmark-report.ts through esbuild as documented in estimation-audit.md. Models are original generated test geometry. Version, SHA-256 model hashes, profile settings, native warnings and raw reference totals are recorded. Full slicer binaries, merged vendor profiles and generated G-code are not distributed.

Native CLI warnings about reserved T commands and unavailable headless thumbnail rendering are retained. They did not prevent successful G-code/project export or positive statistics. GUI-versus-CLI and physical print timing remain unverified.

The reported Gengar case is not included: only its screenshot and dimensions were supplied, without its actual 3MF or a matching Bambu slice.
