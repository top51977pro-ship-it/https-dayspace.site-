// Tonemapping and colour grading.

// Lottes 2016 "Advanced Techniques and Optimization of HDR Color Pipelines"
vec3 tonemapLottes(vec3 x) {
    const float a = 1.45;      // contrast
    const float d = 0.977;     // shoulder
    const float hdrMax = 10.0;
    const float midIn = 0.20;
    const float midOut = 0.24;

    float b = (-pow(midIn, a) + pow(hdrMax, a) * midOut) /
              ((pow(hdrMax, a * d) - pow(midIn, a * d)) * midOut);
    float c = (pow(hdrMax, a * d) * pow(midIn, a) - pow(hdrMax, a) * pow(midIn, a * d) * midOut) /
              ((pow(hdrMax, a * d) - pow(midIn, a * d)) * midOut);

    x = max(x, vec3(0.0));
    return pow(x, vec3(a)) / (pow(x, vec3(a * d)) * b + c);
}

vec3 colorGrade(vec3 c) {
    float l = luminance(c);
    // saturation
    c = mix(vec3(l), c, SATURATION);
    // vibrance: boost low-saturation colours more than already saturated ones
    float sat = maxOf(c) - min(c.r, min(c.g, c.b));
    c = mix(vec3(l), c, 1.0 + (VIBRANCE - 1.0) * (1.0 - sat));
    // contrast around mid grey (in display space)
    c = (c - 0.5) * CONTRAST + 0.5;
    return saturate(c);
}
