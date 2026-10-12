import { useEffect, useState } from "react";

const currentTime = () => Date.now();

/** The current time in ms, refreshed every `intervalMs`, for labels such as "Due in 5m". */
export const useNow = (intervalMs = 60_000) => {
  const [now, setNow] = useState(currentTime);

  useEffect(() => {
    const id = window.setInterval(() => setNow(currentTime()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
};
