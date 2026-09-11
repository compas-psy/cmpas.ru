# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class ru.cmpas.app.**$$serializer { *; }
-keepclassmembers class ru.cmpas.app.** {
    *** Companion;
}
-keepclasseswithmembers class ru.cmpas.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Retrofit
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepattributes AnnotationDefault
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Domain models (keep for serialization)
-keep class ru.cmpas.app.domain.model.** { *; }
-keep class ru.cmpas.app.data.api.** { *; }

# Яндекс ID SDK.
#
# Своих правил артефакт не везёт — в authsdk-3.2.1.aar нет ни
# proguard.txt, ни consumer-rules. Релиз собирается с минификацией и
# сокращением ресурсов, то есть отказ проявился бы ТОЛЬКО в релизной
# сборке и только на устройстве: отладочная и юнит-тесты его не увидят.
#
# Держим публичный API и переносимые через Intent классы целиком: обмен с
# активностью SDK идёт через Parcelable, а имена полей CREATOR и extras
# переживать обфускацию обязаны.
-keep class com.yandex.authsdk.** { *; }
-dontwarn com.yandex.authsdk.**

# SDK ВК: те же соображения — рефлексия по мета-данным манифеста и
# сериализация ответов.
-keep class com.vk.id.** { *; }
-dontwarn com.vk.id.**
