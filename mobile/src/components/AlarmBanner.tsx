import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTime } from '../utils/dateUtils';
import { colors, spacing, fontSizes, borderRadius } from '../constants/theme';

interface AlarmBannerProps {
  destinationName: string;
  expectedArrival: string | null;
  onDismiss: () => void;
}

export const AlarmBanner: React.FC<AlarmBannerProps> = ({
  destinationName,
  expectedArrival,
  onDismiss,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.bellCircle}>
        <Ionicons name="notifications" size={56} color={colors.text} />
      </View>

      <Text style={styles.heading}>🔔 You&apos;re arriving soon!</Text>

      <View style={styles.card}>
        <Text style={styles.destination}>{destinationName}</Text>
        <Text style={styles.etaLabel}>
          Expected arrival: <Text style={styles.etaTime}>{formatTime(expectedArrival)}</Text>
        </Text>
      </View>

      <Text style={styles.wakeMessage}>Wake-up time reached.</Text>
      <Text style={styles.subMessage}>Get ready for your stop!</Text>

      <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} activeOpacity={0.85}>
        <Ionicons name="checkmark-done-circle-outline" size={24} color={colors.text} />
        <Text style={styles.dismissButtonText}>Dismiss Alarm</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  bellCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.alarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    shadowColor: colors.alarm,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  heading: {
    color: colors.text,
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.alarm,
    marginBottom: spacing.xl,
  },
  destination: {
    color: colors.text,
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  etaLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.lg,
  },
  etaTime: {
    color: colors.secondary,
    fontWeight: '700',
  },
  wakeMessage: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subMessage: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    marginBottom: spacing.xxl,
  },
  dismissButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: colors.alarm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  dismissButtonText: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '800',
  },
});
