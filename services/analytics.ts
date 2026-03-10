import { usePostHog } from 'posthog-react-native';

/** Typed event helpers — call these instead of posthog.capture() directly */

export function useAnalytics() {
  const posthog = usePostHog();

  return {
    /** Called when user completes onboarding */
    onboardingCompleted: (goal: string) =>
      posthog?.capture('onboarding_completed', { goal }),

    /** Called when user signs up */
    signedUp: (method: 'email') =>
      posthog?.capture('signed_up', { method }),

    /** Called when user signs in */
    signedIn: (method: 'email') =>
      posthog?.capture('signed_in', { method }),

    /** Called when workout starts */
    workoutStarted: (bodyPart: string, type: string | null) =>
      posthog?.capture('workout_started', { body_part: bodyPart, type }),

    /** Called when workout finishes */
    workoutFinished: (completed: number, total: number) =>
      posthog?.capture('workout_finished', { exercises_completed: completed, exercises_total: total }),

    /** Called when food is logged */
    foodLogged: (mealType: string, calories: number) =>
      posthog?.capture('food_logged', { meal_type: mealType, calories }),

    /** Called when water intake is updated */
    waterUpdated: (glasses: number) =>
      posthog?.capture('water_updated', { glasses }),

    /** Called when recovery rating is set */
    recoveryRated: (score: number) =>
      posthog?.capture('recovery_rated', { score }),

    /** Called when paywall is shown */
    paywallViewed: (source: string) =>
      posthog?.capture('paywall_viewed', { source }),

    /** Identify user after login */
    identify: (userId: string, email: string) =>
      posthog?.identify(userId, { email }),
  };
}
