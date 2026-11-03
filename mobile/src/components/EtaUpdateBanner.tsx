import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EtaUpdate } from '../types';
import { formatTime } from '../utils/dateUtils';
import { colors, spacing, fontSizes, borderRadius } from '../constants/theme';

interface EtaUpdateBannerProps {
  update: EtaUpdate | null;
  onDismiss: () => void;
}

export const EtaUpdateBanner: React.FC<EtaUpdateBannerProps> = ({ update, onDismiss }) => {
  if (!update) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.iconContainer}>
        <Ionicons name="sync-circle" size={24} color={colors.warning} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>
          ETA changed: {formatTime(update.previousEta)} → {formatTime(update.newEta)}
        </Text>
        <Text style={styles.subtitle}>
          Alarm automatically rescheduled to {formatTime(update.newAlarm)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(237, 137, 54, 0.15)',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  content: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.warning,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});
