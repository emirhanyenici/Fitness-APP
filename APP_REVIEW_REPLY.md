# App Review reply: Zenova 1.0 (rejected build 29)

Send this ONLY after the new build is uploaded, tested in TestFlight and
selected for the version in App Store Connect. Every claim below must be true
for that build. Delete a paragraph if it is not.

Rejection being answered: Submission f1453d93-5d1a-461c-8787-fe54fbe81bfc
(review date Oct 07, 2026, iPad Air 11-inch M3, version 1.0 build 29).

## Pre-send checklist

- [ ] Paid Apps Agreement is Active (Business, banks and taxes complete)
- [ ] `zenova_pro_yearly` and `zenova_pro_monthly` are not "Missing Metadata"
- [ ] RevenueCat offering contains both products, iOS key is in the build
- [ ] Built with `eas build -p ios --profile production-release` (FORCE_PRO off)
- [ ] TestFlight: sandbox purchase (yearly and monthly) completes without error
- [ ] TestFlight: "Accept & Enable AI Features" prompt appears before the first
      AI request, and declining sends nothing
- [ ] TestFlight: onboarding BMI screen and Profile both show
      "How BMI is calculated · Sources" and it opens the Sources screen
- [ ] TestFlight: paywall legal text contains no "Google" or "Play Store"
- [ ] Screenshots updated in all sizes (Media Manager, "View All Sizes"):
      iOS only, no Android/Google imagery, main features shown
- [ ] App Privacy labels match reality (user content, health and fitness data
      shared with third parties for app functionality)
- [ ] Privacy Policy (zenovaapp.com/privacy) names xAI AND TypeSafe
- [ ] New build selected on the version page

## Reply text (paste into "Reply to App Review")

Hello,

Thank you for the detailed review. Here is what changed in the new build and
answers to your questions.

**Guideline 2.1: Information Needed (AI features)**

1. Does your app use any third-party service for the AI features?
   Yes. AI Coach, Weekly Report and meal-photo analysis use two third-party
   services. They are called only from our own server-side functions, so no
   API keys are shipped in the app:
   - xAI: generates the coach replies and analyzes meal photos.
   - TypeSafe: runs a safety check on the text of coach messages, coach
     replies and photo results.

2. What personal data does it collect and/or send?
   - The messages the user types to the AI Coach.
   - Meal photos the user chooses to analyze with Snap.
   - Non-identifying profile preferences: goal, diet type, fitness level,
     activity level, gender, workout frequency and environment.
   - Aggregated weekly statistics and recent sleep, mood and energy values
     (Weekly Report and coach context).
   We do not send the user's name, email address or account ID to either
   service.

3. Does your app obtain the user's explicit consent?
   Yes. Before the first AI request, the app shows an "Accept & Enable AI
   Features" prompt that lists exactly the data above and both providers.
   No AI request is sent unless the user accepts. If the user declines, the
   rest of the app remains fully usable (the Weekly Report is shown using
   on-device calculations only).

**Guideline 1.4.1: Safety: Physical Harm (citations)**

Citations are now shown where the health calculation appears. The BMI result
in onboarding and in Profile has a "How BMI is calculated · Sources" link that
opens a Sources screen. That screen also lists linked citations for every
other calculation in the app:
- BMI and categories: CDC / WHO
- Calorie target: Mifflin-St Jeor equation (Am J Clin Nutr, 1990)
- Protein: ISSN Position Stand (2017)
- Carbohydrate and fat: Dietary Guidelines for Americans 2020-2025
- Sleep and activity: CDC guidelines
The Sources screen also contains our health disclaimer. In addition, the AI
coach screens requests and replies for dangerous dieting and medical advice
and responds with a safety message instead.

**Guideline 2.3.10: Accurate Metadata**

We removed all Google Play and Google account references from the app binary,
including the subscription renewal notice, and updated the screenshots so they
show only the iOS experience on supported devices.

**Guideline 2.1(b): App Completeness (In-App Purchase)**

<!-- Include ONLY if all of this is true for the submitted build: -->
The Paid Apps Agreement is active and the in-app purchase products were
reviewed and completed in App Store Connect. We verified the purchase flow
(yearly and monthly) in the sandbox on the submitted build. The paywall also
now shows a loading state and a retry option if products cannot be fetched.

Thank you,
Zenova team

## App Review Notes (separate field on the version page)

AI features: Profile tab, AI Coach (chat), Snap your food (camera in Add Food)
and Weekly Report. On first use each shows the "Accept & Enable AI Features"
prompt. Health sources: Profile, Health Disclaimer, Sources, or the
"How BMI is calculated · Sources" link under the BMI result. Subscriptions are
tested with the sandbox account supplied in the credentials section.
