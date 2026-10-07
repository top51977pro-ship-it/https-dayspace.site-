/*
    Lumenfall - coordinate space conversions
*/

vec3 projectAndDivide(mat4 m, vec3 p) {
    vec4 h = m * vec4(p, 1.0);
    return h.xyz / h.w;
}

vec3 screenToView(vec3 screenPos) {
    vec3 ndc = screenPos * 2.0 - 1.0;
    return projectAndDivide(gbufferProjectionInverse, ndc);
}

vec3 viewToScreen(vec3 viewPos) {
    return projectAndDivide(gbufferProjection, viewPos) * 0.5 + 0.5;
}

vec3 viewToPlayer(vec3 viewPos) { return mat3(gbufferModelViewInverse) * viewPos + gbufferModelViewInverse[3].xyz; }
vec3 playerToView(vec3 playerPos) { return mat3(gbufferModelView) * (playerPos - gbufferModelViewInverse[3].xyz); }

float linearizeDepth(float depth) {
    return (near * far) / (depth * (near - far) + far);
}

// Reprojects a player-space position into last frame's screen space
vec3 reprojectPlayer(vec3 playerPos) {
    vec3 prevPlayer = playerPos + cameraPosition - previousCameraPosition;
    vec3 prevView = (gbufferPreviousModelView * vec4(prevPlayer, 1.0)).xyz;
    vec4 prevClip = gbufferPreviousProjection * vec4(prevView, 1.0);
    return prevClip.xyz / prevClip.w * 0.5 + 0.5;
}

// Full reprojection from current screen pos (handles hand & sky specially)
vec3 reproject(vec3 screenPos) {
    if (screenPos.z < HAND_DEPTH) return screenPos; // hand follows the camera
    vec3 viewPos = screenToView(screenPos);
    if (screenPos.z >= 1.0) {
        // sky: rotation only
        vec3 dir = mat3(gbufferModelViewInverse) * viewPos;
        vec3 prevView = mat3(gbufferPreviousModelView) * dir;
        vec4 prevClip = gbufferPreviousProjection * vec4(prevView, 1.0);
        return vec3(prevClip.xy / prevClip.w * 0.5 + 0.5, 1.0);
    }
    return reprojectPlayer(viewToPlayer(viewPos));
}

//----------------------------------------------------------------------------------//
// Shadow space
//----------------------------------------------------------------------------------//
const float SHADOW_DISTORT = 0.88;

float shadowDistortFactor(vec2 p) {
    return length(p) * SHADOW_DISTORT + (1.0 - SHADOW_DISTORT);
}

vec3 distortShadow(vec3 p) {
    p.xy /= shadowDistortFactor(p.xy);
    p.z *= 0.25;
    return p;
}

vec3 playerToShadowClip(vec3 playerPos) {
    vec3 sv = (shadowModelView * vec4(playerPos, 1.0)).xyz;
    return projectAndDivide(shadowProjection, sv);
}
