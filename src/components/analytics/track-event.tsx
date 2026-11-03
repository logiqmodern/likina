"use client";

import { useEffect, useRef } from "react";
import type { EventName, EventParams } from "@/lib/analytics/events";
import { track, trackOnce } from "@/lib/analytics/track";

/**
 * Sends one analytics event when it mounts — for server-rendered pages that
 * know what happened (confirmed booking, landing page of a service).
 * `onceKey` sends it once per browser (a reload does not count twice).
 * Params must not contain personal data.
 */
export function TrackEvent({
  event,
  params,
  onceKey,
  eventId,
}: {
  event: EventName;
  params?: EventParams;
  onceKey?: string;
  eventId?: string;
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const opts = eventId ? { eventId } : {};
    if (onceKey) trackOnce(onceKey, event, params, opts);
    else track(event, params, opts);
  }, [event, params, onceKey, eventId]);
  return null;
}
