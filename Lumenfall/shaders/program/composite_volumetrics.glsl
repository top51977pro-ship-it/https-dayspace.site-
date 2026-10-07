/*
    Lumenfall - composite: volumetric light & atmospheric fog
    Ray-marched participating medium (height mist, rain haze, cave air, underwater,
    nether smoke, end dust) lit through the shadow map and cloud shadows -> god rays.
    Aerial perspective & border fog use the real sky colour in each direction.
*/

#include "/lib/common.glsl"

//==================================================================================//
#ifdef VERTEX_SHADER

out vec2 vUV;
flat out vec3 vLightCol;
flat out vec3 vAmbTop;
flat out vec3 vFogCol;

#include "/lib/atmosphere/lightData.glsl"
#include "/lib/util/noise.glsl"
#include "/lib/atmosphere/dimensions.glsl"

void main() {
    gl_Position = ftransform();
    vUV = gl_MultiTexCoord0.xy;
    LightInputs li = readLightInputs();
    vLightCol = li.lightCol;
    vAmbTop = li.ambTop;
    vFogCol = readLightData(LD_FOG).rgb;
    #ifdef NETHER
        vLightCol = vec3(0.0); vAmbTop = netherAmbient(); vFogCol = netherBiomeColor();
    #endif
    #ifdef END
        vLightCol = endLightColor(); vAmbTop = endAmbient(); vFogCol = vec3(0.05, 0.035, 0.08);
    #endif
}

#endif

//==================================================================================//
#ifdef FRAGMENT_SHADER

in vec2 vUV;
flat in vec3 vLightCol;
flat in vec3 vAmbTop;
flat in vec3 vFogCol;

uniform sampler2D colortex0;
uniform sampler2D depthtex0;
uniform sampler2D shadowtex0;
uniform sampler2DShadow shadowtex1;
uniform sampler2D shadowcolor0;
uniform sampler2D shadowcolor1;

#include "/lib/util/noise.glsl"
#include "/lib/util/space.glsl"
#include "/lib/water/waves.glsl"
#include "/lib/atmosphere/atmosphere.glsl"
#include "/lib/atmosphere/skyObjects.glsl"
#include "/lib/atmosphere/dimensions.glsl"
#include "/lib/atmosphere/sky.glsl"
#include "/lib/atmosphere/clouds.glsl"

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;

// Single-tap shadow visibility for volumetrics (coloured through glass, absorbed by water)
vec3 volumeShadow(vec3 playerPos, out bool inWaterShadow) {
    inWaterShadow = false;
    #ifndef SHADOWS
        return vec3(1.0);
    #else
        vec3 clip = playerToShadowClip(playerPos);
        if (any(greaterThan(abs(clip.xy), vec2(1.0)))) return vec3(1.0);
        vec3 sp = distortShadow(clip) * 0.5 + 0.5;
        float vis = texture(shadowtex1, vec3(sp.xy, sp.z));
        if (vis < 0.01) return vec3(0.0);
        float d0 = texelFetch(shadowtex0, ivec2(sp.xy * float(shadowMapResolution)), 0).r;
        if (d0 < sp.z) {
            ivec2 tc = ivec2(sp.xy * float(shadowMapResolution));
            if (texelFetch(shadowcolor1, tc, 0).r > 0.5) {
                inWaterShadow = true;
                float depth = (sp.z - d0) / abs(0.125 * shadowProjection[2][2]);
                return vec3(vis) * exp(-waterAbsorption() * depth);
            }
            vec4 tint = texelFetch(shadowcolor0, tc, 0);
            return vec3(vis) * mix(vec3(1.0), srgbToLinear(tint.rgb), tint.a);
        }
        return vec3(vis);
    #endif
}

float causticPatternCheap(vec2 p) {
    float t = frameTimeCounter * 0.6 * WATER_WAVE_SPEED;
    float a = noise2D(p * 1.7 + vec2(t, t * 0.6));
    float b = noise2D(p * 2.3 - vec2(t * 0.8, -t * 0.5) + 31.0);
    float c = 1.0 - abs(a - b) * 3.0;
    return pow(saturate(c), 6.0) * 2.5 + 0.35;
}

// Medium density (per block) at a world position
float mediumDensity(vec3 wp) {
    #if defined NETHER
        float base = 0.010 * NETHER_FOG_DENSITY;
        float n = fbm3D(wp * 0.04 + vec3(frameTimeCounter * 0.15, frameTimeCounter * 0.05, 0.0), 3);
        return base * (0.6 + n * 0.9);
    #elif defined END
        float n = fbm3D(wp * 0.03 + vec3(frameTimeCounter * 0.05, 0.0, 0.0), 3);
        float low = exp(-max(wp.y - 30.0, 0.0) / 40.0);
        return 0.004 * END_FOG_DENSITY * (0.4 + n) * (0.5 + low);
    #else
        float h = wp.y - 63.0;
        float sunY = sunDirWorld().y;
        float morning = smoothstep(0.3, 0.02, abs(sunY - 0.1)) * (1.0 - lf_rain);
        // clear air is very thin; mist hugs the ground (thicker at dawn)
        float base = 0.00045 * exp(-max(h, 0.0) / 140.0);
        #ifdef HEIGHT_FOG
            base += (0.0012 + morning * 0.0045) * HEIGHT_FOG_DENSITY * exp(-max(h, 0.0) / 18.0);
        #endif
        base += lf_rain * 0.0042 * RAIN_FOG_DENSITY * exp(-max(h, 0.0) / 160.0);
        #ifdef CAVE_FOG
            base += lf_caveFactor * 0.004;
        #endif
        // drifting wisps
        float n = fbm3D(wp * 0.025 + vec3(frameTimeCounter * 0.25, 0.0, frameTimeCounter * 0.1), 3);
        base *= 0.45 + n * 1.1;
        return base * FOG_DENSITY;
    #endif
}

void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    vec2 uv = vUV - taaOffset();
    vec3 color = texelFetch(colortex0, px, 0).rgb;
    float z0 = texelFetch(depthtex0, px, 0).r;
    bool sky = z0 >= 1.0;
    bool hand = z0 < HAND_DEPTH;

    vec3 viewPos = screenToView(vec3(uv, sky ? 1.0 : z0));
    vec3 playerPos = viewToPlayer(viewPos);
    vec3 dir = normalize(playerPos);
    float dist = sky ? far * 2.0 : length(playerPos);
    float dither = blueNoise(gl_FragCoord.xy);
    vec3 lightDir = lightDirWorld();
    bool underwater = isEyeInWater == 1;

    //==================================================================== aerial / border fog
    #ifdef OVERWORLD
        if (!sky && !hand && !underwater) {
            vec3 fogDir = normalize(vec3(dir.x, max(dir.y, 0.02), dir.z));
            vec3 skyCol = skyAtmosphere(fogDir);
            float air = 1.0 - exp(-dist * 0.00045 * FOG_DENSITY * (1.0 + lf_rain * 3.0));
            #ifdef BORDER_FOG
                float border = smoothstep(far * 0.72, far * 0.98, dist);
                air = max(air, border);
            #endif
            color = mix(color, skyCol, saturate(air));
        }
    #endif

    #ifdef NETHER
        if (!hand) {
            float limit = sky ? 1.0 : 1.0 - exp(-dist * 0.012 * NETHER_FOG_DENSITY);
            color = mix(color, vFogCol * 0.55, limit);
        }
    #endif

    #ifdef END
        if (!hand && !sky) {
            float limit = smoothstep(far * 0.6, far, dist);
            color = mix(color, endSky(dir, 0.002), limit);
        }
    #endif

    //==================================================================== volumetric light
    #ifdef VOLUMETRIC_LIGHT
    {
        float maxDist = min(dist, sky ? 192.0 : 512.0);
        #if defined SHADOWS && !defined NETHER
            maxDist = min(maxDist, shadowDistance * 1.25);
        #endif
        if (hand) maxDist = min(dist, 2.0);
        const int steps = VL_STEPS;
        float stepLen = maxDist / float(steps);
        float mu = dot(dir, lightDir);
        float phase = mix(phaseHG(mu, 0.72), phaseHG(mu, -0.2), 0.3);
        float uwPhase = mix(phaseHG(mu, 0.85), 0.0796, 0.25);

        vec3 scatter = vec3(0.0);
        vec3 transmittance = vec3(1.0);
        float night = 1.0 - dayFactor();
        float strength = VL_STRENGTH * mix(1.0, VL_NIGHT_STRENGTH, night);

        vec3 waterSigma = waterAbsorption() + vec3(0.02);
        vec3 waterScatterAlbedo = vec3(0.10, 0.45, 0.50);

        for (int i = 0; i < steps; i++) {
            float t = (float(i) + dither) * stepLen;
            vec3 p = dir * t;
            vec3 wp = p + cameraPosition;

            bool inWaterShadow;
            vec3 vis = volumeShadow(p, inWaterShadow);
            #ifdef NETHER
                vis = vec3(0.0);
            #endif

            if (underwater) {
                #ifdef UNDERWATER_VL
                    float c = causticPatternCheap(wp.xz - lightDir.xz / max(lightDir.y, 0.2) * max(63.0 - wp.y, 0.0));
                    vec3 S = (vLightCol * vis * uwPhase * c * 0.6 + vAmbTop * 0.03) * waterScatterAlbedo * 0.06;
                    vec3 ext = exp(-waterSigma * stepLen * 0.85);
                    scatter += transmittance * S * (1.0 - ext) / waterSigma;
                    transmittance *= ext;
                #endif
            } else {
                float density = mediumDensity(wp);
                #ifdef OVERWORLD
                    float cs = 1.0;
                    #if defined CLOUD_SHADOWS && defined VOLUMETRIC_CLOUDS
                        float tc = (mix(CLOUD_BASE, CLOUD_TOP, 0.35) - wp.y) / max(lightDir.y, 0.05);
                        cs = exp(-cloudDensity(wp + lightDir * max(tc, 0.0), false) * CLOUD_THICKNESS * 0.5);
                        cs = mix(1.0, cs, 0.9);
                    #endif
                    vis *= cs;
                #endif
                vec3 light = vLightCol * vis * phase * strength;
                vec3 ambient = vAmbTop * 0.35;
                #ifdef NETHER
                    // lava glow from below
                    light = vec3(1.0, 0.32, 0.06) * 0.8 * exp(-max(wp.y - 31.0, 0.0) / 12.0);
                    ambient = vFogCol * 0.6;
                #endif
                vec3 S = (light + ambient) * density;
                float ext = exp(-density * stepLen);
                scatter += transmittance * S * (1.0 - ext) / max(density, 1e-6);
                transmittance *= ext;
            }
        }
        // underwater extinction was already applied by the water pass
        color = underwater ? color + scatter : color * transmittance + scatter;
    }
    #endif

    //==================================================================== blindness / darkness
    float blind = max(blindness, darknessFactor);
    if (blind > 0.0) color *= exp(-dist * blind * 0.25);

    outColor = vec4(max(color, vec3(0.0)), 1.0);
}

#endif
