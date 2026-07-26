/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { FC, memo, useEffect, useRef, useState } from 'react';

import { subscribeToPendingRequests } from '@/utils/pendingRequests';

import './index.scss';

// Nothing appears before this. Most requests finish inside it, and a bar that
// flickers on every keystroke-triggered lookup is worse than no bar: it reads as
// the page glitching rather than working.
const SHOW_AFTER_MS = 180;

// Held briefly at full width so a fast request still registers as having
// happened, instead of the bar vanishing the instant it appeared.
const HOLD_AT_DONE_MS = 220;

const RequestProgress: FC = () => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const showTimer = useRef<ReturnType<typeof setTimeout>>();
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const creepTimer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const stopCreeping = () => {
      if (creepTimer.current) clearInterval(creepTimer.current);
      creepTimer.current = undefined;
    };

    const unsubscribe = subscribeToPendingRequests((count) => {
      if (count > 0) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        if (showTimer.current || visible) return;

        showTimer.current = setTimeout(() => {
          showTimer.current = undefined;
          setVisible(true);
          setProgress(12);
          // Creeps toward, but never reaches, the end. The bar cannot know how
          // long the server will take, and a bar that stalls at a believable
          // 80% reads as progress where one that sits at 100% reads as broken.
          creepTimer.current = setInterval(() => {
            setProgress((current) =>
              current >= 90 ? current : current + (90 - current) * 0.12,
            );
          }, 220);
        }, SHOW_AFTER_MS);
        return;
      }

      // Settled.
      if (showTimer.current) {
        clearTimeout(showTimer.current);
        showTimer.current = undefined;
      }
      stopCreeping();
      setProgress((current) => (current > 0 ? 100 : 0));
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, HOLD_AT_DONE_MS);
    });

    return () => {
      unsubscribe();
      stopCreeping();
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [visible]);

  return (
    <div
      className="request-progress"
      data-visible={visible ? 'true' : 'false'}
      role="progressbar"
      aria-hidden={!visible}
      aria-label="Loading">
      <div
        className="request-progress__bar"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default memo(RequestProgress);
