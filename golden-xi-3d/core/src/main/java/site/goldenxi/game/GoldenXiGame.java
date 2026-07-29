package site.goldenxi.game;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.PerspectiveCamera;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.VertexAttributes.Usage;
import com.badlogic.gdx.graphics.g2d.BitmapFont;
import com.badlogic.gdx.graphics.g2d.GlyphLayout;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.g3d.Environment;
import com.badlogic.gdx.graphics.g3d.Material;
import com.badlogic.gdx.graphics.g3d.Model;
import com.badlogic.gdx.graphics.g3d.ModelBatch;
import com.badlogic.gdx.graphics.g3d.ModelInstance;
import com.badlogic.gdx.graphics.g3d.attributes.ColorAttribute;
import com.badlogic.gdx.graphics.g3d.attributes.TextureAttribute;
import com.badlogic.gdx.graphics.g3d.environment.DirectionalLight;
import com.badlogic.gdx.graphics.g3d.utils.ModelBuilder;
import com.badlogic.gdx.graphics.glutils.ShapeRenderer;
import com.badlogic.gdx.math.MathUtils;
import com.badlogic.gdx.math.Vector3;

/**
 * Golden XI 3D — a native OpenGL (libGDX) football match.
 * Real 3D pitch, procedurally-generated unique players (all fictional),
 * a follow camera, on-screen joystick + action buttons. Foundation build.
 */
public class GoldenXiGame extends ApplicationAdapter {

    // ---- pitch dimensions (metres) ----
    static final float L = 105f, W = 68f, GOALW = 12f, HALFG = GOALW / 2f;
    static final float MATCH_SECS = 180f;

    // ---- 3D ----
    PerspectiveCamera cam;
    ModelBatch modelBatch;
    Environment env;
    Model boxModel, sphereModel, groundModel;
    ModelInstance box, sphere, ground;
    Texture pitchTex;

    // ---- 2D HUD ----
    SpriteBatch batch;
    ShapeRenderer shapes;
    BitmapFont font;
    GlyphLayout layout;

    // ---- match ----
    P[] players;
    Ball ball;
    int[] score = new int[2];
    float clock = MATCH_SECS;
    int active = 10;
    float restartLock = 0f, aiDecideCd = 0f, toastT = 0f;
    String toast = "";
    float camX, camZ;

    // difficulty (fixed for v1; selector comes next)
    float diff = 0.55f;

    // ---- input ----
    float moveX, moveZ, moveMag;
    boolean passDown, shootDown, sprintDown, throughDown;
    boolean lastPass, lastShoot, lastThrough;

    // formation: x 0..1 own->opp goal line, z 0..1 across
    static final float[][] FORM = {
        {0.05f,0.50f,0}, {0.20f,0.16f,1},{0.16f,0.38f,1},{0.16f,0.62f,1},{0.20f,0.84f,1},
        {0.44f,0.30f,2},{0.42f,0.50f,2},{0.44f,0.70f,2},
        {0.74f,0.16f,3},{0.82f,0.50f,3},{0.74f,0.84f,3}
    };
    static final Color[] SKINS = {
        c(0xf1c9a5), c(0xe0a878), c(0xc98a56), c(0xa9683b), c(0x8a4e2a), c(0x6d3b1f) };
    static final Color[] HAIRS = {
        c(0x140f0a), c(0x2e2013), c(0x0d0d10), c(0x5a3a1e), c(0xc9a24a), c(0x7a4a28) };
    static final Color HOME_KIT = c(0xF5C518), AWAY_KIT = c(0x2b3a67);
    static final Color HOME_GK = c(0x1f8a4c), AWAY_GK = c(0xe08a1e);
    static final Color SHORTS_D = c(0x14181c);

    static Color c(int hex){ return new Color(((hex>>16)&255)/255f, ((hex>>8)&255)/255f, (hex&255)/255f, 1f); }

    static class Ball { float x,z,vx,vz; int owner=-1; float kickCd, lastAct; }
    static class P {
        int team, role, num; boolean gk;
        float x,z,vx,vz,dir, fx,fz, height, tackleCd, gait;
        Color kit, skin, hair;
    }

    @Override public void create() {
        modelBatch = new ModelBatch();
        batch = new SpriteBatch();
        shapes = new ShapeRenderer();
        font = new BitmapFont();
        font.getData().setScale(1.4f);
        layout = new GlyphLayout();

        cam = new PerspectiveCamera(52f, Gdx.graphics.getWidth(), Gdx.graphics.getHeight());
        cam.near = 0.5f; cam.far = 500f;

        env = new Environment();
        env.set(new ColorAttribute(ColorAttribute.AmbientLight, 0.65f, 0.68f, 0.65f, 1f));
        env.add(new DirectionalLight().set(0.9f, 0.9f, 0.85f, -0.4f, -0.9f, -0.35f));
        env.add(new DirectionalLight().set(0.35f, 0.35f, 0.4f, 0.5f, -0.6f, 0.4f));

        ModelBuilder mb = new ModelBuilder();
        boxModel = mb.createBox(1f, 1f, 1f,
            new Material(ColorAttribute.createDiffuse(Color.WHITE)),
            Usage.Position | Usage.Normal);
        sphereModel = mb.createSphere(1f, 1f, 1f, 12, 12,
            new Material(ColorAttribute.createDiffuse(Color.WHITE)),
            Usage.Position | Usage.Normal);
        box = new ModelInstance(boxModel);
        sphere = new ModelInstance(sphereModel);

        pitchTex = makePitchTexture();
        groundModel = mb.createBox(L, 0.4f, W,
            new Material(TextureAttribute.createDiffuse(pitchTex)),
            Usage.Position | Usage.Normal | Usage.TextureCoordinates);
        ground = new ModelInstance(groundModel);
        ground.transform.setToTranslation(L/2f, -0.2f, W/2f);

        setupMatch();

        Gdx.gl.glEnable(GL20.GL_BLEND);
        Gdx.gl.glBlendFunc(GL20.GL_SRC_ALPHA, GL20.GL_ONE_MINUS_SRC_ALPHA);
    }

    Texture makePitchTexture() {
        int tw = 1024, th = 680;
        Pixmap p = new Pixmap(tw, th, Pixmap.Format.RGBA8888);
        // stripes
        int bands = 12;
        for (int i = 0; i < bands; i++) {
            p.setColor(i % 2 == 0 ? c(0x2f7a3d) : c(0x347f42));
            p.fillRectangle(i * tw / bands, 0, tw / bands + 1, th);
        }
        p.setColor(Color.WHITE);
        int lw = 4;
        rect(p, 20, 20, tw - 40, th - 40, lw);                 // outline
        p.fillRectangle(tw/2 - lw/2, 20, lw, th - 40);          // halfway
        circle(p, tw/2, th/2, 92, lw);                          // centre circle
        p.fillCircle(tw/2, th/2, 5);
        // penalty boxes
        int boxH = (int)(th * 0.58f), boxW = (int)(tw * 0.16f), boxY = th/2 - boxH/2;
        rect(p, 20, boxY, boxW, boxH, lw);
        rect(p, tw - 20 - boxW, boxY, boxW, boxH, lw);
        int sixH = (int)(th * 0.30f), sixW = (int)(tw * 0.07f), sixY = th/2 - sixH/2;
        rect(p, 20, sixY, sixW, sixH, lw);
        rect(p, tw - 20 - sixW, sixY, sixW, sixH, lw);
        Texture t = new Texture(p);
        t.setFilter(Texture.TextureFilter.Linear, Texture.TextureFilter.Linear);
        p.dispose();
        return t;
    }
    static void rect(Pixmap p, int x, int y, int w, int h, int t) {
        p.fillRectangle(x, y, w, t); p.fillRectangle(x, y + h - t, w, t);
        p.fillRectangle(x, y, t, h); p.fillRectangle(x + w - t, y, t, h);
    }
    static void circle(Pixmap p, int cx, int cy, int r, int t) {
        for (int i = 0; i < 360; i += 2) {
            float a = i * MathUtils.degreesToRadians;
            p.fillCircle(cx + (int)(Math.cos(a)*r), cy + (int)(Math.sin(a)*r), t/2 + 1);
        }
    }

    void setupMatch() {
        players = new P[22];
        for (int t = 0; t < 2; t++)
            for (int i = 0; i < 11; i++) {
                P p = new P();
                p.team = t; p.role = (int)FORM[i][2]; p.gk = p.role == 0; p.num = i == 0 ? 1 : i + 1;
                float[] home = formationWorld(t, i);
                p.x = p.fx = home[0]; p.z = p.fz = home[1];
                p.dir = t == 0 ? 0f : MathUtils.PI;
                p.height = 0.9f + ((i * 37 + t * 13) % 22) / 100f;   // 0.90..1.11 unique
                p.skin = SKINS[(t*7 + i) % SKINS.length];
                p.hair = HAIRS[(t*5 + i*3) % HAIRS.length];
                p.kit = p.gk ? (t==0?HOME_GK:AWAY_GK) : (t==0?HOME_KIT:AWAY_KIT);
                players[t*11 + i] = p;
            }
        ball = new Ball();
        kickoff(0);
        clock = MATCH_SECS; score[0] = score[1] = 0;
        camX = L/2f; camZ = W/2f;
    }

    float[] formationWorld(int team, int i) {
        boolean right = team == 0;
        float fx = FORM[i][0], fz = FORM[i][1];
        float nx = right ? fx : (1 - fx);
        float nz = right ? fz : (1 - fz);
        return new float[]{ nx * L, nz * W };
    }

    void kickoff(int who) {
        for (int t = 0; t < 2; t++)
            for (int i = 0; i < 11; i++) {
                P p = players[t*11 + i];
                float[] h = formationWorld(t, i);
                p.x = h[0]; p.z = h[1]; p.vx = p.vz = 0;
            }
        ball.x = L/2f; ball.z = W/2f; ball.vx = ball.vz = 0;
        P taker = players[who*11 + 9];
        taker.x = L/2f - (who == 0 ? 1.2f : -1.2f); taker.z = W/2f;
        ball.owner = who*11 + 9;
        active = who == 0 ? who*11 + 9 : nearestHome();
        restartLock = 0.6f;
    }

    int goalX(int team){ return team == 0 ? (int)L : 0; }
    int possTeam(){ return ball.owner >= 0 ? players[ball.owner].team : -1; }
    P owner(){ return ball.owner >= 0 ? players[ball.owner] : null; }

    int nearestHome() {
        int best = 10; float bd = 1e9f;
        for (int i = 0; i < 22; i++) { P p = players[i];
            if (p.team != 0 || p.gk) continue;
            float d = dist(p.x, p.z, ball.x, ball.z); if (d < bd) { bd = d; best = i; } }
        return best;
    }
    static float dist(float ax, float az, float bx, float bz){ return (float)Math.hypot(ax-bx, az-bz); }

    // ------------------------------------------------------------------ loop
    @Override public void render() {
        float dt = Math.min(Gdx.graphics.getDeltaTime(), 0.05f);
        readInput();
        if (ball.owner != -2) stepSim(dt);
        if (toastT > 0) toastT -= dt;

        updateCamera(dt);

        Gdx.gl.glViewport(0, 0, Gdx.graphics.getWidth(), Gdx.graphics.getHeight());
        Gdx.gl.glClearColor(0.05f, 0.07f, 0.09f, 1f);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT | GL20.GL_DEPTH_BUFFER_BIT);
        Gdx.gl.glEnable(GL20.GL_DEPTH_TEST);

        modelBatch.begin(cam);
        modelBatch.render(ground, env);
        drawGoals();
        for (P p : players) drawPlayer(p);
        drawBall();
        modelBatch.end();

        drawHud();
    }

    void updateCamera(float dt) {
        float tx = MathUtils.clamp(ball.x, 24, L - 24);
        float tz = MathUtils.clamp(ball.z, 20, W - 20);
        camX += (tx - camX) * Math.min(1f, dt * 3f);
        camZ += (tz - camZ) * Math.min(1f, dt * 3f);
        cam.position.set(camX, 30f, camZ + 34f);
        cam.lookAt(camX, 0f, camZ - 2f);
        cam.up.set(0, 1, 0);
        cam.update();
    }

    // ------------------------------------------------------------------ 3D draw
    void part(ModelInstance inst, float x, float y, float z,
              float sx, float sy, float sz, float rotY, Color col) {
        inst.transform.setToTranslation(x, y, z);
        if (rotY != 0) inst.transform.rotate(Vector3.Y, rotY);
        inst.transform.scale(sx, sy, sz);
        inst.materials.get(0).set(ColorAttribute.createDiffuse(col));
        modelBatch.render(inst, env);
    }

    void drawPlayer(P p) {
        float h = p.height;
        float deg = p.dir * MathUtils.radiansToDegrees;
        float swing = MathUtils.sin(p.gait) * 0.25f;
        Color shorts = p.gk ? c(0x161616) : SHORTS_D;
        // legs
        part(box, p.x + off(p.dir, 0.16f, true) , 0.35f*h, p.z + off(p.dir, 0.16f, false),
             0.18f, 0.7f*h, 0.18f, deg, shorts);
        part(box, p.x - off(p.dir, 0.16f, true), 0.35f*h, p.z - off(p.dir, 0.16f, false),
             0.18f, 0.7f*h, 0.18f, deg, shorts);
        // torso
        part(box, p.x, 0.95f*h, p.z, 0.72f, 0.95f*h, 0.38f, deg, p.kit);
        // arms
        part(box, p.x + off(p.dir, 0.5f, true), 0.95f*h, p.z + off(p.dir, 0.5f, false),
             0.16f, 0.7f*h, 0.16f, deg, p.skin);
        part(box, p.x - off(p.dir, 0.5f, true), 0.95f*h, p.z - off(p.dir, 0.5f, false),
             0.16f, 0.7f*h, 0.16f, deg, p.skin);
        // head + hair
        part(sphere, p.x, 1.62f*h, p.z, 0.44f, 0.46f, 0.44f, deg, p.skin);
        part(sphere, p.x, 1.72f*h, p.z, 0.46f, 0.30f, 0.46f, deg, p.hair);
        // active marker
        if (p.team == 0 && (p == players[active])) {
            part(sphere, p.x, 2.3f*h, p.z, 0.35f, 0.35f, 0.35f, 0, c(0x2fe0d6));
        }
        p.gait += (Math.abs(p.vx) + Math.abs(p.vz)) * 0.05f + 0.001f;
    }
    // offset perpendicular/forward relative to facing for limb placement
    float off(float dir, float amt, boolean xAxis) {
        // perpendicular vector to facing, so left/right limbs sit beside the body
        return xAxis ? MathUtils.cos(dir + MathUtils.PI/2f) * amt
                     : MathUtils.sin(dir + MathUtils.PI/2f) * amt;
    }

    void drawBall() {
        part(sphere, ball.x, 0.24f, ball.z, 0.42f, 0.42f, 0.42f, 0, Color.WHITE);
    }

    void drawGoals() {
        for (int end = 0; end < 2; end++) {
            float gx = end == 0 ? 0.4f : L - 0.4f;
            Color w = Color.WHITE;
            part(box, gx, 1.2f, W/2f - HALFG, 0.3f, 2.4f, 0.3f, 0, w);   // post
            part(box, gx, 1.2f, W/2f + HALFG, 0.3f, 2.4f, 0.3f, 0, w);   // post
            part(box, gx, 2.4f, W/2f, 0.3f, 0.3f, GOALW, 0, w);          // crossbar
        }
    }

    // ------------------------------------------------------------------ HUD
    void drawHud() {
        Gdx.gl.glDisable(GL20.GL_DEPTH_TEST);
        int sw = Gdx.graphics.getWidth(), sh = Gdx.graphics.getHeight();
        float joyCx = sw * 0.16f, joyCy = sh * 0.26f, joyR = sw * 0.075f;
        float bR = sw * 0.052f;
        float shootX = sw * 0.90f, shootY = sh * 0.34f;
        float passX  = sw * 0.80f, passY  = sh * 0.20f;

        shapes.begin(ShapeRenderer.ShapeType.Filled);
        // joystick
        shapes.setColor(1,1,1,0.10f); shapes.circle(joyCx, joyCy, joyR);
        shapes.setColor(1,1,1,0.85f); shapes.circle(joyCx + moveX*joyR*0.6f, joyCy - moveZ*joyR*0.6f, joyR*0.4f);
        // buttons (semi-transparent)
        shapes.setColor(0.89f,0.34f,0.18f,0.55f); shapes.circle(shootX, shootY, bR);
        shapes.setColor(0.18f,0.5f,0.93f,0.55f);  shapes.circle(passX, passY, bR);
        shapes.end();

        batch.begin();
        String sc = "GXI  " + score[0] + " - " + score[1] + "  KES";
        font.setColor(Color.WHITE); font.draw(batch, sc, 24, sh - 20);
        int t = (int)Math.ceil(Math.max(0, clock));
        font.draw(batch, String.format("%02d:%02d", t/60, t%60), 24, sh - 56);
        font.getData().setScale(1.0f);
        font.draw(batch, "SHOOT", shootX - bR*0.7f, shootY + 8);
        font.draw(batch, "PASS", passX - bR*0.55f, passY + 8);
        if (toastT > 0) {
            font.getData().setScale(2.4f);
            layout.setText(font, toast);
            font.draw(batch, toast, (sw - layout.width)/2f, sh*0.7f);
        }
        font.getData().setScale(1.4f);
        batch.end();
    }

    void readInput() {
        moveX = moveZ = 0; moveMag = 0;
        boolean pass = false, shoot = false;
        int sw = Gdx.graphics.getWidth(), sh = Gdx.graphics.getHeight();
        float joyCx = sw * 0.16f, joyCy = sh * 0.74f;       // screen coords (y-down)
        float shootX = sw * 0.90f, shootY = sh * 0.66f, bR = sw * 0.06f;
        float passX  = sw * 0.80f, passY  = sh * 0.80f;
        for (int i = 0; i < 4; i++) {
            if (!Gdx.input.isTouched(i)) continue;
            float tx = Gdx.input.getX(i), ty = Gdx.input.getY(i);
            if (tx < sw * 0.5f) {
                float dx = tx - joyCx, dy = ty - joyCy, m = (float)Math.hypot(dx, dy);
                if (m > 6) { moveX = dx / m; moveZ = dy / m; moveMag = Math.min(1f, m / (sw*0.09f)); }
            } else {
                if (Math.hypot(tx - shootX, ty - shootY) < bR) shoot = true;
                if (Math.hypot(tx - passX,  ty - passY)  < bR) pass = true;
            }
        }
        passDown = pass && !lastPass;   lastPass = pass;
        shootDown = shoot && !lastShoot; lastShoot = shoot;
    }

    // ------------------------------------------------------------------ sim
    float acc = 0f;
    void stepSim(float dt) {
        if (restartLock > 0) restartLock -= dt;
        ball.kickCd = Math.max(0, ball.kickCd - dt);
        if (possTeam() == 0) active = ball.owner;

        for (P p : players) {
            p.tackleCd = Math.max(0, p.tackleCd - dt);
            float tgx, tgz; boolean sprint = false;
            if (p == players[active] && p.team == 0 && restartLock <= 0) {
                if (moveMag > 0.12f) { tgx = p.x + moveX*10; tgz = p.z + moveZ*10; sprint = sprintDown; }
                else { tgx = p.x; tgz = p.z; }
            } else if (p.gk) {
                float[] g = gkTarget(p); tgx = g[0]; tgz = g[1];
            } else {
                float[] a = aiTarget(p); tgx = a[0]; tgz = a[1]; sprint = a[2] > 0.5f;
            }
            float ddx = tgx - p.x, ddz = tgz - p.z, m = (float)Math.hypot(ddx, ddz);
            float spd = p.gk ? 6.4f : (sprint ? 10.4f : 7.2f);
            if (p.team == 1) spd *= (0.9f + 0.2f*diff);
            float vx = m < 0.5f ? 0 : ddx/m*spd, vz = m < 0.5f ? 0 : ddz/m*spd;
            p.vx += MathUtils.clamp(vx - p.vx, -42*dt, 42*dt);
            p.vz += MathUtils.clamp(vz - p.vz, -42*dt, 42*dt);
            p.x = MathUtils.clamp(p.x + p.vx*dt, 0.5f, L-0.5f);
            p.z = MathUtils.clamp(p.z + p.vz*dt, 0.5f, W-0.5f);
            if (Math.hypot(p.vx, p.vz) > 0.4f) p.dir = MathUtils.atan2(p.vz, p.vx);
        }
        humanActions();
        aiActions(dt);
        tackling(dt);
        updateBall(dt);
        // clock
        if (restartLock <= 0 && ball.owner != -2) {
            clock -= dt; if (clock <= 0) { clock = MATCH_SECS; score[0]=score[1]=0; }  // loop match for v1
        }
    }

    float[] gkTarget(P p) {
        int own = goalX(1 - p.team);
        float line = own == 0 ? 2.2f : L - 2.2f;
        float tz = MathUtils.clamp(ball.z, W/2f - HALFG - 2, W/2f + HALFG + 2);
        return new float[]{ line, tz };
    }

    float[] aiTarget(P p) {
        P own = owner();
        boolean right = p.team == 0;
        float dir = right ? 1 : -1;
        if (own == p) {
            float gx = goalX(p.team), gz = W/2f;
            float dx = gx - p.x, dz = gz - p.z, m = (float)Math.hypot(dx, dz);
            return new float[]{ p.x + dx/m*8, p.z + dz/m*8, Math.abs(gx-p.x) > 12 ? 1 : 0 };
        }
        int pt = possTeam();
        if (pt == 1 - p.team) {
            // defend: two nearest press the ball
            if (isPresser(p)) return new float[]{ ball.x, ball.z, 1 };
            float[] h = formationWorld(p.team, p.num == 1 ? 0 : p.num - 1);
            return new float[]{ h[0], h[1], 0 };
        }
        if (pt == p.team) {
            float[] h = formationWorld(p.team, p.num == 1 ? 0 : p.num - 1);
            if (p.role == 3) h[0] += dir * 8;
            return new float[]{ h[0], h[1], p.role == 3 ? 1 : 0 };
        }
        // loose ball
        if (isNearestToBall(p)) return new float[]{ ball.x, ball.z, 1 };
        float[] h = formationWorld(p.team, p.num == 1 ? 0 : p.num - 1);
        return new float[]{ h[0], h[1], 0 };
    }

    boolean isNearestToBall(P p) {
        float bd = dist(p.x, p.z, ball.x, ball.z);
        for (P q : players) if (q.team == p.team && !q.gk && q != p)
            if (dist(q.x, q.z, ball.x, ball.z) < bd) return false;
        return true;
    }
    boolean isPresser(P p) {
        if (p.gk) return false;
        int closer = 0; float md = dist(p.x, p.z, ball.x, ball.z);
        for (P q : players) if (q.team == p.team && !q.gk && q != p)
            if (dist(q.x, q.z, ball.x, ball.z) < md) closer++;
        return closer < 2;   // two nearest press
    }

    void humanActions() {
        P o = owner();
        if (o == null || o.team != 0 || o != players[active]) return;
        if (shootDown) doShoot(o, 0.8f);
        else if (passDown) doPass(o, bestMate(o), false);
    }

    void aiActions(float dt) {
        P o = owner();
        if (o == null) return;
        if (o.team == 0 && o == players[active]) return;
        aiDecideCd -= dt;
        if (aiDecideCd > 0) return;
        aiDecideCd = 0.25f - 0.15f*diff;
        float gx = goalX(o.team), gz = W/2f, dg = Math.abs(gx - o.x);
        P near = nearestOpp(o); boolean pressured = near != null && dist(near.x,near.z,o.x,o.z) < 3f;
        float since = 0f; // simple
        if (dg < 22 && Math.abs(o.z - gz) < 18 && (dg < 12 || MathUtils.random() < 0.4f)) { doShoot(o, 0.7f); return; }
        if (pressured || MathUtils.random() < 0.2f) { P m = bestMate(o); if (m != null) doPass(o, m, false); }
    }

    P nearestOpp(P p) {
        P best = null; float bd = 1e9f;
        for (P q : players) { if (q.team == p.team || q.gk) continue;
            float d = dist(q.x,q.z,p.x,p.z); if (d < bd) { bd = d; best = q; } }
        return best;
    }
    P bestMate(P o) {
        float gx = goalX(o.team); P best = null; float bs = -1e9f;
        for (P q : players) { if (q.team != o.team || q == o || q.gk) continue;
            float d = dist(q.x,q.z,o.x,o.z); if (d < 4 || d > 42) continue;
            float fwd = (gx - q.x) * (o.team == 0 ? 1 : -1);
            float s = fwd - Math.abs(q.z - o.z)*0.1f;
            if (s > bs) { bs = s; best = q; } }
        return best;
    }

    void doPass(P from, P to, boolean thr) {
        if (from == null || to == null) return;
        float dx = to.x - from.x, dz = to.z - from.z, m = (float)Math.hypot(dx, dz);
        float sp = MathUtils.clamp(12 + m*0.55f, 12, 30);
        fire(from, dx/m, dz/m, sp);
    }
    void doShoot(P from, float power) {
        float gx = goalX(from.team), gz = W/2f + (moveMag>0.2f? moveZ*HALFG*0.8f : MathUtils.random(-2f,2f));
        gz = MathUtils.clamp(gz, W/2f - HALFG + 0.6f, W/2f + HALFG - 0.6f);
        float dx = gx - from.x, dz = gz - from.z, m = (float)Math.hypot(dx, dz);
        fire(from, dx/m, dz/m, 22 + power*22);
    }
    void fire(P from, float dx, float dz, float sp) {
        ball.owner = -1; ball.x = from.x + dx*1.1f; ball.z = from.z + dz*1.1f;
        ball.vx = dx*sp; ball.vz = dz*sp; ball.kickCd = 0.28f; from.tackleCd = 0.15f;
    }

    void tackling(float dt) {
        P o = owner();
        if (o == null || ball.kickCd > 0) return;
        for (P p : players) {
            if (p.team == o.team || p.tackleCd > 0) continue;
            if (dist(p.x,p.z,o.x,o.z) >= 1.5f) continue;
            float rate = p.team == 0 ? 3.6f*(1-0.6f*diff) + (p==players[active]?1.8f:0)
                                     : 1.4f + 3.0f*diff;
            if (MathUtils.random() < rate*dt) {
                ball.owner = indexOf(p); ball.kickCd = 0.3f; p.tackleCd = 0.3f; o.tackleCd = 0.5f;
                if (p.team == 0) active = indexOf(p);
            }
        }
    }
    int indexOf(P p){ for (int i=0;i<22;i++) if (players[i]==p) return i; return -1; }

    void updateBall(float dt) {
        P o = owner();
        if (o != null) {
            float lead = 1.1f;
            ball.x += ((o.x + MathUtils.cos(o.dir)*lead) - ball.x) * 0.5f;
            ball.z += ((o.z + MathUtils.sin(o.dir)*lead) - ball.z) * 0.5f;
            ball.vx = o.vx; ball.vz = o.vz;
            return;
        }
        float fr = (float)Math.pow(0.62f, dt);
        ball.vx *= fr; ball.vz *= fr;
        ball.x += ball.vx*dt; ball.z += ball.vz*dt;
        // GK catch
        for (P p : players) if (p.gk && dist(p.x,p.z,ball.x,ball.z) < 1.8f && Math.hypot(ball.vx,ball.vz) < 28) {
            ball.owner = indexOf(p); ball.vx = ball.vz = 0; ball.kickCd = 0.28f; return; }
        if (ball.kickCd <= 0) {
            for (P p : players) if (dist(p.x,p.z,ball.x,ball.z) < 1.5f) {
                ball.owner = indexOf(p); ball.vx = ball.vz = 0; break; }
        }
        bounds();
    }

    void bounds() {
        if (ball.x < 0 || ball.x > L) {
            boolean inMouth = Math.abs(ball.z - W/2f) < HALFG;
            boolean left = ball.x < 0;
            if (inMouth) { int scorer = left ? 1 : 0; score[scorer]++; showToast(scorer==0?"GOAL!":"CONCEDED");
                ball.owner = -2; ball.vx = ball.vz = 0;
                final int concede = 1 - scorer;
                com.badlogic.gdx.utils.Timer.schedule(new com.badlogic.gdx.utils.Timer.Task(){
                    public void run(){ kickoff(concede); }
                }, 0.9f);
                return; }
            // goal kick to defending gk
            int defTeam = left ? 0 : 1;
            for (P p : players) if (p.gk && p.team == defTeam) { ball.owner = indexOf(p); break; }
            ball.vx = ball.vz = 0; ball.x = MathUtils.clamp(ball.x, 0.5f, L-0.5f); return;
        }
        if (ball.z < 0 || ball.z > W) {
            ball.z = MathUtils.clamp(ball.z, 0.6f, W-0.6f); ball.vz = 0; ball.vx *= 0.2f;
            P best = null; float bd = 1e9f;
            for (P p : players) { if (p.gk) continue; float d = dist(p.x,p.z,ball.x,ball.z);
                if (d < bd) { bd = d; best = p; } }
            if (best != null) { ball.owner = indexOf(best); ball.vx = ball.vz = 0; ball.kickCd = 0.28f; }
        }
    }

    void showToast(String s){ toast = s; toastT = 1.2f; }

    @Override public void resize(int w, int h) {
        cam.viewportWidth = w; cam.viewportHeight = h; cam.update();
    }

    @Override public void dispose() {
        modelBatch.dispose(); batch.dispose(); shapes.dispose(); font.dispose();
        boxModel.dispose(); sphereModel.dispose(); groundModel.dispose(); pitchTex.dispose();
    }
}
