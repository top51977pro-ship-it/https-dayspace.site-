/*
    Lumenfall - per-frame light data
    The prepare pass evaluates the atmosphere once per frame and stores the results in
    the first texels of colortex9 so every later program can read them for free.
      (0,0) direct light colour (rgb), light radius (a)
      (1,0) ambient from above
      (2,0) ambient from below
      (3,0) horizon / fog colour (towards light-averaged)
      (4,0) exposure (r), average luminance (g)  - written by the tonemap pass
      (5,0) zenith sky colour
*/

uniform sampler2D colortex9;

#define LD_LIGHT    0
#define LD_AMB_TOP  1
#define LD_AMB_BOT  2
#define LD_FOG      3
#define LD_EXPOSURE 4
#define LD_ZENITH   5
#define LD_COUNT    6

vec4 readLightData(int idx) { return texelFetch(colortex9, ivec2(idx, 0), 0); }

LightInputs readLightInputs() {
    LightInputs li;
    vec4 l = readLightData(LD_LIGHT);
    li.lightDir = lightDirWorld();
    li.lightCol = l.rgb;
    li.lightRadius = l.a;
    li.ambTop = readLightData(LD_AMB_TOP).rgb;
    li.ambBottom = readLightData(LD_AMB_BOT).rgb;
    return li;
}

float readExposure() {
    float e = readLightData(LD_EXPOSURE).r;
    return (e > 0.0 && e < 1e4) ? e : 1.0;
}
