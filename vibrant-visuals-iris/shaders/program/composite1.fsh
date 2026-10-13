// Composite 1: atmospheric haze, render-distance fog, underwater fog,
// and the (denoised) volumetric light.

#include "/lib/settings.glsl"
#include "/lib/common.glsl"
#include "/lib/atmosphere.glsl"
#include "/lib/water.glsl"

uniform sampler2D colortex0;
uniform sampler2D colortex1;
uniform sampler2D colortex2;
uniform sampler2D depthtex0;

in vec2 texcoord;
flat in vec3 atmLight;
flat in vec3 atmAmbient;
flat in vec3 atmZenith;
flat in vec3 atmHorizon;
flat in vec3 atmGlow;
flat in vec4 atmParams;

/* RENDERTARGETS: 0 */
layout(location = 0) out vec4 outColor;

float linearZ(float d) { return -screenToView(texcoord, d).z; }

void main() {
    vec3 color = texture(colortex0, texcoord).rgb;
    float depth = texture(depthtex0, texcoord).r;
    vec3 viewPos = screenToView(texcoord, depth);
    vec3 viewDir = normalize(viewPos);
    vec3 dirWorld = mat3(gbufferModelViewInverse) * viewDir;
    float dist = length(viewPos);
    float slot = unpackSlot(texture(colortex1, texcoord).z);
    bool isSky = depth >= 1.0;
    bool isCloud = slot == DATA_CLOUD;

#ifdef DIM_OVERWORLD
    vec3 lightDir = normalize(mat3(gbufferModelViewInverse) * shadowLightPosition);

    if (isEyeInWater == 0) {
        // Haze colour = the sky near the horizon in this direction, so it
        // turns orange toward a setting sun like Vibrant Visuals' fog.
        vec3 hazeDir = normalize(vec3(dirWorld.x, max(dirWorld.y, 0.0) * 0.25 + 0.02, dirWorld.z));
        vec3 hazeCol = getSky(hazeDir, lightDir, atmZenith, atmHorizon, atmGlow, atmParams);

        if (!isSky) {
            float t = vvTime();
            float morning = exp(-pow((t - 0.75) / 0.06, 2.0)) * MORNING_FOG;
            float heightFalloff = exp(-max((mat3(gbufferModelViewInverse) * viewPos).y + cameraPosition.y - 64.0, 0.0) / 80.0);
            float density = (0.0011 + morning * 0.0025 + rainStrength * 0.006) * FOG_DENSITY * mix(1.0, heightFalloff, 0.6);
            float haze = 1.0 - exp(-dist * density);
            if (isCloud) haze *= 0.4;
            color = mix(color, hazeCol, haze);

            // Hide the chunk border (Vibrant Visuals: fog_start 0.92 of render distance)
            if (!isCloud) {
                vec3 playerPos = mat3(gbufferModelViewInverse) * viewPos;
                float border = smoothstep(far * 0.72, far * 0.98, length(playerPos.xz));
                vec3 skyCol = getSky(dirWorld, lightDir, atmZenith, atmHorizon, atmGlow, atmParams);
                color = mix(color, skyCol, border);
            }
        }
    }
#elif defined DIM_NETHER
    if (!isSky) {
        float fog = 1.0 - exp(-dist * 0.012 * FOG_DENSITY);
        fog = max(fog, smoothstep(far * 0.6, far, dist));
        color = mix(color, toLinear(fogColor) * 0.6, fog);
    }
#elif defined DIM_END
    if (!isSky) {
        float fog = 1.0 - exp(-dist * 0.004 * FOG_DENSITY);
        fog = max(fog, smoothstep(far * 0.7, far, dist));
        color = mix(color, vec3(0.03, 0.02, 0.045), fog);
    }
#endif

    // Underwater: like Bedrock, fog toward the water colour over ~60 blocks,
    // with red fading first, and a light blue tint on everything
    if (isEyeInWater == 1) {
        vec3 plains = toLinear(vec3(68.0, 175.0, 245.0) / 255.0);
        vec3 fogCol = underwaterFogColor(plains, atmAmbient, atmLight);
        #ifdef NO_SKY
            fogCol = vec3(0.01, 0.03, 0.05);
        #endif
        vec3 T = exp(-dist * waterAbsorption() * 0.5);
        float fog = 1.0 - exp(-dist / (20.0 * WATER_CLARITY));
        color = mix(color * T * vec3(0.85, 0.96, 1.0), fogCol, fog);
    } else if (isEyeInWater == 2) {
        color = mix(color, vec3(1.0, 0.25, 0.02) * 2.0, 1.0 - exp(-dist * 0.8));
    } else if (isEyeInWater == 3) {
        color = mix(color, vec3(0.6, 0.7, 0.8), 1.0 - exp(-dist * 0.5));
    }

#if defined VOLUMETRIC_LIGHT && defined DIM_OVERWORLD
    // Depth-aware 4x4 blur removes the bayer dither from composite.fsh
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
    float centerZ = -viewPos.z;
    vec3 vl = vec3(0.0);
    float wsum = 0.0;
    for (int y = -2; y < 2; y++) {
        for (int x = -2; x < 2; x++) {
            vec2 uv = texcoord + (vec2(x, y) + 0.5) * px;
            float z = -screenToView(uv, texture(depthtex0, uv).r).z;
            float w = 1.0 / (abs(z - centerZ) / max(centerZ, 1.0) * 8.0 + 0.05);
            vl += texture(colortex2, uv).rgb * w;
            wsum += w;
        }
    }
    color += vl / wsum;
#endif

    // Blindness / darkness effects
    color *= 1.0 - max(blindness, darknessFactor * 0.8) * saturate(dist / 6.0);

    outColor = vec4(color, 1.0);
}
