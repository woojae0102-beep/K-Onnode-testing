// @ts-nocheck
import {
  resolveGroupFromTrendItem,
  ensureGroupForTrendItem,
} from '../services/groupRegistryService';

export { resolveGroupFromTrendItem, ensureGroupForTrendItem };

/** @deprecated resolveGroupFromTrendItem 사용 권장 */
export function inferGroupId(...texts) {
  const item = {
    title: texts.join(' '),
    artist: texts[0] || '',
    channel: texts[1] || '',
  };
  return resolveGroupFromTrendItem(item).groupId;
}

export function inferGroupIdFromTrendItem(item) {
  return resolveGroupFromTrendItem(item).groupId;
}

export default inferGroupId;
