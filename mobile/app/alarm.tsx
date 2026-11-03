import React, { useEffect } from 'react';
import { Vibration, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AlarmBanner } from '../src/components/AlarmBanner';
import { useJourneyStore } from '../src/store/journeyStore';
import { cancelAlarm } from '../src/services/alarmService';
import { updateJourney } from '../src/services/journeyService';
import { colors } from '../src/constants/theme';

export default function AlarmScreen() {
  const router = useRouter();
  const activeJourney = useJourneyStore((s) => s.activeJourney);
  const currentEta = useJourneyStore((s) => s.currentEta);
  const activeAlarmId = useJourneyStore((s) => s.activeAlarmId);
  const clearJourney = useJourneyStore((s) => s.clearJourney);

  useEffect(() => {
    // Vibrate rhythmically while the alarm screen is active
    const pattern = [0, 800, 400, 800, 400, 1000];
    Vibration.vibrate(pattern, true);

    return () => {
      Vibration.cancel();
    };
  }, []);

  const handleDismissAlarm = async () => {
    Vibration.cancel();

    // 1. Cancel local scheduled alarm notification
    await cancelAlarm(activeAlarmId);

    // 2. Mark journey status as 'completed' on backend
    if (activeJourney) {
      try {
        await updateJourney(activeJourney.id, { status: 'completed' });
      } catch {
        // Proceed with local completion even if offline
      }
    }

    // 3. Clear active journey store and navigate home
    clearJourney();
    router.replace('/');
  };

  const destinationName = activeJourney?.destination.name ?? 'Your Destination';
  const expectedArrival =
    currentEta?.estimatedArrival ?? activeJourney?.currentEta ?? new Date().toISOString();

  return (
    <SafeAreaView style={styles.safeArea}>
      <AlarmBanner
        destinationName={destinationName}
        expectedArrival={expectedArrival}
        onDismiss={handleDismissAlarm}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
