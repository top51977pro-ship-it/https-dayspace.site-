// Wind animation for foliage. Works in feet-relative player space.

vec3 windOffset(vec3 worldPos, float amount) {
    float t = frameTimeCounter * WAVING_SPEED;
    float gust = 0.55 + 0.45 * sin(t * 0.35 + worldPos.x * 0.02 + worldPos.z * 0.015);
    gust *= 1.0 + rainStrength * 0.8;
    vec3 o;
    o.x = sin(t * 1.7 + worldPos.x * 0.9 + worldPos.z * 0.35) * 0.65
        + sin(t * 3.1 + worldPos.z * 1.3) * 0.35;
    o.z = sin(t * 1.3 + worldPos.z * 0.8 - worldPos.x * 0.45) * 0.65
        + sin(t * 2.7 + worldPos.x * 1.1) * 0.35;
    o.y = sin(t * 2.0 + worldPos.x + worldPos.z) * 0.15;
    return o * amount * gust * 0.075 * WAVING_AMPLITUDE;
}

// id = mc_Entity block id, isTopVertex = vertex is at the top of its texture
vec3 applyWaving(vec3 playerPos, int id, bool isTopVertex, float skyLight) {
    vec3 worldPos = playerPos + cameraPosition;
    float amount = 0.0;
    #ifdef WAVING_PLANTS
    if ((id == ID_PLANT || id == ID_TALL_LOWER) && isTopVertex) amount = 1.0;
    else if (id == ID_TALL_UPPER) amount = isTopVertex ? 1.6 : 1.0;
    else if (id == ID_VINES) amount = 0.6;
    else if (id == ID_WATER_PLANT && isTopVertex) amount = 0.9;
    #endif
    #ifdef WAVING_LEAVES
    if (id == ID_LEAVES) amount = 0.45;
    #endif
    if (amount <= 0.0) return playerPos;
    amount *= smoothstep(0.2, 0.7, skyLight);
    return playerPos + windOffset(worldPos, amount);
}
