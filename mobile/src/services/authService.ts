import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setApiAuthToken } from './api';
import { AuthResponse, User } from '../types';

const TOKEN_STORAGE_KEY = '@alarmy/auth_token';
const USER_STORAGE_KEY = '@alarmy/auth_user';
const LOCAL_USERS_KEY = '@alarmy/local_users';

interface StoredLocalUser {
  id: string;
  email: string;
  password: string;
}

async function getLocalUsers(): Promise<StoredLocalUser[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredLocalUser[]) : [];
  } catch {
    return [];
  }
}

async function saveLocalUsers(users: StoredLocalUser[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore storage errors
  }
}

export async function login(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const response = await api.post<AuthResponse>('/auth/login', {
      email: normalizedEmail,
      password,
    });

    const data = response.data;
    const token = data.access_token || data.token || '';
    const user: User = data.user || { id: 'user-1', email: normalizedEmail };

    if (!token) {
      throw new Error('Authentication token missing in server response.');
    }

    setApiAuthToken(token);
    await AsyncStorage.multiSet([
      [TOKEN_STORAGE_KEY, token],
      [USER_STORAGE_KEY, JSON.stringify(user)],
    ]);

    return { user, token };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    // If server is unreachable (e.g. hosted as a standalone web app on Vercel), authenticate via local storage
    if (msg.includes('Unable to reach server') || msg.includes('Network Error')) {
      const localUsers = await getLocalUsers();
      const matched = localUsers.find((u) => u.email === normalizedEmail);
      if (matched && matched.password !== password) {
        throw new Error('Incorrect email or password.');
      }
      const user: User = matched
        ? { id: matched.id, email: matched.email }
        : { id: `local-${Date.now()}`, email: normalizedEmail };
      const token = `local-jwt-${user.id}`;

      if (!matched) {
        localUsers.push({ id: user.id, email: normalizedEmail, password });
        await saveLocalUsers(localUsers);
      }

      setApiAuthToken(token);
      await AsyncStorage.multiSet([
        [TOKEN_STORAGE_KEY, token],
        [USER_STORAGE_KEY, JSON.stringify(user)],
      ]);
      return { user, token };
    }
    throw err;
  }
}

export async function register(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const response = await api.post<AuthResponse>('/auth/register', {
      email: normalizedEmail,
      password,
    });

    const data = response.data;
    const token = data.access_token || data.token || '';
    const user: User = data.user || { id: 'user-1', email: normalizedEmail };

    if (!token) {
      return login(email, password);
    }

    setApiAuthToken(token);
    await AsyncStorage.multiSet([
      [TOKEN_STORAGE_KEY, token],
      [USER_STORAGE_KEY, JSON.stringify(user)],
    ]);

    return { user, token };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('Unable to reach server') || msg.includes('Network Error')) {
      const localUsers = await getLocalUsers();
      const existing = localUsers.find((u) => u.email === normalizedEmail);
      if (existing) {
        throw new Error('A user with this email address already exists.');
      }
      const user: User = { id: `local-${Date.now()}`, email: normalizedEmail };
      const token = `local-jwt-${user.id}`;
      localUsers.push({ id: user.id, email: normalizedEmail, password });
      await saveLocalUsers(localUsers);

      setApiAuthToken(token);
      await AsyncStorage.multiSet([
        [TOKEN_STORAGE_KEY, token],
        [USER_STORAGE_KEY, JSON.stringify(user)],
      ]);
      return { user, token };
    }
    throw err;
  }
}

export async function clearStoredAuth(): Promise<void> {
  setApiAuthToken(null);
  await AsyncStorage.multiRemove([TOKEN_STORAGE_KEY, USER_STORAGE_KEY]);
}

export async function getStoredAuth(): Promise<{ user: User | null; token: string | null }> {
  const [[, token], [, userJson]] = await AsyncStorage.multiGet([
    TOKEN_STORAGE_KEY,
    USER_STORAGE_KEY,
  ]);
  const user: User | null = userJson ? (JSON.parse(userJson) as User) : null;
  if (token) {
    setApiAuthToken(token);
  }
  return { user, token };
}
