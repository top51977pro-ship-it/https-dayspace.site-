// 3D Nether portal: a see-through window with glowing streaks stacked at several depths
// behind the surface (parallax), giving the look of a deep, swirling tunnel.
// Samples the portal sprite from gtexture.
//
// uv        - sprite texture coordinate of this fragment
// tileMin   - top-left of the sprite in the atlas, tileSize - its size
// T, B, N   - world space tangent (+u), bitangent (+v) and normal of the portal face
// rd        - world space view ray (camera -> fragment), normalized
// returns premultiplied-ready colour: rgb is divided by alpha so that
//         dst * (1 - a) + rgb * a == dst * (1 - a) + glow + haze
vec4 netherPortal(vec2 uv, vec2 tileMin, vec2 tileSize, vec3 T, vec3 B, vec3 N, vec3 rd, float dither) {
    // lateral shift (in blocks) per block of depth, clamped so steep or close-up views
    // can't smear the layers across the whole portal
    vec2 shift = vec2(dot(rd, T), dot(rd, B)) / max(abs(dot(rd, N)), 0.5);
    shift = clamp(shift, vec2(-1.0), vec2(1.0));

    // many thin layers packed into a shallow depth: every bright swirl pixel becomes a
    // solid glowing dash with a short trail extruded into the portal
    const int layers = 10;
    const float totalDepth = 0.20;

    vec3 glow = vec3(0.0);
    float front = 0.0;
    for (int i = 0; i < layers; i++) {
        float f = (float(i) + dither) / float(layers);
        vec2 coord = uv + shift * tileSize * (f * totalDepth);
        coord = tileMin + mod(coord - tileMin, tileSize);
        vec3 s = textureLod(gtexture, coord, 0.0).rgb;

        // vanilla portal pixels sit between 0.62 and 0.90 in their brightest channel:
        // only the top of that range (the light swirls) becomes a glowing streak
        float b = maxOf(s);
        float streak = smoothstep(0.78, 0.86, b);
        float core = smoothstep(0.84, 0.90, b);

        vec3 col = mix(vec3(0.42, 0.02, 0.85), vec3(0.95, 0.16, 1.00), core);
        float w = 1.0 - f * 0.85;               // trail fades towards the back
        glow = max(glow, col * streak * w);     // max(): overlapping layers never pile up
        if (i == 0) front = streak;
    }
    glow *= 1.15 * PORTAL_BRIGHTNESS;

    // between the streaks the window is clear: the world behind is only slightly dimmed
    float coverage = maxOf(glow) / (1.15 * PORTAL_BRIGHTNESS);
    float alpha = 0.10 + max(front, coverage * 0.8) * 0.75;
    vec3 haze = vec3(0.10, 0.08, 0.16) * 0.10;
    return vec4((glow + haze) / alpha, alpha);
}
