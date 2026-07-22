// @ts-nocheck
/**
 * Browser WebGL renderer probe (PHASE 17 — read-only, optional).
 */
import * as THREE from 'three';
import type { WebGLRenderer } from 'three';

export type RendererInfoSnapshot = {
  drawCalls: number | null;
  triangles: number | null;
  points: number | null;
  lines: number | null;
  geometries: number | null;
  textures: number | null;
  programs: number | null;
  measured: boolean;
  note?: string;
};

export function snapshotRendererInfo(renderer: WebGLRenderer | null | undefined): RendererInfoSnapshot {
  if (!renderer?.info) {
    return {
      drawCalls: null,
      triangles: null,
      points: null,
      lines: null,
      geometries: null,
      textures: null,
      programs: null,
      measured: false,
      note: 'renderer unavailable',
    };
  }
  renderer.info.reset?.();
  const render = renderer.info.render;
  const memory = renderer.info.memory;
  const programs = renderer.info.programs?.length ?? null;
  return {
    drawCalls: render?.calls ?? null,
    triangles: render?.triangles ?? null,
    points: render?.points ?? null,
    lines: render?.lines ?? null,
    geometries: memory?.geometries ?? null,
    textures: memory?.textures ?? null,
    programs,
    measured: true,
  };
}

export function tryCreateHeadlessRendererProbe(): RendererInfoSnapshot {
  if (typeof document === 'undefined') {
    return snapshotRendererInfo(null);
  }
  try {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    renderer.setSize(64, 64);
    renderer.render(new THREE.Scene(), new THREE.PerspectiveCamera());
    const snap = snapshotRendererInfo(renderer);
    renderer.dispose();
    return snap;
  } catch (err) {
    return {
      drawCalls: null,
      triangles: null,
      points: null,
      lines: null,
      geometries: null,
      textures: null,
      programs: null,
      measured: false,
      note: (err as Error)?.message || 'WebGL probe failed',
    };
  }
}

export default snapshotRendererInfo;
