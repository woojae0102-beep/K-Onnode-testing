// @ts-nocheck
/**
 * 대용량 프레임(수천 개) 동기 처리 시 메인 스레드를 장시간 블로킹하면
 * 브라우저가 "페이지가 응답하지 않습니다" 경고를 띄운다.
 * 무거운 파이프라인 단계 사이에 짧게 이벤트 루프를 양보(yield)하여
 * 입력/페인트가 계속 처리되도록 한다.
 */
export function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (globalThis as any).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * 배열을 순회하며 chunkSize 개마다 메인 스레드를 양보한다.
 * 반복문 로직 자체는 fn 콜백에서 처리한다 (index 기반).
 */
export async function yieldEvery(index: number, chunkSize = 200): Promise<void> {
  if (index > 0 && index % chunkSize === 0) {
    await yieldToMainThread();
  }
}
