/*
    Lumenfall - render target formats

const int colortex0Format  = RGBA16F;   // HDR scene colour
const int colortex1Format  = RGBA8;     // albedo (sRGB) + material id
const int colortex2Format  = RGBA16;    // mapped + geometric normal (octahedral)
const int colortex3Format  = RGBA16;    // smoothness/f0, emission/sss, lightmap
const int colortex4Format  = RGBA16F;   // TAA history
const int colortex5Format  = RGBA16F;   // volumetric clouds (history)
const int colortex6Format  = RGBA16;    // translucent surface data
const int colortex7Format  = RGBA16F;   // bloom tiles
const int colortex8Format  = R32F;      // cloud distance (history)
const int colortex9Format  = RGBA32F;   // per-frame light data & exposure
const int shadowcolor0Format = RGBA8;
const int shadowcolor1Format = RGBA8;
*/

const bool colortex0Clear = true;
const bool colortex1Clear = true;
const bool colortex2Clear = true;
const bool colortex3Clear = true;
const bool colortex4Clear = false;
const bool colortex5Clear = false;
const bool colortex6Clear = true;
const bool colortex7Clear = true;
const bool colortex8Clear = false;
const bool colortex9Clear = false;

const vec4 colortex0ClearColor = vec4(0.0, 0.0, 0.0, 0.0);
const vec4 colortex6ClearColor = vec4(0.0, 0.0, 0.0, 0.0);
