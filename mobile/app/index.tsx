import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DestinationSearch } from '../src/components/DestinationSearch';
import { LocationDisplay } from '../src/components/LocationDisplay';
import { AiInput } from '../src/components/AiInput';
import { LoadingOverlay } from '../src/components/LoadingOverlay';
import { useLocation } from '../src/hooks/useLocation';
import { useJourneyStore } from '../src/store/journeyStore';
import { useAuthStore } from '../src/store/authStore';
import { createJourney, getJourneyEta } from '../src/services/journeyService';
import { searchDestinations } from '../src/services/destinationService';
import { parseJourneyText } from '../src/services/aiService';
import { scheduleAlarm } from '../src/services/alarmService';
import { getCurrentLocation } from '../src/services/locationService';
import { computeAlarmTime } from '../src/utils/alarmUtils';
import { Destination } from '../src/types';
import { colors, spacing, fontSizes, borderRadius } from '../src/constants/theme';

const BUFFER_OPTIONS = [15, 30, 45, 60];

export default function HomeScreen() {
  const router = useRouter();
  const { coords, cityName, isLoading: isLocating, error: locationError, refreshLocation } =
    useLocation();

  const activeJourney = useJourneyStore((s) => s.activeJourney);
  const setActiveJourney = useJourneyStore((s) => s.setActiveJourney);
  const setCurrentEta = useJourneyStore((s) => s.setCurrentEta);
  const setActiveAlarmId = useJourneyStore((s) => s.setActiveAlarmId);
  const logout = useAuthStore((s) => s.logout);

  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [bufferMinutes, setBufferMinutes] = useState<number>(30);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>(
    'Starting journey & scheduling alarm...'
  );

  /**
   * Core journey start flow:
   * 1. Get current GPS location
   * 2. Call `POST /journeys` with origin + destination coords + buffer
   * 3. Call `GET /journeys/{id}/eta`
   * 4. Compute alarm time strictly with `computeAlarmTime(eta, buffer)`
   * 5. Schedule local alarm via `expo-notifications`
   * 6. Store `activeAlarmId`
   * 7. Navigate to `/journey`
   */
  const startJourneyWithDestination = async (
    destination: Destination,
    alarmBuffer: number
  ) => {
    setIsStarting(true);
    setLoadingMessage(`Calculating ETA to ${destination.name}...`);

    try {
      // 1. Get current GPS location
      let origin = coords;
      if (!origin) {
        origin = await getCurrentLocation();
      }

      // 2. Call POST /journeys
      const createdJourney = await createJourney({
        destination,
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
        alarmBufferMinutes: alarmBuffer,
      });

      // 3. Call GET /journeys/{id}/eta
      const etaResult = await getJourneyEta(
        createdJourney.id,
        alarmBuffer,
        origin
      );

      // 4. Compute alarm time strictly using computeAlarmTime()
      const etaDate = new Date(etaResult.estimatedArrival);
      const computedAlarmDate = computeAlarmTime(etaDate, alarmBuffer);

      // 5. Schedule local alarm
      const alarmIdentifier = await scheduleAlarm(
        computedAlarmDate,
        destination.name,
        etaDate
      );

      // 6. Store journey, ETA, and activeAlarmId in Zustand + AsyncStorage
      const updatedJourney = {
        ...createdJourney,
        alarmBufferMinutes: alarmBuffer,
        currentEta: etaDate.toISOString(),
        alarmScheduledAt: computedAlarmDate.toISOString(),
      };

      setActiveJourney(updatedJourney);
      setCurrentEta({
        ...etaResult,
        estimatedArrival: etaDate.toISOString(),
        alarmTime: computedAlarmDate.toISOString(),
      });
      setActiveAlarmId(alarmIdentifier);

      // 7. Navigate to /journey
      router.push('/journey');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to start journey. Please check your connection and permissions.';
      Alert.alert('Could Not Start Journey', message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStartButtonPress = async () => {
    if (!selectedDestination) {
      Alert.alert('Select Destination', 'Please search and select where you are going first.');
      return;
    }
    await startJourneyWithDestination(selectedDestination, bufferMinutes);
  };

  /**
   * Natural language AI input handler:
   * Calls `/ai/parse-journey` for NLU extraction ONLY (destination + bufferMinutes),
   * resolves coordinates if needed, then invokes the standard journey flow.
   */
  const handleAiPrompt = async (text: string) => {
    setIsAiProcessing(true);
    try {
      const parsed = await parseJourneyText(text);
      const targetBuffer = parsed.bufferMinutes || 30;
      setBufferMinutes(targetBuffer);

      let destination: Destination | null = parsed.destination ?? null;
      if (!destination || !destination.latitude || !destination.longitude) {
        const searchMatches = await searchDestinations(parsed.destinationName);
        if (searchMatches.length === 0) {
          throw new Error(
            `Found destination "${parsed.destinationName}", but could not resolve its coordinates.`
          );
        }
        destination = searchMatches[0];
      }

      setSelectedDestination(destination);
      await startJourneyWithDestination(destination, targetBuffer);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not parse your travel request. Try searching manually above.';
      Alert.alert('AI Assistant', msg);
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LoadingOverlay visible={isStarting} message={loadingMessage} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.brandRow}>
                <Text style={styles.brandIcon}>🚆</Text>
                <Text style={styles.brandTitle}>Alarmy</Text>
              </View>
              <Text style={styles.tagline}>
                &quot;We&apos;ll wake you before you arrive&quot;
              </Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.push('/history')}
                accessibilityLabel="Journey History"
              >
                <Ionicons name="time-outline" size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={logout}
                accessibilityLabel="Log Out"
              >
                <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Journey Quick Resume Banner */}
          {activeJourney && activeJourney.status === 'active' && (
            <TouchableOpacity
              style={styles.activeBanner}
              onPress={() => router.push('/journey')}
              activeOpacity={0.85}
            >
              <View style={styles.activeBannerLeft}>
                <View style={styles.pulseDot} />
                <View>
                  <Text style={styles.activeBannerTitle}>
                    Active Journey: {activeJourney.destination.name}
                  </Text>
                  <Text style={styles.activeBannerSub}>
                    Tap to view live ETA & wake-up alarm
                  </Text>
                </View>
              </View>
              <Ionicons name="arrow-forward-circle" size={24} color={colors.text} />
            </TouchableOpacity>
          )}

          {/* Current GPS Location Display */}
          <LocationDisplay
            cityName={cityName}
            isLoading={isLocating}
            error={locationError}
            onRefresh={refreshLocation}
          />

          {/* Destination Search */}
          <DestinationSearch
            selectedDestination={selectedDestination}
            onSelectDestination={setSelectedDestination}
          />

          {/* Wake-up Buffer Picker */}
          <View style={styles.bufferSection}>
            <Text style={styles.bufferLabel}>Wake me up before arrival:</Text>
            <View style={styles.bufferPills}>
              {BUFFER_OPTIONS.map((mins) => {
                const isSelected = bufferMinutes === mins;
                return (
                  <TouchableOpacity
                    key={mins}
                    style={[
                      styles.bufferPill,
                      isSelected && styles.bufferPillActive,
                    ]}
                    onPress={() => setBufferMinutes(mins)}
                  >
                    <Text
                      style={[
                        styles.bufferPillText,
                        isSelected && styles.bufferPillTextActive,
                      ]}
                    >
                      {mins} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Start Journey CTA */}
          <TouchableOpacity
            style={[
              styles.startButton,
              !selectedDestination && styles.startButtonDisabled,
            ]}
            onPress={handleStartButtonPress}
            disabled={!selectedDestination || isStarting}
            activeOpacity={0.85}
          >
            <Ionicons name="navigate" size={20} color={colors.text} />
            <Text style={styles.startButtonText}>Start Journey</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.orDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Natural Language AI Input */}
          <AiInput onSubmitPrompt={handleAiPrompt} isProcessing={isAiProcessing} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  brandIcon: {
    fontSize: fontSizes.xxl,
  },
  brandTitle: {
    color: colors.text,
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    marginTop: 4,
    fontStyle: 'italic',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  activeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  activeBannerTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  activeBannerSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  bufferSection: {
    marginBottom: spacing.lg,
  },
  bufferLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  bufferPills: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bufferPill: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  bufferPillActive: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.primary,
  },
  bufferPillText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  bufferPillTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  startButtonDisabled: {
    opacity: 0.45,
  },
  startButtonText: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '800',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    marginHorizontal: spacing.md,
    fontWeight: '600',
  },
});
