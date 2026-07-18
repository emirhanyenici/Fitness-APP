import { usePostHog } from 'posthog-react-native';
import { useSubscriptionStore } from '../stores/subscriptionStore';

/** Typed event helpers — call these instead of posthog.capture() directly */

export function useAnalytics() {
  const posthog = usePostHog();
  // Attach the subscription plan to every event so conversion funnels can be
  // segmented by tier (free vs pro) in PostHog.
  const plan = useSubscriptionStore((s) => s.plan);
  const capture = (event: string, props: Record<string, unknown> = {}) =>
    posthog?.capture(event, { ...props, plan });

  return {
    /** Called when user completes onboarding */
    onboardingCompleted: (goal: string) =>
      capture('onboarding_completed', { goal }),

    /** Called when user signs up */
    signedUp: (method: 'email' | 'apple') =>
      capture('signed_up', { method }),

    /** Called when user signs in */
    signedIn: (method: 'email' | 'apple') =>
      capture('signed_in', { method }),

    /** Called when workout starts */
    workoutStarted: (bodyPart: string, type: string | null) =>
      capture('workout_started', { body_part: bodyPart, type }),

    /** Called when workout finishes */
    workoutFinished: (completed: number, total: number) =>
      capture('workout_finished', { exercises_completed: completed, exercises_total: total }),

    /** Called when food is logged */
    foodLogged: (mealType: string, calories: number) =>
      capture('food_logged', { meal_type: mealType, calories }),

    /** Called when water intake is updated */
    waterUpdated: (glasses: number) =>
      capture('water_updated', { glasses }),

    /** Called when recovery rating is set */
    recoveryRated: (score: number) =>
      capture('recovery_rated', { score }),

    /** Called when paywall is shown */
    paywallViewed: (source: string) =>
      capture('paywall_viewed', { source }),

    /** Identify user after login */
    identify: (userId: string, email: string) =>
      posthog?.identify(userId, { email }),
  };
}
