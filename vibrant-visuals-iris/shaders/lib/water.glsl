// =====================================================================
//  Water - the Vibrant Visuals look.
//
//  What Mojang's own Vibrant Visuals data does (bedrock-samples):
//   * water keeps the vanilla grey water texture, tinted by the biome
//     colour (plains #44AFF5, ocean #1787D4, swamp #617B64...)
//   * a normal map made from that same texture: almost flat (avg ~1 deg,
//     max ~10 deg tilt) following the vanilla ripple pattern
//   * very glossy: roughness ~0.08, no metalness
//   * water.json: waves disabled, caustics on (frame_length 0.09 s,
//     scale 0.5), no chlorophyll / sediment
//   * underwater fog: biome colour, fading over 60 blocks
//  So it stays recognisably vanilla water, just lit properly.
// =====================================================================

// Bedrock uses brighter water colours than Java for most biomes.
// Java's default #3F76E4 becomes Bedrock's plains/river #44AFF5.
vec3 bedrockWaterColor(vec3 javaTint) {
    if (distance(javaTint, vec3(63.0, 118.0, 228.0) / 255.0) < 0.03)
        return vec3(68.0, 175.0, 245.0) / 255.0;
    return javaTint;
}

// How fast each colour channel fades with depth, from the biome colour:
// blue water absorbs red first (shallows stay clear and cyan, depths go blue).
vec3 waterExtinction(vec3 tintLinear) {
    return ((1.0 - tintLinear) * 0.4 + 0.01) / WATER_CLARITY;
}
// Default (plains) water, for places that don't know the biome colour
vec3 waterAbsorption() { return waterExtinction(toLinear(vec3(68.0, 175.0, 245.0) / 255.0)); }

// Normal from the vanilla water texture: heights are the texture's
// brightness at this texel and its four neighbours (like Mojang's
// water_still_grey_normal map).
vec3 waterTextureNormal(float hC, float hR, float hL, float hU, float hD) {
    float s = 0.55 * WATER_SPARKLE;
    vec2 slope = vec2(hL - hR, hD - hU) * s;
    return normalize(vec3(slope.x, 1.0, slope.y));
}

// Optional extra ocean waves (off by default: Vibrant Visuals has none)
float waveHeight(vec2 p, float t) {
    float h = 0.0;
    h += valueNoise(p * 0.55 + vec2(t * 0.35, t * 0.22)) * 1.00;
    h += valueNoise(p * 1.10 - vec2(t * 0.30, -t * 0.41)) * 0.50;
    h += valueNoise(p * 2.30 + vec2(-t * 0.55, t * 0.48)) * 0.25;
    return h;
}
vec2 oceanWaveSlope(vec3 worldPos, float dist) {
    vec2 p = worldPos.xz;
    #ifdef PIXELATED_WATER
        p = (floor(p * 16.0) + 0.5) / 16.0;
    #endif
    float t = frameTimeCounter;
    const float e = 1.0 / 16.0;
    float h  = waveHeight(p, t);
    float hx = waveHeight(p + vec2(e, 0.0), t);
    float hz = waveHeight(p + vec2(0.0, e), t);
    float strength = 0.05 * WATER_WAVE_STRENGTH * mix(1.0, 0.1, smoothstep(8.0, 48.0, dist));
    return vec2(h - hx, h - hz) / e * strength;
}

// Animated caustic network (bright lines where voronoi cells meet)
float causticLayer(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(x, y);
            vec2 o = hash22(i + g);
            o = 0.5 + 0.42 * sin(t + TAU * o);
            float d = length(g + o - f);
            if (d < d1) { d2 = d1; d1 = d; }
            else if (d < d2) { d2 = d; }
        }
    }
    return 1.0 - smoothstep(0.0, 0.16, d2 - d1);
}

float waterCaustics(vec3 worldPos, vec3 lightDirWorld) {
    // Project along the light so patterns line up with the sun
    vec2 p = worldPos.xz - lightDirWorld.xz / max(lightDirWorld.y, 0.2) * worldPos.y;
    // Pixelated, like the Vibrant Visuals caustics
    p = (floor(p * 16.0) + 0.5) / 16.0;
    // Stepped animation: water.json frame_length = 0.09 s
    float t = floor(frameTimeCounter / 0.09) * 0.09 * 0.9;
    return causticLayer(p * 0.95, t) * 0.6 + causticLayer(p * 1.6 + 3.7, t * 1.3) * 0.45;
}

// ---------------------------------------------------------------------
//  Full water surface shading (used in composite.fsh).
//   under:  scene colour behind the water surface
//   thick:  blocks of water the view ray travels
//   albedo: vanilla water texture x biome colour (linear)
//   tint:   biome colour (linear)
//   N, V, L: surface normal, view direction, light direction (same space)
//   refl:   reflected colour (SSR or sky)
// ---------------------------------------------------------------------
vec3 shadeWater(vec3 under, float thick, vec3 albedo, vec3 tint, vec3 N, vec3 V, vec3 L,
                vec3 lightCol, vec3 ambient, vec2 lm, float shadow, vec3 refl) {
    // Looking through the water: clear when shallow, biome coloured when deep
    vec3 T = exp(-waterExtinction(tint) * thick);

    // The water itself: the vanilla texture x biome colour, lit by sun and sky.
    // Its opacity grows with depth toward Bedrock's default surface opacity (0.65).
    vec3 lit = ambient * lm.y * lm.y + lightCol * shadow * saturate(L.y * 0.5 + 0.5) * 0.5
             + vec3(1.0, 0.56, 0.24) * pow(lm.x, 3.0) * 1.5 + 0.002;
    float opacity = 0.65 * (1.0 - exp(-thick * 0.18));
    vec3 c = mix(under * T, albedo * lit, opacity);

    // Fresnel reflection (water F0 = 0.02)
    float NdotV = saturate(dot(N, -V));
    float fres = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);
    c = mix(c, refl, fres);

    // Sun glints: GGX with roughness ~0.1 on the per-texel normals
    vec3 H = normalize(L - V);
    float NdotH = saturate(dot(N, H));
    const float a2 = 0.0001;   // (roughness^2)^2 for roughness 0.1
    float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
    float D = a2 / (PI * d * d);
    vec3 spec = lightCol * shadow * D * fres * 0.25 * saturate(dot(N, L));
    return c + min(spec, vec3(60.0));
}
