import { User } from '../types';

let currentUser: User | null = null;
const listeners = new Set<(user: User | null) => void>();

export function setCurrentUser(user: User | null): void {
  currentUser = user;
  listeners.forEach(l => l(user));
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function onUserChange(callback: (user: User | null) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
