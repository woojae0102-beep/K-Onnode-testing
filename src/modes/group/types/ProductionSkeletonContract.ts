// @ts-nocheck
/**
 * Production Skeleton Contract — Group Mode retarget gate (PHASE 8).
 * SkeletonFrameData 아님.
 */

export type SkeletonProfile =
  | 'K_ONNODE_AVATAR_V1'
  | 'MIXAMO'
  | 'RPM'
  | 'UNKNOWN';

export type SemanticBoneSide = 'left' | 'right' | 'center';

export type SemanticBoneName =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'leftHand'
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'rightHand'
  | 'leftUpperLeg'
  | 'leftLowerLeg'
  | 'leftFoot'
  | 'rightUpperLeg'
  | 'rightLowerLeg'
  | 'rightFoot';

export type SemanticBoneDefinition = {
  semanticName: SemanticBoneName;
  required: boolean;
  side: SemanticBoneSide;
  aliases: string[];
};

export type SkeletonValidationStatus =
  | 'valid'
  | 'invalid'
  | 'incomplete'
  | 'unsupported';

export type SkeletonValidationResult = {
  status: SkeletonValidationStatus;
  profile: SkeletonProfile;
  requiredBoneCount: number;
  matchedRequiredBoneCount: number;
  missingRequiredBones: SemanticBoneName[];
  duplicateSemanticBones: SemanticBoneName[];
  mappedSemanticBones: Partial<Record<SemanticBoneName, string>>;
  mappingRatio: number;
  blockingReasons: string[];
};

export type ProductionMotionFinalStatus =
  | 'VERIFIED_DIRECT_PLAYBACK'
  | 'VERIFIED_RETARGET_PLAYBACK'
  | 'BLOCKED_SKELETON_INVALID'
  | 'BLOCKED_REQUIRED_BONE_MISSING'
  | 'BLOCKED_MAPPING_FAILED'
  | 'BLOCKED_CLIP_INVALID'
  | 'BLOCKED_TRANSFORM_NOT_CHANGED'
  | 'BLOCKED_SKELETON_PROFILE_UNSUPPORTED'
  | 'BLOCKED_BINDING_FAILED'
  | 'BLOCKED_INCOMPLETE'
  | 'BLOCKED_AUTHORITY_TIMEOUT'
  | 'BLOCKED_AUTHORITY_NETWORK_ERROR'
  | 'BLOCKED_AUTHORITY_SERVER_ERROR'
  | 'BLOCKED_AUTHORITY_BAD_RESPONSE'
  | 'BLOCKED_AUTHORITY_VERIFICATION_FAILED';

/** v2.1 extension — schemaVersion 2 유지, optional 필드로 migration boundary */
export type ProductionSkeletonProfileFields = {
  sourceSkeletonProfile?: SkeletonProfile;
  sourceSkeletonVersion?: string;
  avatarSkeletonProfile?: SkeletonProfile;
  avatarSkeletonVersion?: string;
};

export const PRODUCTION_SKELETON_CONTRACT_VERSION = '1.0';

export const REQUIRED_SEMANTIC_BONES: SemanticBoneDefinition[] = [
  { semanticName: 'hips', required: true, side: 'center', aliases: ['hips', 'pelvis', 'hip', 'root', 'mixamorighips', 'mixamorig:hips'] },
  { semanticName: 'spine', required: true, side: 'center', aliases: ['spine', 'mixamorigspine', 'mixamorig:spine'] },
  { semanticName: 'chest', required: true, side: 'center', aliases: ['chest', 'spine1', 'spine2', 'spine3', 'upperchest', 'mixamorigspine1', 'mixamorig:spine1', 'mixamorigspine2', 'mixamorig:chest'] },
  { semanticName: 'neck', required: true, side: 'center', aliases: ['neck', 'mixamorigneck', 'mixamorig:neck'] },
  { semanticName: 'head', required: true, side: 'center', aliases: ['head', 'mixamorighead', 'mixamorig:head'] },
  { semanticName: 'leftUpperArm', required: true, side: 'left', aliases: ['leftarm', 'leftupperarm', 'upperarm_l', 'arm_l', 'leftshoulder', 'mixamorigleftarm', 'mixamorig:leftarm'] },
  { semanticName: 'leftLowerArm', required: true, side: 'left', aliases: ['leftforearm', 'lowerarm_l', 'forearm_l', 'mixamorigleftforearm', 'mixamorig:leftforearm'] },
  { semanticName: 'leftHand', required: true, side: 'left', aliases: ['lefthand', 'hand_l', 'mixamoriglefthand', 'mixamorig:lefthand'] },
  { semanticName: 'rightUpperArm', required: true, side: 'right', aliases: ['rightarm', 'rightupperarm', 'upperarm_r', 'arm_r', 'rightshoulder', 'mixamorigrightarm', 'mixamorig:rightarm'] },
  { semanticName: 'rightLowerArm', required: true, side: 'right', aliases: ['rightforearm', 'lowerarm_r', 'forearm_r', 'mixamorigrightforearm', 'mixamorig:rightforearm'] },
  { semanticName: 'rightHand', required: true, side: 'right', aliases: ['righthand', 'hand_r', 'mixamorigrighthand', 'mixamorig:righthand'] },
  { semanticName: 'leftUpperLeg', required: true, side: 'left', aliases: ['leftupleg', 'leftupperleg', 'upperleg_l', 'thigh_l', 'mixamorigleftupleg', 'mixamorig:leftupleg'] },
  { semanticName: 'leftLowerLeg', required: true, side: 'left', aliases: ['leftleg', 'leftlowerleg', 'lowerleg_l', 'calf_l', 'mixamorigleftleg', 'mixamorig:leftleg'] },
  { semanticName: 'leftFoot', required: true, side: 'left', aliases: ['leftfoot', 'foot_l', 'mixamorigleftfoot', 'mixamorig:leftfoot'] },
  { semanticName: 'rightUpperLeg', required: true, side: 'right', aliases: ['rightupleg', 'rightupperleg', 'upperleg_r', 'thigh_r', 'mixamorigrightupleg', 'mixamorig:rightupleg'] },
  { semanticName: 'rightLowerLeg', required: true, side: 'right', aliases: ['rightleg', 'rightlowerleg', 'lowerleg_r', 'calf_r', 'mixamorigrightleg', 'mixamorig:rightleg'] },
  { semanticName: 'rightFoot', required: true, side: 'right', aliases: ['rightfoot', 'foot_r', 'mixamorigrightfoot', 'mixamorig:rightfoot'] },
];

export default REQUIRED_SEMANTIC_BONES;
