import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTime, formatDuration } from '../utils/dateUtils';
import { colors, spacing, fontSizes, borderRadius } from '../constants/theme';

interface EtaCardProps {
  estimatedArrival: string | null;
  alarmTime: string | null;
  remainingSeconds: number;
  bufferMinutes: number;
}

export const EtaCard: React.FC<EtaCardProps> = ({
  estimatedArrival,
  alarmTime,
  remainingSeconds,
  bufferMinutes,
}) => {
  return (
    <View style={styles.wrapper}>
      {/* Expected Arrival Box */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Expected arrival</Text>
        <View style={styles.box}>
          <Ionicons name="flag-outline" size={24} color={colors.primary} />
          <Text style={styles.timeValue}>{formatTime(estimatedArrival)}</Text>
        </View>
      </View>

      {/* Wake-up Alarm Box */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.sectionLabel}>Wake-up alarm</Text>
          <Text style={styles.bufferTag}>{bufferMinutes} min before arrival</Text>
        </View>
        <View style={[styles.box, styles.alarmBox]}>
          <Ionicons name="alarm-outline" size={26} color={colors.secondary} />
          <Text style={[styles.timeValue, styles.alarmValue]}>{formatTime(alarmTime)}</Text>
        </View>
      </View>

      {/* Time Remaining & Status */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricCaption}>Time remaining</Text>
          <Text style={styles.metricValue}>{formatDuration(remainingSeconds)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricCaption}>Journey status</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>On the way</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  bufferTag: {
    color: colors.secondary,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  alarmBox: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.primary,
  },
  timeValue: {
    color: colors.text,
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  alarmValue: {
    color: colors.secondary,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  metricCaption: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginBottom: 4,
  },
  metricValue: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  statusText: {
    color: colors.success,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
});
