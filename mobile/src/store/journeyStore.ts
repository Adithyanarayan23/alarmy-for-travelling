import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EtaResult, EtaUpdate, Journey } from '../types';

export interface JourneyStore {
  activeJourney: Journey | null;
  currentEta: EtaResult | null;
  etaHistory: EtaUpdate[];
  activeAlarmId: string | null;
  isLoading: boolean;
  error: string | null;

  setActiveJourney: (journey: Journey | null) => void;
  setCurrentEta: (eta: EtaResult) => void;
  addEtaUpdate: (update: EtaUpdate) => void;
  setActiveAlarmId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearJourney: () => void;
}

export const useJourneyStore = create<JourneyStore>()(
  persist(
    (set) => ({
      activeJourney: null,
      currentEta: null,
      etaHistory: [],
      activeAlarmId: null,
      isLoading: false,
      error: null,

      setActiveJourney: (journey: Journey | null) =>
        set({ activeJourney: journey, error: null }),

      setCurrentEta: (eta: EtaResult) =>
        set((state) => ({
          currentEta: eta,
          activeJourney: state.activeJourney
            ? {
                ...state.activeJourney,
                currentEta: eta.estimatedArrival,
                alarmScheduledAt: eta.alarmTime,
              }
            : null,
        })),

      addEtaUpdate: (update: EtaUpdate) =>
        set((state) => ({
          etaHistory: [update, ...state.etaHistory],
        })),

      setActiveAlarmId: (id: string | null) =>
        set({ activeAlarmId: id }),

      setLoading: (loading: boolean) =>
        set({ isLoading: loading }),

      setError: (error: string | null) =>
        set({ error }),

      clearJourney: () =>
        set({
          activeJourney: null,
          currentEta: null,
          etaHistory: [],
          activeAlarmId: null,
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: '@alarmy/journey-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeJourney: state.activeJourney,
        currentEta: state.currentEta,
        etaHistory: state.etaHistory,
        activeAlarmId: state.activeAlarmId,
      }),
    }
  )
);
