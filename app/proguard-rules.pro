# Keep kotlinx.serialization generated serializers for the app's models.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**

-keepclassmembers class site.dayspace.pulsecountdown.data.model.** {
    *** Companion;
}
-keepclasseswithmembers class site.dayspace.pulsecountdown.data.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}
