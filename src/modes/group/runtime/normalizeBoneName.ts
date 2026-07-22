// @ts-nocheck
/**
 * Bone name normalization — vendor-neutral (RPM/GX10/mixamo).
 */

export type BoneSide = 'L' | 'R' | null;

const PREFIXES = ['mixamorig:', 'armature:', 'rig:'];

export function stripBonePrefixes(name: string): string {
  let out = name.trim();
  for (const prefix of PREFIXES) {
    if (out.toLowerCase().startsWith(prefix.toLowerCase())) {
      out = out.slice(prefix.length);
      break;
    }
  }
  out = out.replace(/^mixamorig(?=[A-Z])/i, '');
  out = out.replace(/^armature(?=[A-Z_])/i, '');
  return out;
}

export function detectBoneSide(name: string): BoneSide {
  const n = stripBonePrefixes(name.trim());

  if (/^left(?=[A-Z_]|$)/i.test(n) || /^l(?=[A-Z_])/i.test(n)) return 'L';
  if (/^right(?=[A-Z_]|$)/i.test(n) || /^r(?=[A-Z_])/i.test(n)) return 'R';

  if (/(^|[._])(l|left)$/i.test(n) || /Left$/i.test(n) || /_L$/i.test(n) || /\.L$/i.test(n)) {
    return 'L';
  }
  if (/(^|[._])(r|right)$/i.test(n) || /Right$/i.test(n) || /_R$/i.test(n) || /\.R$/i.test(n)) {
    return 'R';
  }
  return null;
}

/** Side token 제거 후 base name (lower-case) */
export function normalizeBoneBaseName(name: string): string {
  let base = stripBonePrefixes(name);
  base = base.replace(/^left(?=[A-Z_]|$)/i, '').replace(/^right(?=[A-Z_]|$)/i, '');
  base = base.replace(/^[lr](?=[A-Z_])/i, '');
  base = base.replace(/[._](l|r|left|right)$/i, '');
  base = base.replace(/Left$/i, '').replace(/Right$/i, '');
  base = base.replace(/_L$/i, '').replace(/_R$/i, '');
  base = base.replace(/\.L$/i, '').replace(/\.R$/i, '');
  return base.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function sidesCompatible(sourceSide: BoneSide, targetSide: BoneSide): boolean {
  if (sourceSide === null || targetSide === null) return true;
  return sourceSide === targetSide;
}

export default normalizeBoneBaseName;
