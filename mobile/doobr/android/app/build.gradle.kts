plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android { namespace = "org.integrated420.doobr"; compileSdk = 35
 defaultConfig { applicationId = "org.integrated420.doobr"; minSdk = 28; targetSdk = 35; versionCode = 1; versionName = "0.1.0" }
 buildTypes { release { isMinifyEnabled = true; isShrinkResources = true; signingConfig = null; proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro") } }
 compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
 kotlinOptions { jvmTarget = "17" }
}
