// Translucent terrain: water, stained glass, ice, slime, honey...
// Written forward-lit into the premultiplied translucent buffer (colortex3), plus the
// surface normal and material so the composite pass can add reflections and refraction.

#include "/lib/settings.glsl"
#include "/lib/uniforms.glsl"
#include "/lib/common.glsl"
#include "/lib/transforms.glsl"

//==================================================================================//
#ifdef VSH

in vec4 mc_Entity;
in vec4 mc_midTexCoord;
in vec4 at_tangent;

out vec2 texcoord;
out vec2 lmcoord;
out vec4 glcolor;
out vec3 normalW;
out vec4 tangentW;
out vec3 playerPos;
out vec2 midCoord;
out vec2 texHalf;
flat out int blockId;

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    lmcoord = saturate((lmcoord - 1.0 / 32.0) * 16.0 / 15.0);
    glcolor = gl_Color;
    blockId = int(mc_Entity.x + 0.5);

    vec3 viewPos = (gl_ModelViewMatrix * gl_Vertex).xyz;
    playerPos = viewToPlayer(viewPos);
    normalW = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));
    vec3 t = gl_NormalMatrix * at_tangent.xyz;
    tangentW = vec4(dot(t, t) > 1e-6 ? normalize(mat3(gbufferModelViewInverse) * t) : vec3(1.0, 0.0, 0.0),
                    at_tangent.w < 0.0 ? -1.0 : 1.0);
    midCoord = mc_midTexCoord.xy;
    texHalf = abs(texcoord - mc_midTexCoord.xy);

    #ifdef WATER_WAVES
    if (blockId == ID_WATER && normalW.y > 0.5) {
        // tiny vertical bob, keeps shorelines intact
        vec3 wp = playerPos + cameraPosition;
        playerPos.y += sin(frameTimeCounter * 1.4 * WATER_WAVE_SPEED + wp.x * 0.7 + wp.z * 0.45) * 0.012 * WATER_WAVE_STRENGTH;
    }
    #endif

    gl_Position = gl_ProjectionMatrix * vec4(playerToView(playerPos), 1.0);
    applyTAAJitter(gl_Position);
}

#endif
//==================================================================================//
#ifdef FSH

in vec2 texcoord;
in vec2 lmcoord;
in vec4 glcolor;
in vec3 normalW;
in vec4 tangentW;
in vec3 playerPos;
in vec2 midCoord;
in vec2 texHalf;
flat in int blockId;

#include "/lib/atmosphere.glsl"
#include "/lib/sky.glsl"
#include "/lib/shadows.glsl"
#ifdef OVERWORLD
#include "/lib/clouds.glsl"
#endif
#include "/lib/lighting.glsl"
#include "/lib/fog.glsl"
#include "/lib/water.glsl"

#ifdef PORTAL_EFFECT
// Nether portal: a see-through window with glowing streaks stacked at several depths
// behind the surface (parallax), which gives the swirling "tunnel" look.
vec4 netherPortal(float dither) {
    vec3 N = normalize(normalW);
    vec3 T = normalize(tangentW.xyz - N * dot(tangentW.xyz, N));
    vec3 B = cross(N, T) * tangentW.w;
    vec3 rd = normalize(playerPos);
    float rdN = max(abs(dot(rd, N)), 0.25);
    vec2 tileSize = max(texHalf * 2.0, vec2(1e-6));
    vec2 tileMin = midCoord - texHalf;
    // uv shift per block of depth into the portal
    vec2 uvPerDepth = vec2(dot(rd, T), dot(rd, B)) / rdN * tileSize;

    vec3 glow = vec3(0.0);
    float front = 0.0;
    const int layers = 4;
    for (int i = 0; i < layers; i++) {
        float depth = (float(i) + dither * 0.5) * 0.22;
        vec2 coord = texcoord + uvPerDepth * depth;
        coord = tileMin + mod(coord - tileMin, tileSize);
        vec3 s = textureLod(gtexture, coord, 0.0).rgb;
        float l = luminance(s);
        // only the light swirls of the vanilla texture become glowing streaks
        float streak = smoothstep(0.42, 0.72, l);
        streak *= streak;
        vec3 col = mix(vec3(0.70, 0.12, 1.00), vec3(1.00, 0.55, 1.00), smoothstep(0.62, 0.85, l));
        float w = i == 0 ? 1.0 : 0.55 * exp(-float(i) * 0.6);
        glow += col * streak * w;
        if (i == 0) front = streak;
    }
    glow *= 1.6 * PORTAL_BRIGHTNESS;

    // the dark gaps let the world show through, dimmed and tinted violet
    float alpha = 0.45 + front * 0.35;
    vec3 tint = vec3(0.18, 0.03, 0.35) * 0.25;
    return vec4(glow / alpha + tint, alpha);
}
#endif

/* RENDERTARGETS: 3,1,2 */
layout(location = 0) out vec4 outTranslucent;
layout(location = 1) out vec4 outData;
layout(location = 2) out vec4 outMaterial;

void main() {
    setupAtmosphere();

    float dither = getDither(gl_FragCoord.xy);
    float dist = length(playerPos);
    vec3 viewDir = -playerPos / dist;
    vec3 normal = normalize(normalW);
    vec3 shadow;
    vec4 outCol;
    int material;
    float smoothness;

    if (blockId == ID_WATER) {
        material = MAT_WATER;
        smoothness = 1.0;

        #ifdef WATER_WAVES
        vec3 worldPos = playerPos + cameraPosition;
        float strength = WATER_WAVE_STRENGTH * mix(1.0, 0.35, smoothstep(24.0, 96.0, dist));
        if (normal.y > 0.5) {
            normal = getWaterNormal(worldPos.xz, strength);
        } else if (normal.y > -0.5) {
            vec3 n2 = getWaterNormal(worldPos.xz + worldPos.y, strength * 0.5);
            normal = normalize(normal + vec3(n2.x, 0.0, n2.z));
        }
        #endif
        // underwater view of the surface faces downwards
        if (isEyeInWater == 1 && dot(normal, viewDir) < 0.0) normal = -normal;

        vec3 tint = getWaterTint(glcolor.rgb);
        vec3 lit = computeLighting(tint, normal, playerPos, lmcoord, 1.0, 0.0, 0.0, 0.02, 0.0, dither, shadow);
        float alpha = WATER_OPACITY;

        // sun / moon highlight (computeLighting skips it for smoothness 0)
        float spec = specularGGX(normal, viewDir, lightDir, 0.06, 0.02);
        vec3 highlight = lightColor * shadow * min(spec, 60.0);
        lit = lit * 0.6 + highlight / max(alpha, 0.1);

        lit = applyFog(lit, playerPos);
        outCol = vec4(lit, alpha);
    }
    #ifdef PORTAL_EFFECT
    else if (blockId == ID_NETHER_PORTAL) {
        material = MAT_GLASS;
        smoothness = 0.0;
        outCol = netherPortal(dither);
        outCol.rgb = applyFog(outCol.rgb, playerPos);
    }
    #endif
    else {
        vec4 albedo = texture(gtexture, texcoord) * glcolor;
        if (albedo.a < 0.02) discard;
        material = MAT_GLASS;
        smoothness = blockId == ID_ICE ? 0.92 : 0.96;

        vec3 lin = toLinear(albedo.rgb);
        float emission = blockId == ID_NETHER_PORTAL ? 0.9 : 0.0;
        if (emission > 0.0) smoothness = 0.0;
        vec3 lit = computeLighting(lin, normal, playerPos, lmcoord, 1.0, 0.0, smoothness, 0.04, emission, dither, shadow);
        lit = applyFog(lit, playerPos);
        outCol = vec4(lit, albedo.a);
    }

    outTranslucent = outCol;
    outData = vec4(encodeNormal(normal), lmcoord);
    outMaterial = vec4(encodeMat(material), smoothness, 0.0, 0.0);
}

#endif
