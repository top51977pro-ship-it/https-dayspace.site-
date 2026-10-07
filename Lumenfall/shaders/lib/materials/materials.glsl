/*
    Lumenfall - material system
    PBR_MODE 0: flat (vanilla-like), 1: Lumenfall internal PBR (per-block heuristics),
    2: LabPBR resource packs (normals + specular maps).
    Block ids come from block.properties (mc_Entity.x).
*/

// mc_Entity ids -> material id
int materialFromBlockId(int id) {
    if (id == 10001) return MAT_FOLIAGE;
    if (id == 10002 || id == 10003 || id == 10004 || id == 10005) return MAT_PLANT;
    if (id == 10020) return MAT_LAVA;
    if (id == 10021) return MAT_FIRE;
    if (id == 10022) return MAT_EMISSIVE;
    if (id == 10023) return MAT_TORCH;
    if (id == 10024) return MAT_SCULK;
    if (id == 10025) return MAT_AMETHYST;
    if (id == 10030) return MAT_ORE;
    if (id == 10031) return MAT_METAL;
    if (id == 10032) return MAT_GEM;
    if (id == 10033) return MAT_POLISHED;
    if (id == 10034) return MAT_SNOW;
    if (id == 10035) return MAT_SAND;
    if (id == 10036) return MAT_ICE;
    if (id == 10037) return MAT_WOOD;
    if (id == 10038) return MAT_STONE;
    if (id == 10040) return MAT_END_PORTAL;
    if (id == 10013) return MAT_PORTAL;
    return MAT_DEFAULT;
}

bool isWavingId(int id) { return id >= 10001 && id <= 10005; }

struct MaterialProps {
    float smoothness;
    float f0;
    float emission;
    float sss;
    float porosity;
};

// Internal PBR: physically motivated guesses from block class + texel colour
MaterialProps internalPBR(int mat, vec3 albedoSrgb) {
    MaterialProps m;
    m.smoothness = 0.15;
    m.f0 = 0.02;
    m.emission = 0.0;
    m.sss = 0.0;
    m.porosity = 0.5;

    float lum = luminance(albedoSrgb);
    float maxC = maxOf(albedoSrgb), minC = minOf(albedoSrgb);
    float sat = (maxC - minC) / max(maxC, 1e-3);

    if (mat == MAT_FOLIAGE) { m.sss = 0.85; m.smoothness = 0.35; m.f0 = 0.025; }
    else if (mat == MAT_PLANT) { m.sss = 0.7; m.smoothness = 0.25; }
    else if (mat == MAT_SNOW) { m.sss = 0.55; m.smoothness = 0.30 + lum * 0.15; }
    else if (mat == MAT_LAVA) { m.emission = 1.0; m.smoothness = 0.2; }
    else if (mat == MAT_FIRE) { m.emission = 1.0; }
    else if (mat == MAT_EMISSIVE) {
        // only the bright parts of a light block glow
        m.emission = smoothstep(0.35, 0.85, lum) * 0.9 + 0.1 * lum;
        m.smoothness = 0.4;
    }
    else if (mat == MAT_TORCH) {
        m.emission = smoothstep(0.55, 0.85, maxC) * smoothstep(0.1, 0.45, sat + lum * 0.3);
    }
    else if (mat == MAT_SCULK) {
        // cyan glowing spots
        float cyan = smoothstep(0.25, 0.6, albedoSrgb.b - albedoSrgb.r) * smoothstep(0.3, 0.6, albedoSrgb.g);
        m.emission = cyan * 0.6;
        m.smoothness = 0.35 + cyan * 0.4;
    }
    else if (mat == MAT_AMETHYST) { m.smoothness = 0.82; m.f0 = 0.05; m.emission = smoothstep(0.7, 0.95, lum) * 0.25; }
    else if (mat == MAT_ORE) {
        // ore specks are saturated / bright relative to the stone around them
        float speck = smoothstep(0.18, 0.4, sat) + smoothstep(0.75, 0.9, lum) * 0.5;
        m.smoothness = mix(0.25, 0.85, saturate(speck));
        m.f0 = mix(0.03, 0.9, saturate(speck));
    }
    else if (mat == MAT_METAL) { m.smoothness = 0.58 + lum * 0.16; m.f0 = 1.0; m.porosity = 0.0; }
    else if (mat == MAT_GEM) { m.smoothness = 0.90; m.f0 = 0.06; m.porosity = 0.0; }
    else if (mat == MAT_POLISHED) { m.smoothness = 0.55 + lum * 0.25; m.f0 = 0.04; m.porosity = 0.2; }
    else if (mat == MAT_ICE) { m.smoothness = 0.93; m.f0 = 0.025; m.porosity = 0.0; m.sss = 0.25; }
    else if (mat == MAT_SAND) { m.smoothness = 0.08 + lum * 0.1; m.porosity = 0.9; }
    else if (mat == MAT_WOOD) { m.smoothness = 0.18 + lum * 0.18; m.porosity = 0.6; }
    else if (mat == MAT_STONE) { m.smoothness = 0.12 + lum * 0.22; m.f0 = 0.03; m.porosity = 0.4; }
    else if (mat == MAT_END_PORTAL || mat == MAT_PORTAL) { m.emission = 1.0; }
    else {
        m.smoothness = 0.08 + lum * 0.22;
    }
    return m;
}

// LabPBR 1.3 decoding
MaterialProps labPBR(vec4 spec, int mat) {
    MaterialProps m;
    m.smoothness = spec.r;
    m.f0 = spec.g;
    m.porosity = spec.b < 0.251 ? spec.b * 4.0 : 0.0;
    m.sss = spec.b > 0.251 ? (spec.b - 0.255) / 0.745 : 0.0;
    m.emission = spec.a < 0.999 ? spec.a / 0.996 : 0.0;
    if (mat == MAT_FOLIAGE && m.sss < 0.01) m.sss = 0.8;
    if (mat == MAT_PLANT && m.sss < 0.01) m.sss = 0.6;
    if (mat == MAT_LAVA || mat == MAT_FIRE) m.emission = max(m.emission, 1.0);
    return m;
}

// Normal from albedo height (when no normal map is present)
vec3 generatedNormal(sampler2D albedoTex, vec2 uv, vec2 atlasTexel, float strength) {
    float h0 = luminance(textureLod(albedoTex, uv, 0.0).rgb);
    float hx = luminance(textureLod(albedoTex, uv + vec2(atlasTexel.x, 0.0), 0.0).rgb);
    float hy = luminance(textureLod(albedoTex, uv + vec2(0.0, atlasTexel.y), 0.0).rgb);
    vec2 d = vec2(h0 - hx, h0 - hy) * strength * 1.6;
    return normalize(vec3(d, 1.0));
}
