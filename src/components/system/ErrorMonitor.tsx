import { installGlobalErrorMonitoring } from "@/lib/error-monitor";
import { useEffect } from "react";

export function ErrorMonitor() {
  useEffect(() => installGlobalErrorMonitoring(), []);
  return null;
}
