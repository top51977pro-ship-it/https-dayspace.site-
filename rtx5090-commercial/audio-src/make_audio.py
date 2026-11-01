"""Builds the original sound-design stems for the RTX 5090 film (deterministic, seeded).
- bed.wav: low room-tone ambience (filtered brown noise) whose level follows the story,
  plus a soft sub swell (55 Hz + 82.4 Hz, no attack) that resolves the ending.
- whoosh variants: pitch-shifted takes of the bundled Pixabay whoosh so repeated cuts never
  use the identical sound.
Run: python3 audio-src/make_audio.py  (needs numpy + ffmpeg)
"""
import numpy as np, subprocess, wave, os
SR = 48000; DUR = 25.0
N = int(SR * DUR); t = np.arange(N) / SR
rng = np.random.default_rng(5090)

def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):  # small, fine for 25 s
        acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y

def env(keys):
    ks = np.array(keys, dtype=float)
    return np.interp(t, ks[:, 0], ks[:, 1])

def smooth(e, ms=60):
    k = int(SR * ms / 1000); ker = np.ones(k) / k
    return np.convolve(e, ker, mode="same")

# brown-ish noise, two decorrelated channels
L = np.cumsum(rng.standard_normal(N)); R = np.cumsum(rng.standard_normal(N))
L -= onepole_lp(L, 8); R -= onepole_lp(R, 8)          # remove drift (high-pass ~8 Hz)
L = onepole_lp(onepole_lp(L, 260), 260); R = onepole_lp(onepole_lp(R, 260), 260)
L /= np.max(np.abs(L)); R /= np.max(np.abs(R))
noise_env = smooth(env([[0, 0], [0.4, 0], [3.5, 0.30], [8.8, 0.42], [9.0, 0.30], [14.0, 0.36],
                        [16.9, 0.55], [17.3, 0.34], [21.0, 0.30], [24.9, 0.0], [25, 0]]), 120)
sub_env = smooth(env([[0, 0], [16.6, 0], [17.0, 0.0], [19.0, 0.16], [21.5, 0.22], [24.9, 0.0], [25, 0]]), 200)
pre_env = smooth(env([[0, 0], [4.2, 0], [6.5, 0.06], [9.0, 0.0], [25, 0]]), 200)
sub = (np.sin(2 * np.pi * 55.0 * t) + 0.55 * np.sin(2 * np.pi * 82.41 * t + 0.6)) / 1.55
pre = np.sin(2 * np.pi * 41.2 * t)
outL = L * noise_env + sub * sub_env + pre * pre_env
outR = R * noise_env + sub * sub_env * 0.97 + pre * pre_env
peak = max(np.max(np.abs(outL)), np.max(np.abs(outR)))
outL *= 0.7 / peak; outR *= 0.7 / peak
os.makedirs("assets/audio", exist_ok=True)
with wave.open("assets/audio/bed.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.stack([outL, outR], 1) * 32767).astype("<i2").tobytes())

def ff(args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"] + args, check=True)
src = "assets/audio/whoosh-short.mp3"
ff(["-i", src, "-af", "asetrate=44100*0.84,aresample=48000,lowpass=f=6000", "assets/audio/whoosh-low.wav"])
ff(["-i", src, "-af", "asetrate=44100*1.12,aresample=48000,highpass=f=180", "assets/audio/whoosh-high.wav"])
ff(["-i", src, "-af", "asetrate=44100*0.72,aresample=48000,lowpass=f=3500", "assets/audio/whoosh-deep.wav"])
# metallic shimmer for the green light pass: the sparkle, high-passed and softened
ff(["-i", "audio-src/sparkle.mp3", "-af", "highpass=f=2600,lowpass=f=11000,afade=t=in:d=0.25,volume=0.8", "assets/audio/shimmer.wav"])
# encode the bed for the project (the wav is an intermediate)
ff(["-i", "assets/audio/bed.wav", "-c:a", "libmp3lame", "-b:a", "224k", "assets/audio/bed.mp3"])
os.remove("assets/audio/bed.wav")
print("ok")
