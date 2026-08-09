import { useMemo } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { type Colors, withAlpha } from '../../constants/colors';
import { useColors } from '../../constants/useColors';
import { typography } from '../../constants/typography';
import { spacing, radius } from '../../constants/spacing';
import { getElevation } from '../../constants/elevation';
import { useT } from '../../constants/i18n';
import { Card } from './Card';
import { Button } from './Button';
import { Icon } from './Icon';
import type { AchievementDef } from '../../constants/achievements';

interface AchievementUnlockModalProps {
  achievement: AchievementDef | null;
  onDismiss: () => void;
}

/** Global celebration modal — mounted once in app/_layout.tsx, driven by useAchievementCheck's queue. */
export function AchievementUnlockModal({ achievement, onDismiss }: AchievementUnlockModalProps) {
  const colors = useColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const t = useT();

  return (
    <Modal visible={achievement !== null} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        {achievement && (
          <Card variant="hero" style={styles.card}>
            <Text style={styles.banner}>{t('achievements.unlockedBanner')}</Text>
            <View style={styles.iconCircle}>
              <Icon icon={achievement.icon} size={32} color={colors.accent.primary} />
            </View>
            <Text style={styles.title}>{t(achievement.titleKey)}</Text>
            <Text style={styles.desc}>{t(achievement.descKey)}</Text>
            <Button label={t('achievements.close')} onPress={onDismiss} style={styles.button} />
          </Card>
        )}
      </View>
    </Modal>
  );
}

const getStyles = (colors: Colors) => {
  const elevation = getElevation(colors);
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 340,
      alignItems: 'center',
      gap: spacing.sm,
    },
    banner: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.xs,
      color: colors.accent.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: radius.full,
      backgroundColor: withAlpha(colors.accent.primary, 0.13),
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.sm,
      ...elevation.card,
    },
    title: {
      fontFamily: typography.fonts.display,
      fontSize: typography.sizes.lg,
      color: colors.text.primary,
      textAlign: 'center',
    },
    desc: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    button: {
      marginTop: spacing.base,
      alignSelf: 'stretch',
    },
  });
};
