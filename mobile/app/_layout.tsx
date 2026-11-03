import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/authStore';
import { useJourneyStore } from '../src/store/journeyStore';
import { useNotificationHandler } from '../src/hooks/useNotificationHandler';
import { formatTime } from '../src/utils/dateUtils';
import { colors, spacing, fontSizes, borderRadius } from '../src/constants/theme';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeJourney = useJourneyStore((s) => s.activeJourney);
  const currentEta = useJourneyStore((s) => s.currentEta);

  // Set up expo-notifications foreground & tap response handlers
  useNotificationHandler();

  useEffect(() => {
    if (!isHydrated) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, isHydrated, segments, router]);

  if (!isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isDesktopWeb = Platform.OS === 'web' && width >= 920;

  const stackNavigator = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="journey" />
      <Stack.Screen
        name="alarm"
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
      <Stack.Screen name="history" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/register" />
    </Stack>
  );

  if (!isDesktopWeb) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.mobileWebWrap}>
          <View style={styles.mobileWebInner}>{stackNavigator}</View>
        </View>
      </SafeAreaProvider>
    );
  }

  const etaDisplay = currentEta?.estimatedArrival || activeJourney?.currentEta;
  const alarmDisplay = currentEta?.alarmTime || activeJourney?.alarmScheduledAt;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.webPageRoot}>
        {/* Top Navigation Bar */}
        <View style={styles.webNavbar}>
          <View style={styles.webNavbarInner}>
            <TouchableOpacity
              style={styles.webBrand}
              onPress={() => router.push('/')}
              activeOpacity={0.85}
            >
              <View style={styles.webBrandBadge}>
                <Text style={styles.webBrandEmoji}>🚆</Text>
              </View>
              <View>
                <Text style={styles.webBrandTitle}>Alarmy for Travelling</Text>
                <Text style={styles.webBrandSub}>Smart Destination-Based Travel Alarm</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.webNavLinks}>
              {isAuthenticated ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.webNavBtn,
                      pathname === '/' && styles.webNavBtnActive,
                    ]}
                    onPress={() => router.push('/')}
                  >
                    <Ionicons
                      name="compass-outline"
                      size={17}
                      color={pathname === '/' ? colors.text : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.webNavBtnText,
                        pathname === '/' && styles.webNavBtnTextActive,
                      ]}
                    >
                      Plan Journey
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.webNavBtn,
                      pathname === '/journey' && styles.webNavBtnActive,
                    ]}
                    onPress={() => router.push('/journey')}
                  >
                    <Ionicons
                      name="navigate-circle-outline"
                      size={17}
                      color={pathname === '/journey' ? colors.text : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.webNavBtnText,
                        pathname === '/journey' && styles.webNavBtnTextActive,
                      ]}
                    >
                      Live Tracker
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.webNavBtn,
                      pathname === '/history' && styles.webNavBtnActive,
                    ]}
                    onPress={() => router.push('/history')}
                  >
                    <Ionicons
                      name="time-outline"
                      size={17}
                      color={pathname === '/history' ? colors.text : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.webNavBtnText,
                        pathname === '/history' && styles.webNavBtnTextActive,
                      ]}
                    >
                      History
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.webUserPill}>
                    <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
                    <Text style={styles.webUserEmail} numberOfLines={1}>
                      {user?.email ?? 'Traveller'}
                    </Text>
                    <TouchableOpacity onPress={logout} style={styles.webLogoutBtn}>
                      <Ionicons name="log-out-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.webNavBtn,
                      pathname === '/auth/login' && styles.webNavBtnActive,
                    ]}
                    onPress={() => router.push('/auth/login')}
                  >
                    <Text style={styles.webNavBtnText}>Sign In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.webPrimaryCta}
                    onPress={() => router.push('/auth/register')}
                  >
                    <Text style={styles.webPrimaryCtaText}>Get Started</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Main 2-Column Web Content */}
        <View style={styles.webMainGrid}>
          {/* Left Marketing & Live Formula Column */}
          <View style={styles.webHeroColumn}>
            <View style={styles.webPillTag}>
              <View style={styles.webLiveDot} />
              <Text style={styles.webPillTagText}>
                REAL-TIME ETA WAKE-UP ENGINE
              </Text>
            </View>

            <Text style={styles.webHeroHeading}>
              Sleep on the train.{'\n'}
              <Text style={styles.webHeroAccent}>Never miss your stop.</Text>
            </Text>

            <Text style={styles.webHeroDescription}>
              Standard alarms fail when your train or bus gets delayed. Alarmy continuously
              tracks your live route ETA and automatically shifts your wake-up alarm so you
              always wake up right before arrival.
            </Text>

            {/* Formula Showcase Card */}
            <View style={styles.webFormulaCard}>
              <Text style={styles.webFormulaLabel}>CORE ALARM FORMULA</Text>
              <View style={styles.webFormulaEquationRow}>
                <View style={styles.webFormulaBox}>
                  <Text style={styles.webFormulaBoxSub}>Wake-Up Alarm</Text>
                  <Text style={styles.webFormulaBoxVal}>
                    {alarmDisplay ? formatTime(alarmDisplay) : '06:00 AM'}
                  </Text>
                </View>
                <Text style={styles.webFormulaOp}>=</Text>
                <View style={styles.webFormulaBox}>
                  <Text style={styles.webFormulaBoxSub}>Live Route ETA</Text>
                  <Text style={[styles.webFormulaBoxVal, { color: colors.success }]}>
                    {etaDisplay ? formatTime(etaDisplay) : '06:30 AM'}
                  </Text>
                </View>
                <Text style={styles.webFormulaOp}>−</Text>
                <View style={styles.webFormulaBox}>
                  <Text style={styles.webFormulaBoxSub}>Wake Buffer</Text>
                  <Text style={[styles.webFormulaBoxVal, { color: colors.secondary }]}>
                    {activeJourney ? `${activeJourney.alarmBufferMinutes} min` : '30 min'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Feature Grid */}
            <View style={styles.webFeatureList}>
              <View style={styles.webFeatureItem}>
                <View style={styles.webFeatureIconWrap}>
                  <Ionicons name="sync-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.webFeatureTextWrap}>
                  <Text style={styles.webFeatureTitle}>Dynamic Delay Rescheduling</Text>
                  <Text style={styles.webFeatureDesc}>
                    Polls OSRM & GPS every 5 minutes. If arrival slips from 6:30 AM to 7:00 AM,
                    your 6:00 AM alarm automatically moves to 6:30 AM.
                  </Text>
                </View>
              </View>

              <View style={styles.webFeatureItem}>
                <View style={styles.webFeatureIconWrap}>
                  <Ionicons name="sparkles-outline" size={20} color={colors.secondary} />
                </View>
                <View style={styles.webFeatureTextWrap}>
                  <Text style={styles.webFeatureTitle}>AI Natural-Language Trip Setup</Text>
                  <Text style={styles.webFeatureDesc}>
                    Just type &quot;I&apos;m going to Bangalore tonight, wake me 45 min before&quot;
                    and Alarmy configures your destination and wake buffer automatically.
                  </Text>
                </View>
              </View>

              <View style={styles.webFeatureItem}>
                <View style={styles.webFeatureIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
                </View>
                <View style={styles.webFeatureTextWrap}>
                  <Text style={styles.webFeatureTitle}>Offline-Resilient Local Alarm</Text>
                  <Text style={styles.webFeatureDesc}>
                    Alarms are scheduled directly on your device so they still ring even through
                    dead network zones.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right Interactive App Frame Column */}
          <View style={styles.webAppColumn}>
            <View style={styles.phoneDeviceFrame}>
              <View style={styles.phoneNotchBar}>
                <View style={styles.phoneSpeaker} />
              </View>
              <View style={styles.phoneScreenContent}>{stackNavigator}</View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileWebWrap: {
    flex: 1,
    backgroundColor: '#0d0e1b',
    alignItems: 'center',
  },
  mobileWebInner: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.background,
  },
  webPageRoot: {
    flex: 1,
    backgroundColor: '#0d0e1b',
  },
  webNavbar: {
    height: 72,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: 'rgba(22, 33, 62, 0.85)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  webNavbarInner: {
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  webBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  webBrandBadge: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBrandEmoji: {
    fontSize: 22,
  },
  webBrandTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '800',
  },
  webBrandSub: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
  },
  webNavLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  webNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  webNavBtnActive: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  webNavBtnText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  webNavBtnTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  webUserPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  webUserEmail: {
    color: colors.text,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    maxWidth: 150,
  },
  webLogoutBtn: {
    marginLeft: 4,
    padding: 4,
  },
  webPrimaryCta: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  webPrimaryCtaText: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  webMainGrid: {
    flex: 1,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.xxl,
  },
  webHeroColumn: {
    flex: 1.15,
    justifyContent: 'center',
  },
  webPillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: 8,
    marginBottom: spacing.md,
  },
  webLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  webPillTagText: {
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: '800',
    letterSpacing: 1,
  },
  webHeroHeading: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 52,
    marginBottom: spacing.md,
  },
  webHeroAccent: {
    color: colors.primary,
  },
  webHeroDescription: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    lineHeight: 24,
    marginBottom: spacing.lg,
    maxWidth: 560,
  },
  webFormulaCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    maxWidth: 560,
  },
  webFormulaLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  webFormulaEquationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  webFormulaBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  webFormulaBoxSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  webFormulaBoxVal: {
    color: colors.primary,
    fontSize: fontSizes.md,
    fontWeight: '800',
  },
  webFormulaOp: {
    color: colors.textMuted,
    fontSize: fontSizes.xl,
    fontWeight: '800',
  },
  webFeatureList: {
    gap: spacing.md,
    maxWidth: 560,
  },
  webFeatureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  webFeatureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  webFeatureTextWrap: {
    flex: 1,
  },
  webFeatureTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  webFeatureDesc: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  webAppColumn: {
    width: 430,
    height: '100%',
    maxHeight: 820,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneDeviceFrame: {
    width: 420,
    height: '100%',
    maxHeight: 800,
    backgroundColor: colors.background,
    borderRadius: 36,
    borderWidth: 6,
    borderColor: '#252945',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
  },
  phoneNotchBar: {
    height: 24,
    backgroundColor: '#121324',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  phoneSpeaker: {
    width: 64,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#2d3748',
  },
  phoneScreenContent: {
    flex: 1,
  },
});
