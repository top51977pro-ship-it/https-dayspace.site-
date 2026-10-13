// =====================================================================
//  Surface lighting (forward, used by all lit gbuffers programs)
//  Requires: common, atmosphere, shadows (overworld), water
// =====================================================================

const vec3 BLOCKLIGHT_COLOR = vec3(1.0, 0.56, 0.24);   // warm torch light

struct Surface {
    vec3  albedo;     // linear
    vec3  viewNormal;
    vec3  viewPos;
    vec3  playerPos;
    vec2  lm;         // remapped lightmap (block, sky)
    float ao;         // vanilla ambient occlusion
    int   mat;
};

vec3 emission(vec3 albedo, vec3 albedoSRGB, int mat) {
    float strength = 0.0;
    if (mat == MAT_EMISSIVE || mat == MAT_LAVA) {
        strength = 1.0;
    } else if (mat == MAT_LIGHTSRC) {
        // Only the bright, warm pixels of torches/lanterns/fire
        float m = max(albedoSRGB.r, max(albedoSRGB.g, albedoSRGB.b));
        strength = smoothstep(0.55, 0.85, m) * smoothstep(0.0, 0.25, albedoSRGB.r - albedoSRGB.b + 0.1);
    }
    return albedo * strength * 4.0 * EMISSIVE_STRENGTH;
}

vec3 shadeSurface(Surface s, vec3 lightCol, vec3 ambientCol, float dither) {
    vec3 n = s.viewNormal;
    bool plant  = s.mat == MAT_PLANT || s.mat == MAT_PLANT_TALL;
    bool foliage = plant || s.mat == MAT_LEAVES;
    bool softEntity = s.mat == MAT_ENTITY_SSS;
    vec3 up = normalize(upPosition);
    // Grass and flowers are lit like the ground they stand on
    if (plant) n = up;

    vec3 worldNormal = mat3(gbufferModelViewInverse) * n;
    vec3 geomNormalWorld = mat3(gbufferModelViewInverse) * s.viewNormal;
    float skyLight = s.lm.y;
    float ao = pow(s.ao, 1.3);

    vec3 color = vec3(0.0);

#ifndef NO_SKY
    vec3 L = normalize(shadowLightPosition);
    float NdotL = dot(n, L);
    float diffuse = foliage ? (s.mat == MAT_LEAVES ? saturate(NdotL * 0.6 + 0.4) : saturate(NdotL * 0.5 + 0.5))
                  : softEntity ? saturate(NdotL * 0.8 + 0.2)
                  : saturate(NdotL);

    ShadowResult sh;
    sh.light = 1.0;
    sh.waterDepth = 0.0;
    if (diffuse > 0.0 || foliage) {
        vec3 shadowPos = s.playerPos;
        #if defined BLOCKY_SHADOWS && (defined PROG_TERRAIN || defined PROG_BLOCK)
            shadowPos = snapToTexel(s.playerPos, geomNormalWorld);
        #endif
        sh = getShadow(shadowPos, worldNormal, NdotL, foliage, dither);
    }
    // Beyond the shadow map, and as a guard against leaks into caves,
    // fall back to skylight
    float leakGuard = smoothstep(0.05, 0.4, skyLight);
    float shadow = sh.light * leakGuard;

    vec3 direct = lightCol * diffuse * shadow;

    #ifdef WATER_CAUSTICS
        if (sh.waterDepth > 0.05) {
            vec3 lightWorld = mat3(gbufferModelViewInverse) * L;
            vec3 worldPos = s.playerPos + cameraPosition;
            float c = waterCaustics(worldPos, lightWorld);
            vec3 absorb = exp(-sh.waterDepth * waterAbsorption());
            direct *= absorb * (0.6 + c * 1.3 * saturate(1.0 - sh.waterDepth / 24.0));
        }
    #endif

    color += direct;

    #ifdef SUBSURFACE_SCATTERING
        if (foliage) {
            // Light glowing through leaves when looking toward the sun
            vec3 V = normalize(s.viewPos);
            float VdotL = dot(V, L);
            float sss = phaseHG(VdotL, 0.5) * 1.6 + 0.08;
            color += lightCol * shadow * sss * (s.mat == MAT_LEAVES ? 0.32 : 0.22);
        }
        if (softEntity) {
            float VdotL = dot(normalize(s.viewPos), L);
            color += lightCol * shadow * (phaseHG(VdotL, 0.4) * 1.2 + 0.05) * 0.2;
        }
    #endif

    // Sky ambient, brighter on upward faces
    float upness = dot(worldNormal, vec3(0.0, 1.0, 0.0));
    vec3 ambient = ambientCol * (0.72 + 0.28 * upness) * skyLight * skyLight;
    color += ambient * ao;
#else
    // Nether / End: no sun, a flat tinted ambient
    #ifdef DIM_NETHER
        vec3 amb = toLinear(fogColor) * 0.9 + vec3(0.06, 0.035, 0.03);
    #else
        vec3 amb = vec3(0.075, 0.06, 0.1);
    #endif
    color += amb * ao * AMBIENT_BRIGHTNESS;
#endif

    // Block light: warm, with a soft falloff and a hot core near the source
    float bl = s.lm.x;
    vec3 blockLight = BLOCKLIGHT_COLOR * (pow(bl, 3.2) * 2.2 + pow(bl, 12.0) * 2.0) * BLOCKLIGHT_BRIGHTNESS;
    color += blockLight * ao;

    // Minimum light in caves, plus night vision
    color += vec3(0.0035, 0.004, 0.005) * ao + vec3(0.25) * nightVision;

    return s.albedo * color;
}
