import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EtaCard } from '../src/components/EtaCard';
import { EtaUpdateBanner } from '../src/components/EtaUpdateBanner';
import { useJourneyStore } from '../src/store/journeyStore';
import { useEtaPoller } from '../src/hooks/useEtaPoller';
import { cancelAlarm } from '../src/services/alarmService';
import { updateJourney } from '../src/services/journeyService';
import { computeAlarmTime } from '../src/utils/alarmUtils';
import { formatTime, formatRelativeTime, timeDiffSeconds } from '../src/utils/dateUtils';
import { colors, spacing, fontSizes, borderRadius } from '../src/constants/theme';

export default function JourneyScreen() {
  const router = useRouter();
  const activeJourney = useJourneyStore((s) => s.activeJourney);
  const currentEta = useJourneyStore((s) => s.currentEta);
  const etaHistory = useJourneyStore((s) => s.etaHistory);
  const activeAlarmId = useJourneyStore((s) => s.activeAlarmId);
  const error = useJourneyStore((s) => s.error);
  const clearJourney = useJourneyStore((s) => s.clearJourney);

  // Polls backend ETA every 5 minutes and reschedules local alarm if ETA shifts > 2 minutes
  const { latestBannerUpdate, dismissBanner, isPolling, pollNow } = useEtaPoller();

  // Live countdown in seconds for "Time remaining"
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const estimatedArrivalIso =
    currentEta?.estimatedArrival ?? activeJourney?.currentEta ?? null;

  const alarmTimeIso = React.useMemo(() => {
    if (currentEta?.alarmTime) return currentEta.alarmTime;
    if (activeJourney?.alarmScheduledAt) return activeJourney.alarmScheduledAt;
    if (estimatedArrivalIso && activeJourney) {
      return computeAlarmTime(
        new Date(estimatedArrivalIso),
        activeJourney.alarmBufferMinutes
      ).toISOString();
    }
    return null;
  }, [currentEta?.alarmTime, activeJourney, estimatedArrivalIso]);

  useEffect(() => {
    if (!estimatedArrivalIso) return;

    const updateCountdown = () => {
      const diff = Math.max(0, timeDiffSeconds(new Date(estimatedArrivalIso), new Date()));
      setRemainingSeconds(diff);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 15000);
    return () => clearInterval(timer);
  }, [estimatedArrivalIso]);

  const performEndJourney = async () => {
    await cancelAlarm(activeAlarmId);
    if (activeJourney) {
      try {
        await updateJourney(activeJourney.id, { status: 'cancelled' });
      } catch {
        // Local cleanup proceeds even if backend is offline
      }
    }
    clearJourney();
    router.replace('/');
  };

  const handleEndJourney = () => {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(
        'End Journey? This will cancel your scheduled wake-up alarm and stop tracking your ETA.'
      );
      if (confirmed) {
        performEndJourney();
      }
      return;
    }

    Alert.alert(
      'End Journey?',
      'This will cancel your scheduled wake-up alarm and stop tracking your ETA.',
      [
        { text: 'Keep Tracking', style: 'cancel' },
        {
          text: 'End Journey',
          style: 'destructive',
          onPress: performEndJourney,
        },
      ]
    );
  };

  if (!activeJourney) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Ionicons name="train-outline" size={56} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Active Journey</Text>
          <Text style={styles.emptySubtitle}>
            Select a destination on the home screen to start tracking your arrival.
          </Text>
          <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.replace('/')}>
            <Text style={styles.backHomeBtnText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshChip}
            onPress={pollNow}
            disabled={isPolling}
          >
            <Ionicons
              name="sync"
              size={16}
              color={isPolling ? colors.textMuted : colors.primary}
            />
            <Text style={styles.refreshChipText}>
              {isPolling ? 'Updating...' : 'Refresh ETA'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Destination Title */}
        <View style={styles.destinationHeader}>
          <Text style={styles.goingToLabel}>Going to</Text>
          <Text style={styles.destinationTitle}>{activeJourney.destination.name}</Text>
          <Text style={styles.destinationSub} numberOfLines={1}>
            {activeJourney.destination.displayName}
          </Text>
        </View>

        {/* Banner when ETA shifts > 2 minutes */}
        <EtaUpdateBanner update={latestBannerUpdate} onDismiss={dismissBanner} />

        {/* Graceful Offline Notice */}
        {error && (
          <View style={styles.offlineNotice}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
            <Text style={styles.offlineNoticeText}>{error}</Text>
          </View>
        )}

        {/* ETA + Wake-up Alarm Card */}
        <EtaCard
          estimatedArrival={estimatedArrivalIso}
          alarmTime={alarmTimeIso}
          remainingSeconds={remainingSeconds}
          bufferMinutes={activeJourney.alarmBufferMinutes}
        />

        {/* ETA Update History */}
        <View style={styles.historySection}>
          <Text style={styles.historyHeader}>ETA Update History</Text>
          {etaHistory.length === 0 ? (
            <Text style={styles.emptyHistoryText}>
              No significant ETA changes yet. Checking every 5 minutes...
            </Text>
          ) : (
            etaHistory.map((item, idx) => (
              <View key={`${item.timestamp}-${idx}`} style={styles.historyItem}>
                <View style={styles.historyBullet} />
                <View style={styles.historyTextWrap}>
                  <Text style={styles.historyLine}>
                    {formatTime(item.newEta)} → alarm at {formatTime(item.newAlarm)}{' '}
                    <Text style={styles.historyRelative}>
                      ({formatRelativeTime(item.timestamp)})
                    </Text>
                  </Text>
                  <Text style={styles.historyPrev}>
                    Previous ETA: {formatTime(item.previousEta)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Simulate Alarm Test Button (Helpful for verifying alarm screen) */}
        <TouchableOpacity
          style={styles.previewAlarmBtn}
          onPress={() => router.push('/alarm')}
        >
          <Ionicons name="notifications-outline" size={18} color={colors.secondary} />
          <Text style={styles.previewAlarmText}>Preview Wake-Up Alarm Screen</Text>
        </TouchableOpacity>

        {/* End Journey Button */}
        <TouchableOpacity
          style={styles.endJourneyBtn}
          onPress={handleEndJourney}
          activeOpacity={0.85}
        >
          <Ionicons name="stop-circle-outline" size={22} color={colors.danger} />
          <Text style={styles.endJourneyText}>End Journey</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  refreshChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  refreshChipText: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  destinationHeader: {
    marginBottom: spacing.lg,
  },
  goingToLabel: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  destinationTitle: {
    color: colors.text,
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    marginTop: 2,
  },
  destinationSub: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginTop: 4,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(237, 137, 54, 0.12)',
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  offlineNoticeText: {
    color: colors.warning,
    fontSize: fontSizes.xs,
    flex: 1,
  },
  historySection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  historyHeader: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emptyHistoryText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs + 2,
  },
  historyBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: spacing.sm,
  },
  historyTextWrap: {
    flex: 1,
  },
  historyLine: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  historyRelative: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  historyPrev: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  previewAlarmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  previewAlarmText: {
    color: colors.secondary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  endJourneyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(252, 129, 129, 0.14)',
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  endJourneyText: {
    color: colors.danger,
    fontSize: fontSizes.md,
    fontWeight: '800',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  backHomeBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backHomeBtnText: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
});
