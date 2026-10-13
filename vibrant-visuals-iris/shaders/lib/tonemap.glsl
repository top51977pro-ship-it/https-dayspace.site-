// =====================================================================
//  Colour grading and tone mapping.
//  Vibrant Visuals' default color_grading.json:
//    midtones contrast 1.15, saturation 1.05, gamma 2.2,
//    temperature 6500K, tone_mapping operator "generic".
//  "generic" is the Lottes (GDC 2016) parametric curve.
// =====================================================================

vec3 tonemapGeneric(vec3 x) {
    const float a = 1.22;      // contrast
    const float d = 0.955;     // shoulder
    const float hdrMax = 12.0;
    const float midIn  = 0.18;
    const float midOut = 0.24;
    float ad = a * d;
    float hmA  = pow(hdrMax, a);
    float hmAD = pow(hdrMax, ad);
    float miA  = pow(midIn, a);
    float miAD = pow(midIn, ad);
    float b = (-miA + hmA * midOut) / ((hmAD - miAD) * midOut);
    float c = (hmAD * miA - hmA * miAD * midOut) / ((hmAD - miAD) * midOut);
    vec3 z = pow(max(x, 0.0), vec3(a));
    return saturate(z / (pow(z, vec3(d)) * b + c));
}

vec3 colorGrade(vec3 c) {
    // Midtone contrast around 18% grey (in log space)
    c = 0.18 * pow(max(c, 0.0) / 0.18, vec3(CONTRAST));
    // Saturation
    float l = luminance(c);
    c = mix(vec3(l), c, SATURATION);
    // Vibrance: boost low-saturation colours more than saturated ones
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float sat = (mx - mn) / max(mx, 1e-4);
    c = mix(vec3(luminance(c)), c, 1.0 + VIBRANCE * (1.0 - sat));
    return max(c, 0.0);
}
