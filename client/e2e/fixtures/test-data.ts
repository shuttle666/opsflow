import type { TestInfo } from "@playwright/test";

export function uniqueTestValue(label: string, testInfo: TestInfo) {
  const suffix = `${testInfo.workerIndex}-${Date.now().toString(36)}`;
  return `E2E ${label} ${suffix}`;
}

export function futureDateTimeLocal(hoursFromNow: number) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
