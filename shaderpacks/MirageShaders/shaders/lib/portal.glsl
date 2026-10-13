// 3D Nether portal: the portal sprite is sampled several times along the view ray inside a
// shallow volume behind the surface and the samples are blended together. Closely spaced samples
// near the front and wider ones at the back give soft, smooth "depth trails" that converge as
// you look into the portal. Only the brightest pixels glow strongly; the rest is a deep,
// semi-transparent violet.
//
// uv        - sprite texture coordinate of this fragment
// tileMin   - top-left of the sprite in the atlas, tileSize - its size
// T, B, N   - world space tangent (+u), bitangent (+v) and normal of the portal face
// rd        - world space view ray (camera -> fragment), normalized
// light     - diffuse light reaching the portal (ambient + block light)
// returns straight (non-premultiplied) colour + alpha for the translucent blend
vec4 netherPortal(vec2 uv, vec2 tileMin, vec2 tileSize, vec3 T, vec3 B, vec3 N, vec3 rd, vec3 light, float dither) {
    // view ray in the portal's own (u, v, depth) space
    vec3 rayT = vec3(dot(rd, T), dot(rd, B), -dot(rd, N));
    const int samples = 8;
    // how far each step moves across the sprite (in sprite units) - deeper samples move more
    vec2 stepUV = rayT.xy * (0.4 / (max(rayT.z, 0.08) * float(samples)));

    vec2 local = (uv - tileMin) / tileSize;
    vec4 sum = vec4(0.0);
    float brightest = 0.0;
    for (int i = 0; i < samples; i++) {
        float depth = (float(i) + dither) / float(samples);
        local += stepUV * depth;                    // accumulating: spacing grows with depth
        vec2 coord = tileMin + fract(local) * tileSize;
        vec4 s = textureLod(gtexture, coord, 0.0);
        s *= pow(1.0 - depth, 0.1);                 // very slight fade towards the back
        brightest = max(brightest, s.r);
        sum += s;
    }
    vec4 col = sum / float(samples);

    // deep violet body: squaring darkens the mid tones and saturates the colour
    col.rgb *= col.rgb * vec3(1.40, 0.85, 0.55);
    col.a = sqrt(max(col.a, 0.0)) * 0.8;

    // only the very brightest swirl pixels glow, everything else stays dim
    float glow = brightest * brightest;
    glow *= glow;
    glow *= glow;                                   // ^8
    glow = clamp(glow * 120.0, 0.03, 1.2);

    // undo the brighter exposure of the Nether / End so the portal looks the same everywhere
    #if defined NETHER
    const float exposureComp = 1.0 / 1.2;
    #elif defined END
    const float exposureComp = 1.0 / 1.3;
    #else
    const float exposureComp = 1.0;
    #endif

    vec3 color = col.rgb * (light + glow * 5.5 * PORTAL_BRIGHTNESS * exposureComp);
    return vec4(color, col.a);
}
