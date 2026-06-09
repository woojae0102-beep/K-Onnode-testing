// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { saveAuditionPractice } from '../utils/saveAuditionPractice';

export function useAuditionPracticeSave(agencyId, finalResult) {
  const [comparison, setComparison] = useState(null);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!finalResult || savedRef.current) return;
    savedRef.current = true;
    setComparison(saveAuditionPractice(agencyId, finalResult));
  }, [agencyId, finalResult]);

  return comparison;
}

export default useAuditionPracticeSave;
