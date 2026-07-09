// @ts-nocheck
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { SkeletonFrameData } from '../../types/groupPractice';
import { GROUP_DATA } from '../../data/groupPracticeData';
import { useStageCanvasResize } from '../../hooks/useStageCanvasResize';
import {
  filterVisibleStageMembers,
  renderGroupStudioFrame,
  type GroupStudioRendererOptions,
} from '../../services/rendering/GroupStudioRenderer';
import { applySkeletonFormationPipeline } from '../../services/rendering/SkeletonFormationRender';
import type { SkeletonRenderTransform } from '../../utils/SkeletonRenderTransform';
import type { FormationHole, FormationTimeline } from '../../types/danceDatabase';

export interface GroupStageCanvasProps {
  /** referenceFrames[currentFrame] — 렌더러 유일 입력 */
  referenceFrame?: SkeletonFrameData | null;
  groupId?: string;
  focusMemberId?: string;
  formationTimeline?: FormationTimeline | null;
  formationHole?: FormationHole | null;
  className?: string;
  canvasClassName?: string;
}

export interface GroupStageCanvasHandle {
  drawReferenceFrame: (
    frame: SkeletonFrameData | null | undefined,
    options?: GroupStudioRendererOptions,
  ) => SkeletonRenderTransform | null;
  clearReferenceFrame: () => void;
  resize: () => { width: number; height: number };
}

/**
 * Group Studio Stage Canvas — referenceFrames[currentFrame]만 렌더.
 */
const GroupStageCanvas = forwardRef<GroupStageCanvasHandle, GroupStageCanvasProps>(
  function GroupStageCanvas({
    referenceFrame = null,
    groupId = '',
    focusMemberId = '',
    formationTimeline = null,
    formationHole = null,
    className = '',
    canvasClassName = 'group-dance-stage-2d-canvas group-studio-stage-canvas',
  }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const { resizeCanvas } = useStageCanvasResize(canvasRef);

    const memberColorMap = useMemo(() => {
      const group = GROUP_DATA[groupId];
      const map: Record<string, { color: string; name: string }> = {};
      group?.members.forEach((m) => {
        map[m.id] = { color: m.color, name: m.nameKr };
      });
      return map;
    }, [groupId]);

    const buildFormationFrame = useCallback((
      frame: SkeletonFrameData,
      options: GroupStudioRendererOptions = {},
    ): SkeletonFrameData => {
      const effectiveGroupId = options.groupId ?? groupId;
      const effectiveFocusId = options.focusMemberId
        ?? focusMemberId
        ?? formationTimeline?.userMemberId
        ?? formationHole?.memberId
        ?? '';
      if (!effectiveGroupId || !effectiveFocusId) return frame;

      const visibleMembers = filterVisibleStageMembers(frame.members, effectiveFocusId);
      if (!visibleMembers.length) return { ...frame, members: [] };

      const group = GROUP_DATA[effectiveGroupId];
      if (!group) return { ...frame, members: visibleMembers };

      const userMember = group.members.find((m) => String(m.id) === String(effectiveFocusId));
      const effectiveFormationHole = options.formationHole ?? formationHole;
      const userAnchor = {
        x: effectiveFormationHole?.anchor?.x ?? userMember?.defaultX ?? 0.5,
        y: effectiveFormationHole?.anchor?.y ?? userMember?.defaultY ?? 0.5,
        z: effectiveFormationHole?.anchor?.z ?? 0,
      };

      const formationMembers = visibleMembers
        .map((member) => ({
          memberId: String(member.estimatedMemberId ?? member.trackId ?? ''),
          joints: member.joints,
          isEstimated: member.isEstimated,
        }))
        .filter((member) => member.memberId && String(member.memberId) !== String(effectiveFocusId));

      if (!formationMembers.length) return { ...frame, members: [] };

      const staged = applySkeletonFormationPipeline({
        members: formationMembers,
        groupId: effectiveGroupId,
        userMemberId: String(effectiveFocusId),
        userAnchor,
        timestamp: options.currentTimeSec ?? frame.timestamp ?? 0,
        formationTimeline: options.formationTimeline ?? formationTimeline ?? null,
        frameFormation: frame.formation ?? null,
        referenceUserSlot: effectiveFormationHole?.anchor ?? userAnchor,
        frameMembers: frame.members,
      });

      if (!staged.length) return { ...frame, members: visibleMembers };

      const stagedById = new Map(staged.map((member) => [String(member.memberId), member]));
      return {
        ...frame,
        members: visibleMembers.map((member) => {
          const memberId = String(member.estimatedMemberId ?? member.trackId ?? '');
          const stagedMember = stagedById.get(memberId);
          if (!stagedMember) return member;
          return {
            ...member,
            estimatedMemberId: member.estimatedMemberId ?? stagedMember.memberId,
            joints: stagedMember.joints,
            stageAnchor: stagedMember.stageAnchor,
          };
        }),
      };
    }, [groupId, focusMemberId, formationTimeline, formationHole]);

    const drawReferenceFrame = useCallback((
      frame: SkeletonFrameData | null | undefined,
      options: GroupStudioRendererOptions = {},
    ) => {
      const canvas = canvasRef.current;
      if (!canvas || !frame) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const size = resizeCanvas();
      const renderFrame = buildFormationFrame(frame, options);

      return renderGroupStudioFrame(ctx, canvas, renderFrame, {
        groupId: options.groupId ?? groupId,
        memberColorMap: options.memberColorMap ?? memberColorMap,
        focusMemberId: options.focusMemberId ?? focusMemberId,
        userMemberId: options.userMemberId ?? options.focusMemberId ?? focusMemberId,
        frameIndex: options.frameIndex,
        currentTimeSec: options.currentTimeSec,
        logicalSize: size,
        formationTimeline: options.formationTimeline ?? formationTimeline,
        formationHole: options.formationHole ?? formationHole,
      });
    }, [resizeCanvas, buildFormationFrame, memberColorMap, focusMemberId, formationTimeline, formationHole]);

    const clearReferenceFrame = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, []);

    useImperativeHandle(ref, () => ({
      drawReferenceFrame,
      clearReferenceFrame,
      resize: resizeCanvas,
    }), [drawReferenceFrame, clearReferenceFrame, resizeCanvas]);

    useEffect(() => {
      resizeCanvas();
      if (referenceFrame) drawReferenceFrame(referenceFrame);
    }, [resizeCanvas, drawReferenceFrame, referenceFrame]);

    return (
      <div className={`group-dance-stage-2d group-stage-canvas ${className}`.trim()}>
        <canvas
          ref={canvasRef}
          className={canvasClassName}
          aria-label="Group dance stage"
        />
      </div>
    );
  },
);

export default GroupStageCanvas;
