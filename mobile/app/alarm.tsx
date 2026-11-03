import React, { useEffect } from 'react';
import { Vibration, Platform, StyleSheet } from 'react-native';
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
    // Vibrate rhythmically on mobile devices
    if (Platform.OS !== 'web') {
      const pattern = [0, 800, 400, 800, 400, 1000];
      Vibration.vibrate(pattern, true);
      return () => {
        Vibration.cancel();
      };
    }

    // Play a pulsing Web Audio API chime on browsers
    let audioCtx: AudioContext | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const playChime = () => {
      try {
        const AudioContextClass =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtx) {
          audioCtx = new AudioContextClass();
        }
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.18); // A5
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.55);
      } catch {
        // ignore autoplay restrictions
      }
    };

    playChime();
    intervalId = setInterval(playChime, 1400);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
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
