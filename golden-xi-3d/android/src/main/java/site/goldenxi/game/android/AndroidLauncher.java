package site.goldenxi.game.android;

import android.os.Bundle;

import com.badlogic.gdx.backends.android.AndroidApplication;
import com.badlogic.gdx.backends.android.AndroidApplicationConfiguration;

import site.goldenxi.game.GoldenXiGame;

/** Native entry point: hosts the libGDX (OpenGL ES) Golden XI 3D game. */
public class AndroidLauncher extends AndroidApplication {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        AndroidApplicationConfiguration config = new AndroidApplicationConfiguration();
        config.useImmersiveMode = true;
        config.useAccelerometer = false;
        config.useCompass = false;
        config.useGyroscope = false;
        config.numSamples = 2;                 // light MSAA
        initialize(new GoldenXiGame(), config);
    }
}
