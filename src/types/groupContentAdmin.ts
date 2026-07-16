// @ts-nocheck
import type { AnalysisResult } from '../services/videoAnalysisTypes';
import type { DanceDatabase } from './danceDatabase';
import type { GroupMotionContent } from './groupMotionContent';

export type MoCapProviderId = 'local_holistic' | 'http_mocap_api';

export type GroupContentAdminPhase =
  | 'setup'
  | 'processing'
  | 'member_mapping'
  | 'validating'
  | 'persisting'
  | 'complete'
  | 'error';

export type GroupContentCreationJob = {
  groupId: string;
  songId: string;
  videoId?: string;
  videoFile?: File;
  providerId: MoCapProviderId;
  /** Admin placeholder — runtime userMemberId와 무관 */
  referenceMemberId: string;
};

export type GroupContentCreationResult = {
  analysisResult: AnalysisResult;
  danceDatabase: DanceDatabase;
  groupMotionContent: GroupMotionContent;
  providerId: MoCapProviderId;
  providerLabel: string;
  createdAt: string;
};

export type GroupContentPersistResult = {
  packageKey: string;
  indexedDb: boolean;
  choreoCache: boolean;
  exportedJsonFilename: string;
};
