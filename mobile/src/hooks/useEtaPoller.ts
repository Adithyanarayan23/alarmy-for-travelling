import { useEffect, useRef, useState, useCallback } from 'react';
import { useJourneyStore } from '../store/journeyStore';
import { getJourneyEta } from '../services/journeyService';
import { getCurrentLocation } from '../services/locationService';
import { cancelAlarm, scheduleAlarm } from '../services/alarmService';
import { computeAlarmTime } from '../utils/alarmUtils';
import { timeDiffSeconds } from '../utils/dateUtils';
import { EtaUpdate } from '../types';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SIGNIFICANT_ETA_CHANGE_SECONDS = 120; // 2 minutes

export interface UseEtaPollerResult {
  latestBannerUpdate: EtaUpdate | null;
  dismissBanner: () => void;
  isPolling: boolean;
  pollNow: () => Promise<void>;
}

/**
 * Polls `GET /journeys/{id}/eta` every 5 minutes while an active journey exists.
 * If the new ETA differs from the current ETA by > 2 minutes (120 seconds):
 *  1. Cancels the old alarm
 *  2. Computes the new alarm time using `computeAlarmTime(eta, buffer)`
 *  3. Schedules the new local notification alarm
 *  4. Appends the change to `etaHistory` in `journeyStore`
 *  5. Surfaces `latestBannerUpdate` for `EtaUpdateBanner`
 */
export function useEtaPoller(): UseEtaPollerResult {
  const activeJourney = useJourneyStore((s) => s.activeJourney);
  const currentEta = useJourneyStore((s) => s.currentEta);
  const activeAlarmId = useJourneyStore((s) => s.activeAlarmId);
  const setCurrentEta = useJourneyStore((s) => s.setCurrentEta);
  const addEtaUpdate = useJourneyStore((s) => s.addEtaUpdate);
  const setActiveAlarmId = useJourneyStore((s) => s.setActiveAlarmId);
  const setError = useJourneyStore((s) => s.setError);

  const [latestBannerUpdate, setLatestBannerUpdate] = useState<EtaUpdate | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Refs to avoid stale closures inside setInterval
  const alarmIdRef = useRef<string | null>(activeAlarmId);
  const currentEtaRef = useRef(currentEta);
  const activeJourneyRef = useRef(activeJourney);

  useEffect(() => {
    alarmIdRef.current = activeAlarmId;
  }, [activeAlarmId]);

  useEffect(() => {
    currentEtaRef.current = currentEta;
  }, [currentEta]);

  useEffect(() => {
    activeJourneyRef.current = activeJourney;
  }, [activeJourney]);

  const pollNow = useCallback(async () => {
    const journey = activeJourneyRef.current;
    if (!journey || journey.status !== 'active') {
      return;
    }

    setIsPolling(true);
    try {
      let currentCoords: { latitude: number; longitude: number } | undefined;
      try {
        currentCoords = await getCurrentLocation();
      } catch {
        // Proceed with backend ETA call even if instant GPS fix fails
      }

      const freshEtaResult = await getJourneyEta(
        journey.id,
        journey.alarmBufferMinutes,
        currentCoords
      );

      const newEtaDate = new Date(freshEtaResult.estimatedArrival);
      const newAlarmDate = computeAlarmTime(newEtaDate, journey.alarmBufferMinutes);

      const normalizedEtaResult = {
        ...freshEtaResult,
        estimatedArrival: newEtaDate.toISOString(),
        alarmTime: newAlarmDate.toISOString(),
      };

      const prevEta = currentEtaRef.current;

      if (prevEta) {
        const diffSec = Math.abs(
          timeDiffSeconds(newEtaDate, new Date(prevEta.estimatedArrival))
        );

        if (diffSec > SIGNIFICANT_ETA_CHANGE_SECONDS) {
          // 1. Cancel old alarm
          if (alarmIdRef.current) {
            await cancelAlarm(alarmIdRef.current);
          } else {
            await cancelAlarm();
          }

          // 2. Schedule new alarm using computeAlarmTime result
          const newId = await scheduleAlarm(
            newAlarmDate,
            journey.destination.name,
            newEtaDate
          );

          alarmIdRef.current = newId;
          setActiveAlarmId(newId);

          // 3. Record update in history & banner
          const updateRecord: EtaUpdate = {
            previousEta: prevEta.estimatedArrival,
            newEta: newEtaDate.toISOString(),
            previousAlarm: prevEta.alarmTime,
            newAlarm: newAlarmDate.toISOString(),
            timestamp: new Date().toISOString(),
          };

          addEtaUpdate(updateRecord);
          setLatestBannerUpdate(updateRecord);
        }
      } else {
        // First ETA received — ensure an alarm is scheduled if none is active
        if (!alarmIdRef.current) {
          const newId = await scheduleAlarm(
            newAlarmDate,
            journey.destination.name,
            newEtaDate
          );
          alarmIdRef.current = newId;
          setActiveAlarmId(newId);
        }
      }

      setCurrentEta(normalizedEtaResult);
      setError(null);
    } catch (err) {
      // Graceful degradation: preserve existing local alarm if backend is temporarily unreachable
      const msg =
        err instanceof Error
          ? err.message
          : 'Backend unreachable. Existing local alarm remains active.';
      setError(msg);
    } finally {
      setIsPolling(false);
    }
  }, [addEtaUpdate, setActiveAlarmId, setCurrentEta, setError]);

  useEffect(() => {
    if (!activeJourney || activeJourney.status !== 'active') {
      return;
    }

    const intervalId = setInterval(() => {
      pollNow();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeJourney?.id, activeJourney?.status, pollNow]);

  const dismissBanner = useCallback(() => {
    setLatestBannerUpdate(null);
  }, []);

  return {
    latestBannerUpdate,
    dismissBanner,
    isPolling,
    pollNow,
  };
}
