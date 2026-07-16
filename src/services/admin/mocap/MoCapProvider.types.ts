// @ts-nocheck
import type { AnalysisResult } from '../../videoAnalysisTypes';
import type { MoCapProviderId } from '../../../types/groupContentAdmin';

export type MoCapExtractInput = {
  groupId: string;
  songId: string;
  videoFile?: File;
  video?: HTMLVideoElement;
  videoId?: string;
  onStatus?: (msg: string) => void;
  onProgress?: (pct: number) => void;
  abortRef?: { current: boolean };
};

export type MoCapExtractOutput = {
  analysisResult: AnalysisResult;
  providerId: MoCapProviderId;
  providerLabel: string;
};

export interface MoCapProvider {
  id: MoCapProviderId;
  label: string;
  description: string;
  isAvailable(): boolean | Promise<boolean>;
  extract(input: MoCapExtractInput): Promise<MoCapExtractOutput>;
}
