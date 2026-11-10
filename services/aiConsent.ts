import { Alert } from 'react-native';
import { useAiConsentStore } from '../stores/aiConsentStore';
import { translate } from '../constants/i18n';

/**
 * Resolves true if the user has already consented to AI processing, or
 * explicitly accepts now. Call before ANY request that sends user content
 * (chat text, profile fields, weekly stats, meal photos) to the AI provider.
 */
export function ensureAiConsent(): Promise<boolean> {
  if (useAiConsentStore.getState().accepted) return Promise.resolve(true);
  return new Promise((resolve) => {
    Alert.alert(
      translate('aiConsent.title'),
      translate('aiConsent.body'),
      [
        { text: translate('aiConsent.decline'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: translate('aiConsent.accept'),
          onPress: () => { useAiConsentStore.getState().setAccepted(true); resolve(true); },
        },
      ],
      { cancelable: false },
    );
  });
}
