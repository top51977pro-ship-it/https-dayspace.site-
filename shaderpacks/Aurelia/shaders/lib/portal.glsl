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
    shift = clamp(shift, vec2(-1.2), vec2(1.2));

    const float depths[3] = float[3](0.0, 0.10, 0.24);
    const float weights[3] = float[3](1.0, 0.40, 0.18);

    vec3 glow = vec3(0.0);
    float front = 0.0;
    for (int i = 0; i < 3; i++) {
        vec2 coord = uv + shift * tileSize * depths[i];
        coord = tileMin + mod(coord - tileMin, tileSize);
        vec3 s = textureLod(gtexture, coord, 0.0).rgb;

        // vanilla portal pixels sit between 0.62 and 0.90 in their brightest channel:
        // only the top of that range (the light swirls) becomes a glowing streak
        float b = maxOf(s);
        float streak = smoothstep(0.78, 0.87, b);
        float core = smoothstep(0.85, 0.90, b);

        vec3 col = mix(vec3(0.50, 0.06, 1.00), vec3(1.00, 0.22, 0.92), core);
        glow += col * streak * weights[i];
        if (i == 0) front = streak;
    }
    glow *= 1.1 * PORTAL_BRIGHTNESS;

    // the gaps stay clear: the world behind shows through with a violet haze,
    // front streaks are mostly opaque so their colour stays saturated
    float alpha = 0.25 + front * 0.55;
    vec3 haze = vec3(0.32, 0.06, 0.62) * 0.20;
    return vec4((glow + haze) / alpha, alpha);
}
