import { useCallback, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { pullUserState } from '../services/sync';
import { syncHealthData } from '../services/healthkit';

/** Keep the spinner visible long enough to read as a deliberate refresh. */
const MIN_SPIN_MS = 600;

/**
 * Shared pull-to-refresh state for data tabs: re-pulls the remote user_state
 * blob (no-op spin when signed out) with a minimum spinner duration.
 */
export function usePullToRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const userId = useAuthStore((s) => s.user?.id);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        userId ? pullUserState(userId) : Promise.resolve(false),
        syncHealthData(), // no-op unless Apple Health is connected (iOS)
        new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  return { refreshing, onRefresh };
}
