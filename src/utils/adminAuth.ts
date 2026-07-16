// @ts-nocheck
import type { UserProfile } from '../contexts/AuthContext';

const ADMIN_UIDS_ENV = (import.meta as any).env?.VITE_ADMIN_UIDS || '';

function envAdminUids(): string[] {
  return ADMIN_UIDS_ENV.split(',').map((s: string) => s.trim()).filter(Boolean);
}

export function isAdminProfile(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  return envAdminUids().includes(profile.uid);
}

export default isAdminProfile;
