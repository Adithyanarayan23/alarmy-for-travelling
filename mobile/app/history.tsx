import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getJourneys } from '../src/services/journeyService';
import { useJourneyStore } from '../src/store/journeyStore';
import { Journey } from '../src/types';
import { formatDateTime } from '../src/utils/dateUtils';
import { colors, spacing, fontSizes, borderRadius } from '../src/constants/theme';

export default function HistoryScreen() {
  const router = useRouter();
  const activeJourney = useJourneyStore((s) => s.activeJourney);

  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const list = await getJourneys();
      setJourneys(list);
    } catch (err) {
      // If backend is unreachable, still show active local journey if present
      if (activeJourney) {
        setJourneys([activeJourney]);
      }
      setError(err instanceof Error ? err.message : 'Unable to load journey history.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeJourney]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const getStatusBadgeStyle = (status: Journey['status']) => {
    switch (status) {
      case 'completed':
        return { bg: 'rgba(72, 187, 120, 0.15)', text: colors.success, label: 'Completed' };
      case 'active':
        return { bg: 'rgba(108, 99, 255, 0.2)', text: colors.primary, label: 'Active' };
      case 'cancelled':
      default:
        return { bg: 'rgba(252, 129, 129, 0.15)', text: colors.danger, label: 'Cancelled' };
    }
  };

  const renderItem = ({ item }: { item: Journey }) => {
    const badge = getStatusBadgeStyle(item.status);

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.destRow}>
            <Ionicons name="location" size={20} color={colors.primary} />
            <Text style={styles.destName}>{item.destination.name}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.displayName} numberOfLines={1}>
          {item.destination.displayName}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Started: {formatDateTime(item.createdAt)}</Text>
          <Text style={styles.metaText}>Buffer: {item.alarmBufferMinutes}m</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Journey History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={journeys}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchHistory(true)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="map-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Past Journeys</Text>
              <Text style={styles.emptySub}>
                Your completed and active trips will appear here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 36,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(237, 137, 54, 0.14)',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  errorText: {
    color: colors.warning,
    fontSize: fontSizes.xs,
    flex: 1,
  },
  listContent: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  destName: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  displayName: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
