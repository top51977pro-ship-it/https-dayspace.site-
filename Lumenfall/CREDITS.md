# Credits

## Technical reference

Lumenfall's feature set and settings-menu organisation were planned after studying
**Complementary Shaders – Unbound (r5.9.3)** by EminGT / Complementary Development
as a technical reference: https://www.complementary.dev

No source code, textures or other files from Complementary are included in Lumenfall.
Every GLSL file, the block/entity id tables, the noise texture and all tooling in this
repository were written from scratch for this project, with a different rendering
architecture (fully deferred G-buffer pipeline instead of forward-lit gbuffers).
Because nothing from Complementary is redistributed, the Complementary License Agreement
does not govern Lumenfall. If you ever add code that is taken from Complementary, you
must follow that license instead: rename requirements, include its unchanged
`License.txt`, credit with a link, and its other conditions.

## Published techniques

These are public, widely documented methods that Lumenfall re-implements:

- Chapman grazing-incidence approximation for atmospheric optical depth (C. Schüler)
- Ground-truth ambient occlusion integral (Jimenez et al., "Practical Real-Time Strategies for Accurate Indirect Occlusion")
- Multi-octave multiple-scattering approximation for clouds (Wrenninge; Hillaire, "Physically Based Sky, Atmosphere and Cloud Rendering in Frostbite")
- Energy-conserving volumetric integration (Hillaire)
- Karis average and 13-tap downsample for bloom (Jimenez, "Next Generation Post Processing in Call of Duty: Advanced Warfare")
- Variance clipping for TAA (Salvi)
- ACES filmic fit (Narkowicz / Hill), AgX (Sobotka) tone mapping
- Contrast-adaptive sharpening idea (AMD FidelityFX CAS)
- LabPBR 1.3 material format (shaderLABS)

## Thanks

- The Iris team for the shader loader: https://irisshaders.dev
