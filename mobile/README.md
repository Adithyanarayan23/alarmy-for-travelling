# 🚆 Alarmy for Travelling — Mobile App

> **"Tell us where you're going. We'll wake you 30 minutes before you arrive."**

**Alarmy for Travelling** is a destination-based travel alarm mobile application built with **React Native + Expo (SDK 51)**, **TypeScript**, **Expo Router**, and **Zustand**. Unlike conventional clock alarms that fail when trains, buses, or traffic get delayed, Alarmy continuously tracks your live ETA and dynamically reschedules your local device wake-up alarm so you always wake up right before your stop.

---

## 📸 Screenshots

| Home & Destination Search | Active Journey Tracking | Wake-Up Alarm Screen |
| :---: | :---: | :---: |
| *(Placeholder: Home Screen)* | *(Placeholder: Journey ETA Screen)* | *(Placeholder: Alarm Firing Screen)* |

---

## 🛠️ Tech Stack

- **Framework:** React Native + Expo SDK 51
- **Language:** TypeScript (Strict Mode)
- **Navigation:** Expo Router (File-based routing)
- **State Management:** Zustand + `@react-native-async-storage/async-storage` persistence
- **GPS & Geolocation:** `expo-location` + `expo-task-manager`
- **Local Alarm Scheduling:** `expo-notifications`
- **Networking:** `axios` with JWT request/response interceptors

---

## 📋 Prerequisites

- **Node.js** `>= 18.x`
- **npm** or **yarn**
- **Expo Go** app on a physical iOS/Android device, or an Android Emulator / iOS Simulator
- Running instance of the **Alarmy Backend API** (defaults to `http://localhost:8000/api/v1`)

---

## 🚀 Setup Steps

1. **Navigate to the mobile directory:**
   ```bash
   cd mobile
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to point to your backend server URL.

4. **Start the Expo development server:**
   ```bash
   npx expo start
   ```

---

## 🔌 Connecting to the Backend

Set `EXPO_PUBLIC_API_URL` in your `.env` file:

- **iOS Simulator:** `http://localhost:8000/api/v1`
- **Android Emulator:** `http://10.0.2.2:8000/api/v1`
- **Physical Device (on same Wi-Fi):** `http://<YOUR_COMPUTER_LAN_IP>:8000/api/v1` (e.g., `http://192.168.1.42:8000/api/v1`)

---

## ⏰ How the Alarm Logic Works

1. **Single Source of Truth (`computeAlarmTime`):**
   Every alarm time in the app is strictly derived from the latest ETA using `computeAlarmTime(eta, bufferMinutes)` in `src/utils/alarmUtils.ts`:
   ```ts
   alarmTime = ETA - bufferMinutes
   ```
   Alarm time is **never** set from a static user clock time or AI guess.

2. **Local Device Scheduling & Offline Resilience:**
   Alarms are scheduled directly on the OS via `expo-notifications`. The active notification identifier is stored both in memory and in `AsyncStorage` (`@alarmy/active_alarm_id`). Even if your train enters a dead zone and the backend becomes unreachable, your previously scheduled local alarm will still fire on time.

3. **Single Active Alarm Guarantee:**
   Before scheduling a new alarm, `alarmService` always cancels any existing notification identifier first.

4. **Dynamic ETA Polling (`useEtaPoller`):**
   While a journey is active, the app polls `GET /journeys/{id}/eta` every **5 minutes**:
   - Compares the newly returned ETA with the current ETA in `journeyStore`.
   - If the ETA shifts by **more than 2 minutes (120 seconds)**:
     1. Cancels the old local notification alarm.
     2. Computes the new alarm time via `computeAlarmTime(newEta, bufferMinutes)`.
     3. Schedules a new local alarm notification.
     4. Logs the change to `etaHistory` and displays the `EtaUpdateBanner`.

---

## 💬 AI Assistant Usage (NLU Only)

On the Home screen, you can type natural language requests such as:
> *"I'm going to Bangalore, wake me 30 min before"*

- `aiService.ts` sends the text to `POST /ai/parse-journey`.
- The AI extracts **only** the structured intent (`destinationName` and `bufferMinutes`).
- The app then executes the standard GPS + `POST /journeys` + `GET /journeys/{id}/eta` + `computeAlarmTime()` pipeline. **The AI never sets or calculates the alarm time.**

---

## 🔐 Permissions Explanation

- **Location When In Use & Background (`expo-location`):** Required to detect your origin city, calculate real-time travel ETA to your destination, and keep your arrival estimate accurate while you sleep.
- **Notifications (`expo-notifications`):** Required to trigger high-priority wake-up alarms with sound and vibration even when the device screen is locked.
