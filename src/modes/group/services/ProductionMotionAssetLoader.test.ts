// @ts-nocheck
/**
 * ProductionMotionAssetLoader validation tests (TEST 13~18)
 * Run: npx tsx src/modes/group/services/ProductionMotionAssetLoader.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';
import {
  loadProductionMotionAsset,
  validateProductionMotionAssetV2,
  registerTestProductionMotionAsset,
  clearTestProductionMotionAssets,
} from './ProductionMotionAssetLoader';
import {
  PRODUCTION_MOTION_ERRORS,
  ProductionMotionAssetError,
} from '../types/ProductionMotionAssetV2';
import { PRODUCTION_MOTION_TEST_CONTRACT } from '../fixtures/productionMotionTestContract';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function cloneAsset() {
  return JSON.parse(JSON.stringify(PRODUCTION_MOTION_TEST_CONTRACT));
}

async function test13() {
  clearTestProductionMotionAssets();
  let threw = false;
  try {
    await loadProductionMotionAsset({ groupId: 'missing', songId: 'missing-song' });
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_NOT_FOUND,
      'TEST 13: PRODUCTION_ASSET_NOT_FOUND',
    );
  }
  assert(threw, 'TEST 13: should throw');
  console.log('TEST 13: PASS');
}

function test14() {
  const asset = cloneAsset();
  asset.status = 'draft';
  let threw = false;
  try {
    validateProductionMotionAssetV2(asset);
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_NOT_READY,
      'TEST 14',
    );
  }
  assert(threw, 'TEST 14: should throw');
  console.log('TEST 14: PASS');
}

function test15() {
  const asset = cloneAsset();
  asset.status = 'processing';
  let threw = false;
  try {
    validateProductionMotionAssetV2(asset);
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.PRODUCTION_ASSET_NOT_READY,
      'TEST 15',
    );
  }
  assert(threw, 'TEST 15: should throw');
  console.log('TEST 15: PASS');
}

function test16() {
  const asset = cloneAsset();
  asset.members[1].motion.motionUrl = '';
  let threw = false;
  try {
    validateProductionMotionAssetV2(asset);
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.MEMBER_MOTION_ASSET_MISSING,
      'TEST 16',
    );
  }
  assert(threw, 'TEST 16: should throw');
  console.log('TEST 16: PASS');
}

function test17() {
  const asset = cloneAsset();
  asset.members[2].avatar.glbUrl = '';
  let threw = false;
  try {
    validateProductionMotionAssetV2(asset);
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.MEMBER_AVATAR_ASSET_MISSING,
      'TEST 17',
    );
  }
  assert(threw, 'TEST 17: should throw');
  console.log('TEST 17: PASS');
}

function test18() {
  const asset = cloneAsset();
  asset.members[0].motion.motionFormat = 'fbx_animation' as any;
  let threw = false;
  try {
    validateProductionMotionAssetV2(asset);
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.MOTION_FORMAT_UNSUPPORTED,
      'TEST 18',
    );
  }
  assert(threw, 'TEST 18: should throw');
  console.log('TEST 18: PASS');
}

function test19DuplicateMotionId() {
  const asset = cloneAsset();
  asset.members[1].motion.motionAssetId = asset.members[0].motion.motionAssetId;
  let threw = false;
  try {
    validateProductionMotionAssetV2(asset);
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_ASSET_ID,
      'TEST duplicate motionAssetId',
    );
  }
  assert(threw, 'duplicate motionAssetId should throw');
  console.log('TEST duplicate motionAssetId: PASS');
}

function test20DuplicateMotionUrl() {
  const asset = cloneAsset();
  asset.members[1].motion.motionUrl = asset.members[0].motion.motionUrl;
  let threw = false;
  try {
    validateProductionMotionAssetV2(asset);
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.DUPLICATE_MOTION_URL,
      'TEST duplicate motionUrl',
    );
  }
  assert(threw, 'duplicate motionUrl should throw');
  console.log('TEST duplicate motionUrl: PASS');
}

function test21InvalidDuration() {
  const asset = cloneAsset();
  asset.members[0].motion.durationSec = 0;
  let threw = false;
  try {
    validateProductionMotionAssetV2(asset);
  } catch (err) {
    threw = true;
    assert(
      err instanceof ProductionMotionAssetError
      && err.code === PRODUCTION_MOTION_ERRORS.INVALID_MOTION_DURATION,
      'TEST invalid duration',
    );
  }
  assert(threw, 'invalid duration should throw');
  console.log('TEST INVALID_MOTION_DURATION: PASS');
}

async function testRegistryLoad() {
  clearTestProductionMotionAssets();
  registerTestProductionMotionAsset(cloneAsset());
  const { asset, source } = await loadProductionMotionAsset({
    groupId: PRODUCTION_MOTION_TEST_CONTRACT.groupId,
    songId: PRODUCTION_MOTION_TEST_CONTRACT.songId,
  });
  assert(source === 'test_registry', 'registry source');
  assert(asset.members.length === 4, '4 members');
  console.log('TEST registry load: PASS');
}

async function run() {
  await test13();
  test14();
  test15();
  test16();
  test17();
  test18();
  test19DuplicateMotionId();
  test20DuplicateMotionUrl();
  test21InvalidDuration();
  await testRegistryLoad();
  clearTestProductionMotionAssets();
  console.log('ProductionMotionAssetLoader tests: ALL PASS');
}

run().catch((err) => {
  console.error(err);
  throw err;
});
