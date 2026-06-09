// @ts-nocheck
import React from 'react';
import '../../styles/group-studio.css';

export function CountdownOverlay({ count }) {
  if (count === null || count === undefined) return null;

  return (
    <div className="group-studio-countdown">
      {count > 0 ? (
        <div className="group-studio-countdown-num" key={count}>
          {count}
        </div>
      ) : (
        <div className="group-studio-countdown-start">START</div>
      )}
    </div>
  );
}

export default CountdownOverlay;
