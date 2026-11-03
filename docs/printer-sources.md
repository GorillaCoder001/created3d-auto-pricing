# Printer specifications and provenance

Checked 3 November 2026. Hardware dimensions are factual summaries from official Bambu information and Bambu Studio profiles, not redistributed slicer profiles. No Bambu slicing code is embedded.

| Printer | Main / single nozzle (mm) | Both-nozzle common area (mm) | Additional constraints |
|---|---|---|---|
| X2D | 256 × 256 × 260 | 235.5 × 256 × 256 | Auxiliary nozzle X starts at 20.5 mm; same-diameter pair assumed |
| H2D | 325 × 320 × 325 | 300 × 320 × 325 | 350 mm union is not the dual-printing intersection |
| X1 Carbon | 256 × 256 × 256 | — | 18 × 28 mm cutter exclusion |
| P1S | 256 × 256 × 256 | — | 18 × 28 mm cutter exclusion |
| P2S | 256 × 256 × 256 | — | Wrapping/purge exclusions still require slicer review |
| A1 | 256 × 256 × 256 | — | Open-frame material/environment suitability requires review |
| A1 mini | 180 × 180 × 180 | — | Open-frame material/environment suitability requires review |

The bounding-box compatibility check uses current orientation and scale. It does not arrange objects, certify tower clearance, check toolhead collisions or prove printable support geometry. Dual-nozzle checks use a conservative common rectangular area. The H2D union and model placement outside common regions require Bambu Studio.

- [Official X2D print-area explanation](https://blog.bambulab.com/two-extruders-one-purpose-what-is-x2d-direct-drive-extrusion-and-auxiliary-extrusion/)
- [Official X2D launch specifications](https://blog.bambulab.com/xcellence-made-simple-bambu-lab-presents-the-x2d/)
- [Official H2D specifications PDF](https://cdn1.bambulab.com/documentation/h2d/en/H2D_Laser_Full_Combo_20250305.pdf)
- [Official Bambu Studio machine profiles](https://github.com/bambulab/BambuStudio/tree/master/resources/profiles/BBL/machine)

The X2D 0.4 mm profile currently specifies a 261 mm main height; the app deliberately uses the manufacturer's more conservative published **260 mm**. Auxiliary height remains 256 mm. This discrepancy is not silently rounded away.

Supported nozzle options are 0.2, 0.4, 0.6 and 0.8 mm. The default 0.4 mm / 0.20 mm Standard preset follows the machine profile's `default_print_profile`. Other quality selections, nozzle-dependent layer heights, densities, effective flow and support factors are **practical assumptions**. No generic top-speed value is represented as actual model-specific print performance.

Profile blob identifiers are recorded in `profile-provenance.json` for reproducibility.
