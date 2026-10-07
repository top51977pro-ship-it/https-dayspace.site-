#!/usr/bin/env python3
"""Generates shaders/lang/en_us.lang and he_il.lang (menu names, tooltips, value labels)."""
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shaders", "lang")

SCREENS = {
    "INFO": ("Lumenfall v1.1", "Lumenfall v1.1"),
    "S_SHADOWS": ("Shadows", "צללים"),
    "S_LIGHTING": ("Lighting", "תאורה"),
    "S_WATER": ("Water", "מים"),
    "S_REFLECTIONS": ("Reflections", "השתקפויות"),
    "S_VOLUMETRICS": ("Volumetrics & Fog", "וולומטריקה וערפל"),
    "S_CLOUDS": ("Clouds", "עננים"),
    "S_SKY": ("Sky", "שמיים"),
    "S_MATERIALS": ("Materials & PBR", "חומרים ו-PBR"),
    "S_BLOOM": ("Bloom & Lens", "Bloom ועדשה"),
    "S_DOF": ("Depth of Field", "עומק שדה (DOF)"),
    "S_MOTION_BLUR": ("Motion Blur", "טשטוש תנועה"),
    "S_TAA": ("Anti-Aliasing", "החלקת קצוות (TAA)"),
    "S_COLOR": ("Colour & Exposure", "צבע וחשיפה"),
    "S_DIMENSIONS": ("Nether & End", "נתר ואנד"),
}

PROFILES = {
    "PERFORMANCE": ("Performance", "ביצועים"),
    "HIGH": ("High", "גבוה"),
    "ULTRA": ("Ultra", "אולטרה"),
    "INSANE": ("INSANE", "מטורף"),
    "CINEMATIC": ("CINEMATIC", "קולנועי"),
}

# name: (en, he, en comment, he comment, {value: (en, he)})
OPTIONS = {
    "LUMENFALL_VERSION": ("Version", "גרסה", "Lumenfall - cinematic deferred shaders for Iris.", "Lumenfall - שיידר קולנועי ל-Iris.", {1: ("1.0", "1.0")}),
    # shadows
    "SHADOWS": ("Shadows", "צללים", "Sun and moon shadows.", "צללי שמש וירח.", {}),
    "shadowMapResolution": ("Shadow Resolution", "רזולוציית צללים", "Shadow map size. Higher = sharper detail, more VRAM.", "גודל מפת הצללים. גבוה יותר = פרטים חדים יותר.", {}),
    "shadowDistance": ("Shadow Distance", "מרחק צללים", "How far shadows are rendered (blocks).", "עד איזה מרחק מוצגים צללים (בלוקים).", {}),
    "sunPathRotation": ("Sun Path Tilt", "הטיית מסלול השמש", "Tilts the sun's path for more dramatic angles.", "מטה את מסלול השמש לזוויות דרמטיות יותר.", {}),
    "SHADOW_FILTER": ("Shadow Filter", "סינון צללים", "PCSS gives physically soft shadows that sharpen near contact.", "PCSS נותן צללים רכים פיזיקלית שמתחדדים ליד המגע.", {0: ("Hard", "קשה"), 1: ("Soft (PCF)", "רך (PCF)"), 2: ("Realistic (PCSS)", "ריאליסטי (PCSS)")}),
    "SHADOW_SAMPLES": ("Shadow Samples", "דגימות צל", "More samples = smoother penumbras.", "יותר דגימות = שולי צל חלקים יותר.", {}),
    "SHADOW_BLOCKER_SAMPLES": ("Penumbra Search Samples", "דגימות חיפוש חוסם", "Accuracy of the PCSS penumbra size.", "דיוק גודל שולי הצל ב-PCSS.", {}),
    "SHADOW_SOFTNESS": ("Shadow Softness", "רכות צללים", "Apparent size of the sun.", "הגודל הנראה של השמש.", {}),
    "COLORED_SHADOWS": ("Coloured Shadows", "צללים צבעוניים", "Stained glass tints light; water absorbs it and makes caustics.", "זכוכית צבעונית צובעת את האור; מים בולעים אותו ויוצרים קוסטיקה.", {}),
    "SCREEN_SPACE_SHADOWS": ("Contact Shadows", "צללי מגע", "Screen-space shadows for tiny details.", "צללים במרחב המסך לפרטים קטנים.", {}),
    "ENTITY_SHADOWS": ("Entity Shadows", "צללי ישויות", "Mobs and players cast shadows.", "יצורים ושחקנים מטילים צל.", {}),
    "SSS_STRENGTH": ("Subsurface Scattering", "פיזור תת-שטחי", "Light glowing through leaves, grass and snow.", "אור שעובר דרך עלים, דשא ושלג.", {}),
    # lighting
    "SUN_INTENSITY": ("Sun Intensity", "עוצמת שמש", "", "", {}),
    "MOON_INTENSITY": ("Moon Intensity", "עוצמת ירח", "", "", {}),
    "AMBIENT_INTENSITY": ("Sky Ambient", "תאורת שמיים", "Indirect light from the sky.", "אור עקיף מהשמיים.", {}),
    "MIN_LIGHT": ("Cave Minimum Light", "אור מינימלי במערות", "How dark completely unlit places get.", "כמה חשוך במקומות ללא אור כלל.", {}),
    "BLOCKLIGHT_INTENSITY": ("Block Light", "אור בלוקים", "Torches, lamps, lava...", "לפידים, מנורות, לבה...", {}),
    "BLOCKLIGHT_TEMP": ("Block Light Temperature", "טמפרטורת אור בלוקים", "Colour temperature in Kelvin (lower = warmer).", "טמפרטורת צבע בקלווין (נמוך = חם יותר).", {}),
    "BLOCKLIGHT_FLICKER": ("Flame Flicker", "הבהוב להבות", "", "", {}),
    "HANDHELD_LIGHT": ("Handheld Light", "אור ביד", "Held torches light the world.", "לפיד ביד מאיר את הסביבה.", {}),
    "EMISSIVE_STRENGTH": ("Emission Strength", "עוצמת זוהר", "Brightness of glowing materials.", "בהירות חומרים זוהרים.", {}),
    "LIGHTNING_FLASH": ("Lightning Flashes", "הבזקי ברק", "", "", {}),
    "AO_ENABLED": ("Ambient Occlusion", "הצללה סביבתית (AO)", "Ground-truth ambient occlusion.", "הצללה סביבתית מדויקת (GTAO).", {}),
    "AO_STRENGTH": ("AO Strength", "עוצמת AO", "", "", {}),
    "AO_SAMPLES": ("AO Samples", "דגימות AO", "", "", {}),
    "AO_RADIUS": ("AO Radius", "רדיוס AO", "In blocks.", "בבלוקים.", {}),
    "VANILLA_AO_STRENGTH": ("Vanilla AO", "AO וניל", "Minecraft's own corner darkening.", "ההחשכה בפינות של מיינקראפט עצמו.", {}),
    # materials
    "PBR_MODE": ("PBR Mode", "מצב PBR", "Internal: smart materials for vanilla textures. LabPBR: needs a PBR resource pack.", "פנימי: חומרים חכמים לטקסטורות וניל. LabPBR: דורש Resource Pack עם PBR.", {0: ("Off", "כבוי"), 1: ("Lumenfall Internal", "פנימי"), 2: ("LabPBR", "LabPBR")}),
    "SPECULAR_HIGHLIGHTS": ("Specular Highlights", "הברקות", "", "", {}),
    "NORMAL_MAPPING": ("Normal Mapping", "Normal Mapping", "", "", {}),
    "NORMAL_STRENGTH": ("Normal Strength", "עוצמת נורמלים", "", "", {}),
    "GENERATED_NORMALS": ("Generated Normals", "נורמלים מחוללים", "Adds surface relief to vanilla textures.", "מוסיף תבליט לטקסטורות וניל.", {}),
    "POM": ("Parallax Occlusion", "פרלקסה (POM)", "Real depth from LabPBR height maps.", "עומק אמיתי ממפות גובה של LabPBR.", {}),
    "POM_DEPTH": ("Parallax Depth", "עומק פרלקסה", "", "", {}),
    "POM_SAMPLES": ("Parallax Samples", "דגימות פרלקסה", "", "", {}),
    "POM_DISTANCE": ("Parallax Distance", "מרחק פרלקסה", "", "", {}),
    "POM_SHADOWS": ("Parallax Self-Shadows", "צללים עצמיים בפרלקסה", "", "", {}),
    "WAVING_PLANTS": ("Waving Plants", "צמחים מתנופפים", "", "", {}),
    "WAVING_STRENGTH": ("Wind Strength", "עוצמת רוח", "", "", {}),
    "WAVING_SPEED": ("Wind Speed", "מהירות רוח", "", "", {}),
    "RAIN_PUDDLES": ("Rain Puddles", "שלוליות גשם", "", "", {}),
    "PUDDLE_AMOUNT": ("Puddle Amount", "כמות שלוליות", "", "", {}),
    # water
    "WATER_WAVE_HEIGHT": ("Wave Height", "גובה גלים", "", "", {}),
    "WATER_WAVE_SPEED": ("Wave Speed", "מהירות גלים", "", "", {}),
    "WATER_WAVE_SCALE": ("Wave Size", "גודל גלים", "", "", {}),
    "WATER_WAVE_OCTAVES": ("Wave Detail", "פירוט גלים", "Number of wave layers.", "מספר שכבות גלים.", {}),
    "WATER_VERTEX_WAVES": ("Moving Water Surface", "משטח מים זז", "", "", {}),
    "WATER_PARALLAX": ("Water Parallax", "פרלקסת מים", "", "", {}),
    "RAIN_RIPPLES": ("Rain Ripples", "אדוות גשם", "", "", {}),
    "WATER_REFRACTION": ("Refraction", "שבירת אור", "", "", {}),
    "WATER_REFRACTION_STRENGTH": ("Refraction Strength", "עוצמת שבירה", "", "", {}),
    "WATER_CAUSTICS": ("Caustics", "קוסטיקה", "Focused light patterns under water.", "דפוסי אור ממוקדים מתחת למים.", {}),
    "WATER_CAUSTICS_STRENGTH": ("Caustics Strength", "עוצמת קוסטיקה", "", "", {}),
    "WATER_FOAM": ("Shore Foam", "קצף חוף", "", "", {}),
    "WATER_FOAM_STRENGTH": ("Foam Strength", "עוצמת קצף", "", "", {}),
    "WATER_FOG_DENSITY": ("Water Murkiness", "עכירות מים", "", "", {}),
    "WATER_BIOME_TINT": ("Biome Water Tint", "גוון מים לפי ביום", "", "", {}),
    "WATER_ABSORB_R": ("Absorption Red", "בליעה - אדום", "", "", {}),
    "WATER_ABSORB_G": ("Absorption Green", "בליעה - ירוק", "", "", {}),
    "WATER_ABSORB_B": ("Absorption Blue", "בליעה - כחול", "", "", {}),
    "UNDERWATER_VL": ("Underwater Light Shafts", "קרני אור מתחת למים", "", "", {}),
    "UNDERWATER_DISTORTION": ("Underwater Distortion", "עיוות מתחת למים", "", "", {}),
    # reflections
    "SSR": ("Screen Space Reflections", "השתקפויות SSR", "", "", {}),
    "SSR_STEPS": ("Reflection Quality", "איכות השתקפויות", "", "", {}),
    "SSR_REFINE_STEPS": ("Reflection Precision", "דיוק השתקפויות", "", "", {}),
    "ROUGH_REFLECTIONS": ("Rough Reflections", "השתקפויות מחוספסות", "Physically blurred reflections on rough surfaces.", "השתקפויות מטושטשות פיזיקלית על משטחים מחוספסים.", {}),
    "PBR_REFLECTIONS": ("Block Reflections", "השתקפויות על בלוקים", "Metals, polished stone, wet ground.", "מתכות, אבן מלוטשת, קרקע רטובה.", {}),
    "SKY_REFLECTIONS": ("Sky Reflections", "השתקפות שמיים", "", "", {}),
    "REFLECTION_CLOUDS": ("Clouds in Reflections", "עננים בהשתקפויות", "", "", {}),
    # volumetrics
    "VOLUMETRIC_LIGHT": ("God Rays", "קרני אלוהים", "Volumetric light through the shadow map.", "אור וולומטרי דרך מפת הצללים.", {}),
    "VL_STEPS": ("God Ray Quality", "איכות קרני אור", "", "", {}),
    "VL_STRENGTH": ("God Ray Strength", "עוצמת קרני אור", "", "", {}),
    "VL_NIGHT_STRENGTH": ("Night Light Shafts", "קרני אור בלילה", "", "", {}),
    "ATMOSPHERE_STEPS": ("Atmosphere Quality", "איכות אטמוספרה", "", "", {}),
    "FOG_DENSITY": ("Fog Density", "צפיפות ערפל", "", "", {}),
    "HEIGHT_FOG": ("Ground Mist", "ערפל קרקע", "", "", {}),
    "HEIGHT_FOG_DENSITY": ("Mist Density", "צפיפות ערפל קרקע", "", "", {}),
    "RAIN_FOG_DENSITY": ("Rain Fog", "ערפל גשם", "", "", {}),
    "CAVE_FOG": ("Cave Air", "אוויר מערות", "", "", {}),
    "BORDER_FOG": ("Border Fog", "ערפל גבול", "Hides the edge of the render distance.", "מסתיר את קצה טווח הרינדור.", {}),
    # clouds
    "VOLUMETRIC_CLOUDS": ("Volumetric Clouds", "עננים וולומטריים", "", "", {}),
    "CLOUD_TEMPORAL": ("Cloud Reconstruction", "שחזור עננים", "Full: every pixel every frame. Temporal: 1/4 per frame, reprojected.", "מלא: כל פיקסל בכל פריים. טמפורלי: רבע בכל פריים.", {1: ("Full", "מלא"), 2: ("Temporal", "טמפורלי")}),
    "CLOUD_STEPS": ("Cloud Quality", "איכות עננים", "", "", {}),
    "CLOUD_LIGHT_STEPS": ("Cloud Lighting Quality", "איכות תאורת עננים", "", "", {}),
    "CLOUD_DETAIL": ("Cloud Detail", "פירוט עננים", "", "", {0: ("Low", "נמוך"), 1: ("Medium", "בינוני"), 2: ("High", "גבוה"), 3: ("Extreme", "קיצוני")}),
    "CLOUD_SHADOWS": ("Cloud Shadows", "צללי עננים", "", "", {}),
    "CLOUD_COVERAGE": ("Coverage", "כיסוי", "", "", {}),
    "CLOUD_DENSITY": ("Density", "צפיפות", "", "", {}),
    "CLOUD_ALTITUDE": ("Altitude", "גובה", "", "", {}),
    "CLOUD_THICKNESS": ("Thickness", "עובי", "", "", {}),
    "CLOUD_SCALE": ("Scale", "קנה מידה", "", "", {}),
    "CLOUD_SPEED": ("Speed", "מהירות", "", "", {}),
    "CIRRUS_CLOUDS": ("Cirrus Layer", "שכבת צירוס", "", "", {}),
    # sky
    "SUN_SIZE": ("Sun Size", "גודל שמש", "", "", {}),
    "MOON_SIZE": ("Moon Size", "גודל ירח", "", "", {}),
    "STARS": ("Stars", "כוכבים", "", "", {}),
    "STAR_AMOUNT": ("Star Amount", "כמות כוכבים", "", "", {}),
    "MILKY_WAY": ("Milky Way", "שביל החלב", "", "", {}),
    "MILKY_WAY_STRENGTH": ("Milky Way Brightness", "בהירות שביל החלב", "", "", {}),
    "SHOOTING_STARS": ("Shooting Stars", "כוכבים נופלים", "", "", {}),
    "AURORA": ("Aurora", "זוהר צפוני", "", "", {0: ("Off", "כבוי"), 1: ("Cold Biomes", "ביומים קרים"), 2: ("Always", "תמיד")}),
    "RAINBOWS": ("Rainbows", "קשתות", "", "", {}),
    # post
    "BLOOM": ("Bloom", "Bloom", "", "", {}),
    "BLOOM_STRENGTH": ("Bloom Strength", "עוצמת Bloom", "", "", {}),
    "BLOOM_RADIUS": ("Bloom Radius", "רדיוס Bloom", "", "", {}),
    "ANAMORPHIC_STREAKS": ("Anamorphic Streaks", "פסים אנמורפיים", "Horizontal lens streaks from bright lights.", "פסי עדשה אופקיים מאורות בהירים.", {}),
    "LENS_FLARE": ("Lens Flare", "השתקפות עדשה", "", "", {}),
    "LENS_FLARE_STRENGTH": ("Lens Flare Strength", "עוצמת השתקפות עדשה", "", "", {}),
    "DOF": ("Depth of Field", "עומק שדה", "", "", {}),
    "DOF_FOCUS_MODE": ("Focus Mode", "מצב פוקוס", "", "", {0: ("Auto (centre)", "אוטומטי (מרכז)"), 1: ("Manual", "ידני")}),
    "DOF_FOCUS_DISTANCE": ("Manual Focus Distance", "מרחק פוקוס ידני", "In blocks.", "בבלוקים.", {}),
    "centerDepthHalflife": ("Focus Speed", "מהירות פוקוס", "Seconds for autofocus to settle (lower = faster).", "זמן ההתייצבות של הפוקוס האוטומטי (נמוך = מהיר).", {}),
    "DOF_INTENSITY": ("Blur Strength (Aperture)", "עוצמת טשטוש (צמצם)", "", "", {}),
    "DOF_MAX_RADIUS": ("Max Blur Radius", "רדיוס טשטוש מקסימלי", "", "", {}),
    "DOF_SAMPLES": ("Bokeh Quality", "איכות בוקה", "", "", {}),
    "DOF_BLADES": ("Aperture Blades", "להבי צמצם", "", "", {0: ("Circle", "עיגול")}),
    "DOF_BOKEH_HIGHLIGHTS": ("Bokeh Highlights", "הדגשות בוקה", "", "", {}),
    "DOF_CHROMATIC": ("Chromatic Bokeh", "בוקה כרומטי", "", "", {}),
    "DOF_NEAR_BLUR": ("Foreground Blur", "טשטוש קדמי", "", "", {}),
    "MOTION_BLUR": ("Motion Blur", "טשטוש תנועה", "Frame-rate independent camera motion blur.", "טשטוש תנועת מצלמה שלא תלוי ב-FPS.", {}),
    "MOTION_BLUR_STRENGTH": ("Motion Blur Strength", "עוצמת טשטוש תנועה", "1.0 = 180 degree shutter at 24 fps.", "1.0 = שאטר 180 מעלות ב-24fps.", {}),
    "MOTION_BLUR_SAMPLES": ("Motion Blur Quality", "איכות טשטוש תנועה", "", "", {}),
    "TAA": ("Temporal Anti-Aliasing", "TAA", "", "", {}),
    "TAA_BLEND": ("TAA Smoothness", "חלקות TAA", "Higher = smoother and more stable, lower = sharper in motion.", "גבוה = חלק ויציב, נמוך = חד יותר בתנועה.", {}),
    "SHARPENING": ("Sharpening", "חידוד", "", "", {}),
    "AUTO_EXPOSURE": ("Auto Exposure", "חשיפה אוטומטית", "", "", {}),
    "EXPOSURE": ("Exposure (EV)", "חשיפה (EV)", "", "", {}),
    "AE_SPEED": ("Eye Adaptation Speed", "מהירות הסתגלות", "", "", {}),
    "TONEMAP": ("Tone Mapper", "מיפוי טונים", "", "", {0: ("Lumenfall Cinematic", "Lumenfall קולנועי"), 1: ("ACES", "ACES"), 2: ("AgX Punchy", "AgX"), 3: ("Reinhard", "Reinhard")}),
    "CONTRAST": ("Contrast", "ניגודיות", "", "", {}),
    "SATURATION": ("Saturation", "רוויה", "", "", {}),
    "VIBRANCE": ("Vibrance", "חיוניות", "", "", {}),
    "WHITE_BALANCE": ("White Balance", "איזון לבן", "Kelvin (lower = cooler image, higher = warmer).", "קלווין (נמוך = קר יותר, גבוה = חם יותר).", {}),
    "SPLIT_TONING": ("Cinematic Split Toning", "גוונון קולנועי", "Cool shadows, warm highlights.", "צללים קרים, אורות חמים.", {}),
    "PURKINJE": ("Night Vision Shift", "ראיית לילה", "Colours fade to blue in darkness, like real eyes.", "צבעים דוהים לכחול בחושך, כמו בעין אמיתית.", {}),
    "VIGNETTE": ("Vignette", "וינייטה", "", "", {}),
    "FILM_GRAIN": ("Film Grain", "גרעיניות פילם", "", "", {}),
    "CHROMATIC_ABERRATION": ("Chromatic Aberration", "סטייה כרומטית", "", "", {}),
    "LETTERBOX": ("Letterbox", "פסים קולנועיים", "Cinematic aspect ratio bars.", "פסים ליחס מסך קולנועי.", {"0.0": ("Off", "כבוי")}),
    # dimensions
    "NETHER_FOG_DENSITY": ("Nether Smoke", "עשן בנתר", "", "", {}),
    "NETHER_HEAT_HAZE": ("Nether Heat Haze", "אוויר חם בנתר", "", "", {}),
    "END_NEBULA": ("End Nebula", "ערפילית באנד", "", "", {}),
    "END_FOG_DENSITY": ("End Dust", "אבק באנד", "", "", {}),
}


def write(lang, idx):
    lines = []
    for k, v in SCREENS.items():
        lines.append(f"screen.{k}={v[idx]}")
    for k, v in PROFILES.items():
        lines.append(f"profile.{k}={v[idx]}")
    for name, (en, he, cen, che, values) in OPTIONS.items():
        lines.append(f"option.{name}={(en, he)[idx]}")
        comment = (cen, che)[idx]
        if comment:
            lines.append(f"option.{name}.comment={comment}")
        for val, labels in values.items():
            lines.append(f"value.{name}.{val}={labels[idx]}")
    with open(os.path.join(OUT, lang), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")


def main():
    os.makedirs(OUT, exist_ok=True)
    write("en_us.lang", 0)
    write("he_il.lang", 1)
    print("wrote", len(OPTIONS), "options")


if __name__ == "__main__":
    main()
