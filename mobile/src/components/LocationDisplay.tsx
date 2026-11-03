import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSizes, borderRadius } from '../constants/theme';

interface LocationDisplayProps {
  cityName: string | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const LocationDisplay: React.FC<LocationDisplayProps> = ({
  cityName,
  isLoading,
  error,
  onRefresh,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftRow}>
        <View style={styles.iconBadge}>
          <Ionicons name="location" size={18} color={colors.secondary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.caption}>Current location</Text>
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Detecting GPS...</Text>
            </View>
          ) : error ? (
            <Text style={styles.errorText} numberOfLines={1}>
              {error}
            </Text>
          ) : (
            <Text style={styles.cityText}>{cityName || 'Unknown Location'}</Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        onPress={onRefresh}
        disabled={isLoading}
        style={styles.refreshBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="refresh"
          size={18}
          color={isLoading ? colors.textMuted : colors.primary}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 101, 132, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textWrap: {
    flex: 1,
  },
  caption: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
  },
  cityText: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '700',
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: spacing.xs,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  refreshBtn: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
});
