// Composite 0: water / glass reflections and volumetric light

#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
#include "/lib/shadows.glsl"
#include "/lib/water.glsl"

uniform sampler2D colortex0;
uniform sampler2D colortex1;
uniform sampler2D colortex3;
uniform sampler2D depthtex0;
uniform sampler2D depthtex1;

in vec2 texcoord;
flat in vec3 atmLight;
flat in vec3 atmAmbient;
flat in vec3 atmZenith;
flat in vec3 atmHorizon;
flat in vec3 atmGlow;
flat in vec4 atmParams;

/* RENDERTARGETS: 0,2 */
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outVL;

vec3 skyInDirection(vec3 viewDir) {
#ifdef DIM_OVERWORLD
    vec3 dir = mat3(gbufferModelViewInverse) * viewDir;
    vec3 lightDir = normalize(mat3(gbufferModelViewInverse) * shadowLightPosition);
    return getSky(dir, lightDir, atmZenith, atmHorizon, atmGlow, atmParams);
#else
    return toLinear(fogColor) * 0.5;
#endif
}

// Screen space ray march against the opaque depth buffer
bool traceSSR(vec3 origin, vec3 dir, float dither, out vec2 hitUV) {
    float stepLen = 0.35;
    vec3 pos = origin + dir * stepLen * dither;
    hitUV = vec2(0.0);
    for (int i = 0; i < 28; i++) {
        vec3 prev = pos;
        pos += dir * stepLen;
        stepLen *= 1.22;
        vec3 sp = viewToScreen(pos);
        if (sp.x < 0.0 || sp.x > 1.0 || sp.y < 0.0 || sp.y > 1.0 || pos.z > -near) return false;
        float sceneDepth = texture(depthtex1, sp.xy).r;
        if (sp.z > sceneDepth && sceneDepth < 1.0) {
            float sceneZ = screenToView(sp.xy, sceneDepth).z;
            if (abs(pos.z - sceneZ) > stepLen * 2.5 + 0.5) continue;  // passed behind an occluder
            // Binary refinement
            vec3 a = prev, b = pos;
            for (int j = 0; j < 5; j++) {
                vec3 m = (a + b) * 0.5;
                vec3 ms = viewToScreen(m);
                if (ms.z > texture(depthtex1, ms.xy).r) b = m; else a = m;
            }
            hitUV = viewToScreen(b).xy;
            return true;
        }
    }
    return false;
}

void main() {
    vec3 color = texture(colortex0, texcoord).rgb;
    vec4 data = texture(colortex1, texcoord);
    float depth0 = texture(depthtex0, texcoord).r;
    vec3 viewPos = screenToView(texcoord, depth0);
    vec3 viewDir = normalize(viewPos);
    float dith = bayer16(gl_FragCoord.xy);

    // ------------------------------------------------------ water & glass
    float slot = unpackSlot(data.z);
    if ((slot == DATA_WATER || slot == DATA_GLASS) && depth0 < 1.0 && isEyeInWater == 0) {
        vec3 N = decodeNormal(data.xy);
        vec2 lm = unpackLight(data.z);
        vec3 R = reflect(viewDir, N);

        // Reflection: SSR, falling back to the sky (dimmed under roofs)
        vec3 refl = skyInDirection(R) * smoothstep(0.2, 0.9, lm.y) + vec3(0.002);
        #ifdef WATER_REFLECTIONS
            vec2 hitUV;
            if (traceSSR(viewPos + N * 0.02, R, dith, hitUV)) {
                vec2 edge = smoothstep(0.0, 0.08, hitUV) * smoothstep(1.0, 0.92, hitUV);
                refl = mix(refl, texture(colortex0, hitUV).rgb, edge.x * edge.y);
            }
        #endif

        if (slot == DATA_WATER) {
            // Refraction: nudge the lookup by the wave normal, but only onto
            // pixels that are also under water
            vec3 upV = normalize(upPosition);
            vec2 offset = (N.xy - upV.xy * dot(N, upV)) * 0.05 / max(1.0, -viewPos.z * 0.08);
            vec2 refrUV = texcoord + offset;
            if (unpackSlot(texture(colortex1, refrUV).z) != DATA_WATER
                || texture(depthtex1, refrUV).r < depth0) refrUV = texcoord;

            vec3 under = texture(colortex0, refrUV).rgb / (1.0 - 0.004);
            float depth1 = texture(depthtex1, refrUV).r;
            float thick = depth1 >= 1.0 ? 128.0 : distance(screenToView(refrUV, depth1), viewPos);

            vec4 tintData = texture(colortex3, texcoord);
            vec3 albedo = toLinear(tintData.rgb);                       // texture x biome colour
            vec3 tint = toLinear(tintData.rgb / max(tintData.a, 0.05)); // biome colour
            vec3 L = vec3(0.0, 1.0, 0.0);
            float shadow = 0.0;
            #ifdef DIM_OVERWORLD
                L = normalize(shadowLightPosition);
                vec3 playerPos = (gbufferModelViewInverse * vec4(viewPos, 1.0)).xyz;
                vec3 upW = vec3(0.0, 1.0, 0.0);
                shadow = getShadow(playerPos, upW, 1.0, false, dith).light * smoothstep(0.05, 0.4, lm.y);
            #endif
            color = shadeWater(under, thick, albedo, tint, N, viewDir, L, atmLight, atmAmbient, lm, shadow, refl);
        } else {
            float NdotV = saturate(dot(N, -viewDir));
            float fres = (0.04 + 0.96 * pow(1.0 - NdotV, 5.0)) * 0.6;
            color = mix(color, refl, fres);
        }
    }

    // Looking up at the water surface from below (Snell's window): light can
    // only leave the water within ~48.6 deg of straight up. Inside that circle
    // you see the world above, tinted and rippled; outside it the surface is a
    // mirror of the water below (total internal reflection).
    if (slot == DATA_WATER && isEyeInWater == 1) {
        vec4 tintData = texture(colortex3, texcoord);
        vec3 tint = toLinear(tintData.rgb / max(tintData.a, 0.05));
        float ripple = tintData.a / 0.64;           // vanilla texture brightness
        vec3 upV = normalize(upPosition);
        float cosUp = dot(viewDir, upV);            // 1 = looking straight up
        float window = smoothstep(0.6, 0.72, cosUp);
        vec3 below = underwaterFogColor(tint, atmAmbient, atmLight);
        vec3 through = color * mix(vec3(1.0), tint * 1.6, 0.3) * (0.82 + 0.25 * ripple);
        // Edge of the window: a bright rim like in real water
        through += below * 0.6 * (1.0 - smoothstep(0.72, 0.85, cosUp));
        color = mix(below, through, window);
    }

    // ------------------------------------------------------ volumetric light
    vec3 vl = vec3(0.0);
#if defined VOLUMETRIC_LIGHT && defined DIM_OVERWORLD
    {
        float maxDist = min(depth0 >= 1.0 ? shadowDistance : length(viewPos), shadowDistance);
        vec3 dirWorld = mat3(gbufferModelViewInverse) * viewDir;
        vec3 origin = gbufferModelViewInverse[3].xyz;
        vec3 L = normalize(shadowLightPosition);
        float VdotL = dot(viewDir, L);

        // Vibrant Visuals biome fogs use density 0.05 x scattering 0.04-0.06
        // (~0.0025 per block) with Henyey-Greenstein g 0.4-0.6. The haze looks
        // strongest at sunrise / sunset because the sun is low and behind it.
        float t = vvTime();
        float morning = exp(-pow((t - 0.75) / 0.06, 2.0)) + exp(-pow((t - 0.25) / 0.06, 2.0)) * 0.6;
        float density = 0.0025 * (1.0 + morning * 0.8 * MORNING_FOG + rainStrength * 1.5) * FOG_DENSITY;
        float phase = phaseHG(VdotL, 0.6);

        float eyeSky = eyeBrightnessSmooth.y / 240.0;
        float accum = 0.0;
        float trans = 1.0;
        float prevT = 0.0;
        for (int i = 0; i < VL_SAMPLES; i++) {
            float f = (float(i) + dith) / float(VL_SAMPLES);
            float d = f * f * maxDist;                // more samples close to the camera
            float stepLen = d - prevT;
            prevT = d;
            vec3 p = origin + dirWorld * d;
            float height = p.y + cameraPosition.y;
            float dens = density * exp(-max(height - 63.0, 0.0) / 48.0);
            float lit = shadowTap(p);
            accum += lit * dens * stepLen * trans;
            trans *= exp(-dens * stepLen);
        }
        vl = atmLight * accum * phase * 2.0 * VL_STRENGTH * mix(0.35, 1.0, eyeSky);
        if (isEyeInWater == 1) vl *= vec3(0.2, 0.6, 1.0) * 0.6;
    }
#endif

    outColor = vec4(color, 1.0);
    outVL = vec4(vl, 1.0);
}
