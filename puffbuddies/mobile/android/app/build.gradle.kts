plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "org.fourtwenty.puffbuddies"
    compileSdk = 35
    defaultConfig {
        applicationId = "org.420integrated.puffbuddies"
        minSdk = 34
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        manifestPlaceholders["puffBuddiesLinkHost"] = providers.gradleProperty("PUFFBUDDIES_LINK_HOST").orNull ?: "invalid.example"
    }
}
