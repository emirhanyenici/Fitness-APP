const mockSetItem = jest.fn().mockResolvedValue(undefined);
const mockReloadWidgets = jest.fn().mockResolvedValue(undefined);

// jest-expo defaults to the iOS platform, so services/widgetBridge.ts's
// Platform.OS === 'ios' guard passes and these lazy-required natives get hit.
jest.mock('react-native-shared-group-preferences', () => ({
  __esModule: true,
  default: { setItem: mockSetItem },
}));
jest.mock('widget-bridge', () => ({ reloadWidgets: mockReloadWidgets }));

import { publishScoreToWidget } from '../services/widgetBridge';

describe('publishScoreToWidget', () => {
  beforeEach(() => {
    mockSetItem.mockClear();
    mockReloadWidgets.mockClear();
  });

  it('writes the rounded score and color into the shared App Group, then reloads widgets', async () => {
    await publishScoreToWidget(71.6, '#059669');

    expect(mockSetItem).toHaveBeenCalledWith('zenova_widget_score', 72, 'group.com.zenova.lifescore');
    expect(mockSetItem).toHaveBeenCalledWith('zenova_widget_color', '#059669', 'group.com.zenova.lifescore');
    expect(mockSetItem).toHaveBeenCalledWith('zenova_widget_updatedAt', expect.any(String), 'group.com.zenova.lifescore');
    expect(mockReloadWidgets).toHaveBeenCalledTimes(1);
  });

  it('swallows native errors instead of throwing', async () => {
    mockSetItem.mockRejectedValueOnce(new Error('no app group'));
    await expect(publishScoreToWidget(50, '#0D9488')).resolves.toBeUndefined();
  });
});
