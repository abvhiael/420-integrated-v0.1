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
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        val walletLinkHost = providers.gradleProperty("walletLinkHost").orElse("wallet.invalid").get()
        manifestPlaceholders["walletLinkHost"] = walletLinkHost
        buildConfigField("String", "WALLET_LINK_HOST", "\"$walletLinkHost\"")
    }

    val releaseKeystorePath = providers.environmentVariable("WALLET420_ANDROID_KEYSTORE_PATH").orNull
    val releaseKeystorePassword = providers.environmentVariable("WALLET420_ANDROID_KEYSTORE_PASSWORD").orNull
    val releaseKeyAlias = providers.environmentVariable("WALLET420_ANDROID_KEY_ALIAS").orNull
    val releaseKeyPassword = providers.environmentVariable("WALLET420_ANDROID_KEY_PASSWORD").orNull
    val releaseSigningValues = listOf(
        releaseKeystorePath,
        releaseKeystorePassword,
        releaseKeyAlias,
        releaseKeyPassword,
    )
    val releaseSigningRequested = releaseSigningValues.any { !it.isNullOrBlank() }
    val releaseSigningComplete = releaseSigningValues.all { !it.isNullOrBlank() }

    if (releaseSigningRequested && !releaseSigningComplete) {
        throw GradleException("authorized Android release signing requires all WALLET420_ANDROID_* signing environment variables")
    }

    signingConfigs {
        if (releaseSigningComplete) {
            create("authorizedRelease") {
                storeFile = file(releaseKeystorePath!!)
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.findByName("authorizedRelease")
        }
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
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
