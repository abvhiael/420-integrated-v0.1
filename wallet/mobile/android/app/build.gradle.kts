plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "io.fourtwenty.wallet"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.fourtwenty.wallet"
        minSdk = 28
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-w11"

        val walletLinkHost = providers.gradleProperty("walletLinkHost").orElse("wallet.invalid").get()
        manifestPlaceholders["walletLinkHost"] = walletLinkHost
        buildConfigField("String", "WALLET_LINK_HOST", "\"$walletLinkHost\"")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.10.0")
    implementation("androidx.fragment:fragment-ktx:1.8.5")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.credentials:credentials:1.5.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.5.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.google.firebase:firebase-messaging:24.1.0")
    testImplementation("junit:junit:4.13.2")
}
