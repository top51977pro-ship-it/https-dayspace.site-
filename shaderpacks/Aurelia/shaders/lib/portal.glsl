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
    float rdN = max(abs(dot(rd, N)), 0.3);
    // sprite uv shift per block of depth into the portal
    vec2 uvPerDepth = vec2(dot(rd, T), dot(rd, B)) / rdN * tileSize;

    vec3 glow = vec3(0.0);
    float front = 0.0;
    const int layers = 6;
    for (int i = 0; i < layers; i++) {
        float depth = (float(i) + dither * 0.35) * 0.16;
        vec2 coord = uv + uvPerDepth * depth;
        coord = tileMin + mod(coord - tileMin, tileSize);
        vec3 s = textureLod(gtexture, coord, 0.0).rgb;

        // vanilla portal pixels sit between 0.62 and 0.90 in their brightest channel:
        // the top part of that range is the light swirl pattern
        float b = maxOf(s);
        float streak = smoothstep(0.76, 0.86, b);
        float core = smoothstep(0.84, 0.90, b);

        vec3 col = mix(vec3(0.50, 0.06, 1.00), vec3(1.00, 0.22, 0.92), core);
        col += vec3(1.0, 0.6, 1.0) * core * 0.15;
        float w = exp(-float(i) * 0.38);
        glow += col * streak * w;
        if (i == 0) front = streak;
    }
    glow *= 1.25 * PORTAL_BRIGHTNESS;

    // gaps stay clear: the world behind shows through with a violet haze,
    // streaks in the front layer are nearly opaque so their colour stays saturated
    float alpha = 0.28 + front * 0.62;
    vec3 haze = vec3(0.32, 0.06, 0.62) * 0.22;
    return vec4((glow + haze) / alpha, alpha);
}
