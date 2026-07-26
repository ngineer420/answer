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

// How many requests are in flight, so something on screen can say so.
//
// Counted at the axios instance rather than per page, because the thing users
// actually notice is not one slow list: it is pressing Save and getting no
// acknowledgement, then pressing it again. Every request goes through one
// interceptor pair, so one counter covers saving, navigation and loading
// without each page having to remember to report itself.

type Listener = (count: number) => void;

let inFlight = 0;
const listeners = new Set<Listener>();

const emit = () => {
  listeners.forEach((listener) => listener(inFlight));
};

export const requestStarted = () => {
  inFlight += 1;
  emit();
};

export const requestFinished = () => {
  // Never go negative. An interceptor that fires its error path after its
  // success path would otherwise leave the counter stuck below zero, and the
  // indicator would never show again.
  inFlight = Math.max(0, inFlight - 1);
  emit();
};

export const subscribeToPendingRequests = (listener: Listener) => {
  listeners.add(listener);
  listener(inFlight);
  return () => {
    listeners.delete(listener);
  };
};
