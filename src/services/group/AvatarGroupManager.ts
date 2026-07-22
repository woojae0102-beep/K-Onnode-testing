// @ts-nocheck
import type { GroupMember } from '../../types/groupPractice';
import type {
  AIAvatarInstance,
  ChoreographyDataset,
  ChoreographyMemberMeta,
  PersonaStyle,
} from '../../types/groupChoreography';
import { getVisibleGroupMembers } from '../../modes/group/runtime/getVisibleGroupMembers';

export interface AvatarGroupManagerInput {
  dataset: ChoreographyDataset;
  groupMembers: GroupMember[];
  userMemberId: string;
}

export interface AvatarGroupState {
  userMemberId: string;
  userMeta: ChoreographyMemberMeta | null;
  /** 선택 멤버를 제외한 AI 아바타 메타 (최대 memberCount-1) */
  aiMembers: ChoreographyMemberMeta[];
  /** 그룹 멤버 정보와 병합된 런타임 AI 아바타 템플릿 */
  aiAvatars: Array<{
    memberId: string;
    displayName: string;
    persona: PersonaStyle;
    groupMember: GroupMember | null;
  }>;
}

const DEFAULT_PERSONA: PersonaStyle = {
  styleId: 'balanced',
  energy: 0.75,
  sharpness: 0.7,
  groove: 0.65,
  accentColor: '#FF1F8E',
  lineScale: 1,
};

/**
 * 사용자가 선택한 멤버를 제외하고 나머지 AI 아바타를 필터·생성합니다.
 */
export class AvatarGroupManager {
  private state: AvatarGroupState;

  constructor(input: AvatarGroupManagerInput) {
    this.state = AvatarGroupManager.buildState(input);
  }

  static buildState({ dataset, groupMembers, userMemberId }: AvatarGroupManagerInput): AvatarGroupState {
    const memberMap = new Map(groupMembers.map((m) => [m.id, m]));
    const metaById = new Map(dataset.members.map((m) => [m.memberId, m]));

    const { userMember, visibleAiMembers } = getVisibleGroupMembers({
      members: dataset.members.map((m) => ({ memberId: m.memberId, _meta: m })),
      selectedMemberId: userMemberId,
      mode: 'avatar-manager',
    });

    const userMeta = userMember?._meta
      || metaById.get(userMemberId)
      || inferMemberMeta(userMemberId, memberMap.get(userMemberId));

    const aiMembers = visibleAiMembers.map((v) => v._meta);

    const aiAvatars = aiMembers.map((meta) => {
      const groupMember = memberMap.get(meta.memberId) || null;
      return {
        memberId: meta.memberId,
        displayName: meta.displayNameKr || meta.displayName || groupMember?.nameKr || meta.memberId,
        persona: mergePersona(meta.persona, groupMember),
        groupMember,
      };
    });

    return { userMemberId, userMeta, aiMembers, aiAvatars };
  }

  getState() {
    return this.state;
  }

  /** 멤버 선택 변경 시 AI 아바타 목록 재생성 */
  setUserMemberId(userMemberId: string, dataset: ChoreographyDataset, groupMembers: GroupMember[]) {
    this.state = AvatarGroupManager.buildState({ dataset, groupMembers, userMemberId });
    return this.state;
  }

  /** AI 아바타 ID 목록 */
  getAiMemberIds(): string[] {
    return this.state.aiAvatars.map((a) => a.memberId);
  }

  /** 렌더링용 빈 AI 아바타 인스턴스 (프레임 데이터는 SyncEngine이 채움) */
  createEmptyInstances(): AIAvatarInstance[] {
    return this.state.aiAvatars.map((avatar) => ({
      memberId: avatar.memberId,
      displayName: avatar.displayName,
      persona: avatar.persona,
      joints: {},
      worldOffset: { x: 0, y: 0, z: 0 },
    }));
  }
}

function inferMemberMeta(memberId: string, groupMember?: GroupMember | null): ChoreographyMemberMeta {
  return {
    memberId,
    displayName: groupMember?.name || memberId,
    displayNameKr: groupMember?.nameKr,
    persona: mergePersona(DEFAULT_PERSONA, groupMember),
    formationAnchor: {
      x: groupMember?.defaultX ?? 0.5,
      y: groupMember?.defaultY ?? 0.5,
      z: 0,
    },
  };
}

function mergePersona(base: PersonaStyle, groupMember?: GroupMember | null): PersonaStyle {
  if (!groupMember) return base;
  return {
    ...base,
    accentColor: groupMember.color || base.accentColor,
  };
}

export default AvatarGroupManager;
