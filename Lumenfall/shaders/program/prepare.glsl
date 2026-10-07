/*
    Lumenfall - prepare: evaluates per-frame light colours once and stores them in colortex9
*/

#include "/lib/common.glsl"

//==================================================================================//
#ifdef VERTEX_SHADER

void main() {
    gl_Position = ftransform();
}

#endif

//==================================================================================//
#ifdef FRAGMENT_SHADER

#include "/lib/util/noise.glsl"
#include "/lib/atmosphere/atmosphere.glsl"
#include "/lib/atmosphere/lightData.glsl"
#include "/lib/atmosphere/dimensions.glsl"

/* RENDERTARGETS: 9 */
layout(location = 0) out vec4 outData;

vec3 skyRadianceSimple(vec3 d) {
    vec3 s = atmosphereScatter(normalize(d), sunDirWorld(), moonDirWorld());
    float l = luminance(s);
    return mix(s, vec3(l) * vec3(0.82, 0.88, 1.0) * 0.55, lf_rain * 0.85);
}

void main() {
    ivec2 px = ivec2(gl_FragCoord.xy);
    if (px.y != 0 || px.x >= LD_COUNT) discard;

    vec4 result = vec4(0.0);

    if (px.x == LD_EXPOSURE) {
        result = readLightData(LD_EXPOSURE);
        if (!(result.r > 0.0 && result.r < 1e4)) result = vec4(1.0, 0.18, 0.0, 0.0);
        outData = result;
        return;
    }

    #if defined NETHER
        vec3 amb = netherAmbient();
        if (px.x == LD_LIGHT)   result = vec4(0.0);
        if (px.x == LD_AMB_TOP) result = vec4(amb, 1.0);
        if (px.x == LD_AMB_BOT) result = vec4(amb * 1.2, 1.0);
        if (px.x == LD_FOG)     result = vec4(netherBiomeColor(), 1.0);
        if (px.x == LD_ZENITH)  result = vec4(netherBiomeColor() * 0.6, 1.0);
    #elif defined END
        if (px.x == LD_LIGHT)   result = vec4(endLightColor(), 0.03);
        if (px.x == LD_AMB_TOP) result = vec4(endAmbient(), 1.0);
        if (px.x == LD_AMB_BOT) result = vec4(endAmbient() * 0.6, 1.0);
        if (px.x == LD_FOG)     result = vec4(vec3(0.05, 0.035, 0.08), 1.0);
        if (px.x == LD_ZENITH)  result = vec4(vec3(0.01, 0.006, 0.02), 1.0);
    #else
        vec3 sunDir = sunDirWorld();
        vec3 moonDir = moonDirWorld();
        vec3 lightDir = lightDirWorld();
        bool isSun = dot(lightDir, sunDir) > 0.0;
        vec3 lightCol = isSun ? directSunColor(sunDir) : directMoonColor(moonDir);
        lightCol *= 1.0 - lf_rain * 0.88;

        if (px.x == LD_LIGHT) {
            result = vec4(lightCol, isSun ? 0.02 : 0.03);
        } else if (px.x == LD_AMB_TOP || px.x == LD_AMB_BOT) {
            // cosine weighted hemisphere average of the sky = irradiance / PI
            vec3 sum = vec3(0.0);
            const int N = 24;
            for (int i = 0; i < N; i++) {
                float r = (float(i) + 0.5) / float(N);
                float phi = float(i) * GOLDEN_ANGLE;
                vec3 d = vec3(sqrt(r) * cos(phi), sqrt(1.0 - r), sqrt(r) * sin(phi));
                d.y = max(d.y, 0.02);
                sum += skyRadianceSimple(d);
            }
            vec3 ambTop = sum / float(N);
            if (px.x == LD_AMB_TOP) {
                result = vec4(ambTop, 1.0);
            } else {
                // ground bounce: sky + direct light reflected by an average ground albedo
                vec3 groundAlbedo = vec3(0.22, 0.24, 0.18);
                vec3 bounce = groundAlbedo * (ambTop + lightCol * max(lightDir.y, 0.0) * INV_PI);
                result = vec4(mix(bounce, ambTop, 0.35), 1.0);
            }
        } else if (px.x == LD_FOG) {
            vec3 sum = vec3(0.0);
            for (int i = 0; i < 8; i++) {
                float a = float(i) / 8.0 * TAU;
                sum += skyRadianceSimple(vec3(cos(a), 0.08, sin(a)));
            }
            result = vec4(sum / 8.0, 1.0);
        } else if (px.x == LD_ZENITH) {
            result = vec4(skyRadianceSimple(vec3(0.0, 1.0, 0.0)), 1.0);
        }
    #endif

    outData = result;
}

#endif
