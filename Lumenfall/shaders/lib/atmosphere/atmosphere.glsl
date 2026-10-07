/*
    Lumenfall - physically based atmosphere
    Single scattering (Rayleigh + Mie + ozone absorption) integrated along the view ray,
    light transmittance via a Chapman-function approximation (no nested march),
    plus a cheap isotropic multiple-scattering term.
    Units: metres, radiance in arbitrary HDR units (auto exposure normalises).
*/

const float ATM_R_GROUND = 6360e3;
const float ATM_R_TOP    = 6420e3;
const float ATM_HR       = 8000.0;
const float ATM_HM       = 1200.0;
const vec3  ATM_BETA_R   = vec3(5.802e-6, 13.558e-6, 33.1e-6);
const float ATM_BETA_MS  = 3.996e-6;
const float ATM_BETA_ME  = 4.40e-6;
const vec3  ATM_BETA_O   = vec3(0.650e-6, 1.881e-6, 0.085e-6);
const float ATM_MIE_G    = 0.78;

const float SUN_ILLUMINANCE  = 24.0;
const float MOON_ILLUMINANCE = 0.05;

vec2 raySphere(vec3 ro, vec3 rd, float r) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - r * r;
    float d = b * b - c;
    if (d < 0.0) return vec2(-1.0);
    d = sqrt(d);
    return vec2(-b - d, -b + d);
}

float phaseRayleigh(float mu) { return 0.0596831 * (1.0 + mu * mu); }

float phaseHG(float mu, float g) {
    float g2 = g * g;
    return 0.0795775 * (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * mu, 1.5);
}

// Cornette-Shanks Mie phase
float phaseMie(float mu, float g) {
    float g2 = g * g;
    float k = 0.1193662 * (1.0 - g2) / (2.0 + g2);
    return k * (1.0 + mu * mu) / pow(1.0 + g2 - 2.0 * g * mu, 1.5);
}

// Chapman grazing incidence approximation (Schueler). X = R/H, h = altitude/H.
float chapman(float X, float h, float coschi) {
    float c = sqrt(X + h);
    if (coschi >= 0.0) return c / (c * coschi + 1.0) * exp(-h);
    float x0 = sqrt(max(1.0 - coschi * coschi, 0.0)) * (X + h);
    float c0 = sqrt(x0);
    return 2.0 * c0 * exp(min(X - x0, 80.0)) - c / (1.0 - c * coschi) * exp(-h);
}

// Transmittance from a point at radius r along direction with cosine coschi to space
vec3 transmittanceToSpace(float r, float coschi) {
    float h = max(r - ATM_R_GROUND, 0.0);
    float odR = ATM_HR * chapman(ATM_R_GROUND / ATM_HR, h / ATM_HR, coschi);
    float odM = ATM_HM * chapman(ATM_R_GROUND / ATM_HM, h / ATM_HM, coschi);
    float odO = odR * 1.9; // ozone column roughly tracks the rayleigh column
    return exp(-(ATM_BETA_R * odR + ATM_BETA_ME * odM + ATM_BETA_O * odO));
}

float viewerAltitudeM() {
    #ifdef OVERWORLD
        return 120.0 + max(eyeAltitude - 63.0, 0.0) * 2.0;
    #else
        return 120.0;
    #endif
}

vec3 atmosphereOrigin() { return vec3(0.0, ATM_R_GROUND + viewerAltitudeM(), 0.0); }

// Radiance of the direct sun / moon light reaching the viewer altitude
vec3 sunTransmittanceAtViewer(vec3 dir) {
    vec3 ro = atmosphereOrigin();
    return transmittanceToSpace(length(ro), dir.y);
}

float moonPhaseBrightness() {
    // 0 full ... 4 new
    float p = abs(float(moonPhase) - 4.0) / 4.0; // 1 full, 0 new
    return mix(0.12, 1.0, p);
}

/*
    Integrates in-scattered light along rd (world space, y up).
    maxDist limits the ray (metres), transmittance is returned for aerial perspective.
*/
vec3 atmosphereScatter(vec3 rd, vec3 sunDir, vec3 moonDir, float maxDist, out vec3 transmittance) {
    vec3 ro = atmosphereOrigin();
    vec2 tTop = raySphere(ro, rd, ATM_R_TOP);
    vec2 tGround = raySphere(ro, rd, ATM_R_GROUND);
    float tEnd = tTop.y;
    if (tGround.x > 0.0) tEnd = tGround.x;
    tEnd = min(tEnd, maxDist);

    const int steps = ATMOSPHERE_STEPS;
    vec3 inR = vec3(0.0), inM = vec3(0.0), inRm = vec3(0.0), inMm = vec3(0.0), inMS = vec3(0.0);
    vec3 od = vec3(0.0); // rayleigh, mie, ozone optical depth along view

    float muS = dot(rd, sunDir);
    float muM = dot(rd, moonDir);

    float tPrev = 0.0;
    for (int i = 0; i < steps; i++) {
        float f = (float(i) + 1.0) / float(steps);
        float t = tEnd * f * f;
        float ds = t - tPrev;
        float tMid = 0.5 * (t + tPrev);
        tPrev = t;

        vec3 p = ro + rd * tMid;
        float r = length(p);
        float h = r - ATM_R_GROUND;
        float dR = exp(-h / ATM_HR);
        float dM = exp(-h / ATM_HM);
        float dO = max(0.0, 1.0 - abs(h - 25e3) / 15e3);
        od += vec3(dR, dM, dO) * ds;

        vec3 tView = exp(-(ATM_BETA_R * od.x + ATM_BETA_ME * od.y + ATM_BETA_O * od.z));
        vec3 up = p / r;

        vec3 tSun  = transmittanceToSpace(r, dot(up, sunDir));
        vec3 tMoon = transmittanceToSpace(r, dot(up, moonDir));

        inR  += tView * tSun  * dR * ds;
        inM  += tView * tSun  * dM * ds;
        inRm += tView * tMoon * dR * ds;
        inMm += tView * tMoon * dM * ds;

        // multiple scattering approximation: isotropic, light partially diffused
        vec3 diffuseSun = sqrt(tSun) * saturate(dot(up, sunDir) * 4.0 + 0.6);
        inMS += tView * diffuseSun * (ATM_BETA_R * dR + ATM_BETA_MS * dM) * ds;
    }

    transmittance = exp(-(ATM_BETA_R * od.x + ATM_BETA_ME * od.y + ATM_BETA_O * od.z));

    float sunI = SUN_ILLUMINANCE * SUN_INTENSITY;
    float moonI = MOON_ILLUMINANCE * MOON_INTENSITY * moonPhaseBrightness();

    // artistic boost: Minecraft reads better with a brighter sky relative to the sun
    const float SKY_BOOST = 2.0;
    vec3 sun  = sunI  * (ATM_BETA_R * phaseRayleigh(muS) * inR  + ATM_BETA_MS * phaseMie(muS, ATM_MIE_G) * inM) * SKY_BOOST;
    vec3 moon = moonI * (ATM_BETA_R * phaseRayleigh(muM) * inRm + ATM_BETA_MS * phaseMie(muM, ATM_MIE_G) * inMm) * SKY_BOOST;
    vec3 ms   = sunI * inMS * 0.0796 * 0.8 * SKY_BOOST;

    // moonlit sky gets a cooler tint (perceptual, matches purkinje)
    moon *= vec3(0.75, 0.9, 1.25);

    return sun + moon + ms;
}

vec3 atmosphereScatter(vec3 rd, vec3 sunDir, vec3 moonDir) {
    vec3 t;
    return atmosphereScatter(rd, sunDir, moonDir, 1e9, t);
}

// Sunlight & moonlight colour arriving at the viewer (used for direct lighting)
vec3 directSunColor(vec3 sunDir) {
    return SUN_ILLUMINANCE * SUN_INTENSITY * sunTransmittanceAtViewer(sunDir) * smoothstep(-0.02, 0.04, sunDir.y);
}
vec3 directMoonColor(vec3 moonDir) {
    return MOON_ILLUMINANCE * MOON_INTENSITY * moonPhaseBrightness() * vec3(0.72, 0.86, 1.25)
         * sunTransmittanceAtViewer(moonDir) * smoothstep(-0.02, 0.06, moonDir.y);
}
