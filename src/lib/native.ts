import { Capacitor } from "@capacitor/core";

/** True when running inside the Capacitor native shell (Android/iOS), false in a browser. */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** "android" | "ios" | "web" */
export function getPlatform(): string {
  try {
    return Capacitor.getPlatform();
  } catch {
    return "web";
  }
}

export function isAndroidNative(): boolean {
  return isNative() && getPlatform() === "android";
}
