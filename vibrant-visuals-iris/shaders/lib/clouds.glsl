// =====================================================================
//  Clouds and sun disc, matched to Vibrant Visuals screenshots:
//   * clouds are bright and pastel (pink-lavender white at noon,
//     peach-orange at sunset), partly see-through on their big faces,
//     with brighter, more solid side edges that read as a glowing rim.
//     Undersides are NOT dark: vanilla's per-face shading is ignored.
//   * clouds near the sun light up with forward-scattered sunlight.
//   * the sun is a large, overexposed cream-white square with a soft
//     circular glow; at sunset it keeps a hint of its yellow ring.
// =====================================================================

// worldNormal: face normal; viewDir / lightDir: world-space, normalized.
// Returns colour (rgb) and opacity (a).
vec4 shadeCloud(vec3 worldNormal, vec3 viewDir, vec3 lightDir, float vanillaAlpha,
                vec3 light, vec3 ambient, vec3 horizon, vec3 glow, float mie) {
    bool side = abs(worldNormal.y) < 0.5;
    float VdotL = dot(viewDir, lightDir);
    float NdotL = dot(worldNormal, lightDir);

    // Sun + sky light, faces barely differ (thin, bright cloud slabs)
    vec3 col = light * (0.6 + 0.1 * NdotL)
             + ambient * 1.7
             + horizon * 0.12;
    // Sunset / sunrise: clouds take on the warm sun colour (peach-orange)
    col += glow * mie * 1.1;
    // Forward scattering: clouds around the sun glow, strongly at sunset
    col += glow * phaseHG(VdotL, 0.65) * (0.45 + mie * 3.0) * 1.5;

    float faceBright = side ? 1.45 : (worldNormal.y > 0.0 ? 1.08 : 1.0);
    col *= faceBright;

    // Big faces are see-through, side edges more solid (the bright rim)
    float alpha = (side ? 0.85 : 0.5) * (CLOUD_OPACITY / 0.65);
    alpha = saturate(alpha) * vanillaAlpha;
    return vec4(col, alpha);
}

// Sun disc colour from the vanilla sun texture (linear rgb of the core).
// sunLight01: 1 at noon, low near sunset.
vec3 sunDiscColor(vec3 texLinear, vec3 sunColor, float sunLight01) {
    // Overexposed toward white at midday, warmer and less blown out at sunset
    vec3 c = mix(texLinear, vec3(luminance(texLinear)), 0.55 * sunLight01);
    c *= mix(sunColor, vec3(1.0), 0.6);
    return c * mix(7.0, 18.0, sunLight01) * SUN_DISC_BRIGHTNESS;
}
