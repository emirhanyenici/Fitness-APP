@echo off
set "ANDROID_HOME=C:\Users\pc\AppData\Local\Android\Sdk"
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"
cd /d "c:\Users\pc\Desktop\Fitness App\aura-health"
npx expo start --clear
