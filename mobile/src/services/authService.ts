import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setApiAuthToken } from './api';
import { AuthResponse, User } from '../types';

const TOKEN_STORAGE_KEY = '@alarmy/auth_token';
const USER_STORAGE_KEY = '@alarmy/auth_user';

export async function login(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const response = await api.post<AuthResponse>('/auth/login', {
    email: email.trim().toLowerCase(),
    password,
  });

  const data = response.data;
  const token = data.access_token || data.token || '';
  const user: User = data.user || { id: 'user-1', email: email.trim().toLowerCase() };

  if (!token) {
    throw new Error('Authentication token missing in server response.');
  }

  setApiAuthToken(token);
  await AsyncStorage.multiSet([
    [TOKEN_STORAGE_KEY, token],
    [USER_STORAGE_KEY, JSON.stringify(user)],
  ]);

  return { user, token };
}

export async function register(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const response = await api.post<AuthResponse>('/auth/register', {
    email: email.trim().toLowerCase(),
    password,
  });

  const data = response.data;
  const token = data.access_token || data.token || '';
  const user: User = data.user || { id: 'user-1', email: email.trim().toLowerCase() };

  if (!token) {
    // If registration endpoint doesn't auto-return token, immediately log in
    return login(email, password);
  }

  setApiAuthToken(token);
  await AsyncStorage.multiSet([
    [TOKEN_STORAGE_KEY, token],
    [USER_STORAGE_KEY, JSON.stringify(user)],
  ]);

  return { user, token };
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
