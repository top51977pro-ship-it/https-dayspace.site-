/*
    Lumenfall - BRDF
*/

vec3 fresnelSchlick(float cosTheta, vec3 f0) {
    return f0 + (1.0 - f0) * pow5(1.0 - saturate(cosTheta));
}

vec3 fresnelSchlickRoughness(float cosTheta, vec3 f0, float roughness) {
    return f0 + (max(vec3(1.0 - roughness), f0) - f0) * pow5(1.0 - saturate(cosTheta));
}

// Exact dielectric fresnel (unpolarised)
float fresnelDielectric(float cosI, float eta) {
    float sinT2 = eta * eta * (1.0 - cosI * cosI);
    if (sinT2 > 1.0) return 1.0;
    float cosT = sqrt(1.0 - sinT2);
    float rs = (eta * cosI - cosT) / (eta * cosI + cosT);
    float rp = (cosI - eta * cosT) / (cosI + eta * cosT);
    return 0.5 * (rs * rs + rp * rp);
}

float distributionGGX(float NdotH, float alpha) {
    float a2 = alpha * alpha;
    float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
    return a2 / (PI * d * d);
}

float visibilitySmithGGX(float NdotV, float NdotL, float alpha) {
    float a2 = alpha * alpha;
    float gv = NdotL * sqrt(NdotV * NdotV * (1.0 - a2) + a2);
    float gl = NdotV * sqrt(NdotL * NdotL * (1.0 - a2) + a2);
    return 0.5 / max(gv + gl, 1e-5);
}

// Specular for a light with a small angular radius (sphere-light widening)
vec3 specularGGX(vec3 n, vec3 v, vec3 l, float roughness, vec3 f0, float lightRadius) {
    vec3 h = normalize(v + l);
    float NdotL = saturate(dot(n, l));
    float NdotV = saturate(dot(n, v)) + 1e-4;
    float NdotH = saturate(dot(n, h));
    float VdotH = saturate(dot(v, h));
    float alpha = max(roughness * roughness, 0.0016);
    float alphaWide = saturate(alpha + lightRadius * 0.5);
    float D = distributionGGX(NdotH, alphaWide) * sqr(alpha / alphaWide);
    float V = visibilitySmithGGX(NdotV, NdotL, alpha);
    vec3 F = fresnelSchlick(VdotH, f0);
    return D * V * F * NdotL;
}

// Burley-ish diffuse with retro-reflection, normalised so a flat white surface ~= lambert
float diffuseBurley(float NdotL, float NdotV, float LdotH, float roughness) {
    float fd90 = 0.5 + 2.0 * roughness * LdotH * LdotH;
    float l = 1.0 + (fd90 - 1.0) * pow5(1.0 - NdotL);
    float v = 1.0 + (fd90 - 1.0) * pow5(1.0 - NdotV);
    return l * v * NdotL * INV_PI;
}

// GGX importance sample (visible normals not needed for our use); returns half vector in tangent space
vec3 sampleGGX(vec2 xi, float alpha) {
    float phi = TAU * xi.x;
    float cosTheta = sqrt((1.0 - xi.y) / (1.0 + (alpha * alpha - 1.0) * xi.y));
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    return vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
}

mat3 tbnFromNormal(vec3 n) {
    vec3 up = abs(n.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 t = normalize(cross(up, n));
    vec3 b = cross(n, t);
    return mat3(t, b, n);
}

// Approximate environment BRDF (Karis)
vec3 envBRDFApprox(vec3 f0, float NdotV, float roughness) {
    const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
    const vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
    vec4 r = roughness * c0 + c1;
    float a004 = min(r.x * r.x, exp2(-9.28 * NdotV)) * r.x + r.y;
    vec2 ab = vec2(-1.04, 1.04) * a004 + r.zw;
    return f0 * ab.x + ab.y;
}

// Colour of a black body (approximation, Kelvin -> linear RGB, normalised)
vec3 blackbody(float t) {
    t = clamp(t, 1000.0, 15000.0) / 100.0;
    vec3 c;
    c.r = t <= 66.0 ? 1.0 : saturate(1.29293618606 * pow(t - 60.0, -0.1332047592));
    c.g = t <= 66.0 ? saturate(0.39008157876 * log(t) - 0.63184144378) : saturate(1.12989086089 * pow(t - 60.0, -0.0755148492));
    c.b = t >= 66.0 ? 1.0 : (t <= 19.0 ? 0.0 : saturate(0.54320678911 * log(t - 10.0) - 1.19625408914));
    return srgbToLinear(c);
}

// Multi-bounce approximation (Jimenez): brighter albedo recovers occluded light
vec3 aoMultiBounce(float ao, vec3 albedo) {
    vec3 a = 2.0404 * albedo - 0.3324;
    vec3 b = -4.7951 * albedo + 0.6417;
    vec3 c = 2.7552 * albedo + 0.6903;
    return max(vec3(ao), ((ao * a + b) * ao + c) * ao);
}
