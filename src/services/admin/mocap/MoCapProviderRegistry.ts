// @ts-nocheck
import type { MoCapProvider } from './MoCapProvider.types';
import { localHolisticMoCapProvider } from './LocalHolisticMoCapProvider';
import { httpMoCapProvider } from './HttpMoCapProvider';

const PROVIDERS: MoCapProvider[] = [
  httpMoCapProvider,
  localHolisticMoCapProvider,
];

export function getMoCapProviders(): MoCapProvider[] {
  return PROVIDERS;
}

export function getMoCapProvider(id: string): MoCapProvider | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

export async function listAvailableMoCapProviders(): Promise<MoCapProvider[]> {
  const checks = await Promise.all(
    PROVIDERS.map(async (p) => ({ p, ok: await p.isAvailable() })),
  );
  return checks.filter((x) => x.ok).map((x) => x.p);
}
