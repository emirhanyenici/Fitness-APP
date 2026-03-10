@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=C:\Users\pc\AppData\Local\Android\Sdk"
echo y | "%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="%ANDROID_HOME%" "platform-tools" "platforms;android-35" "build-tools;35.0.0"
echo.
echo Done!
pause
