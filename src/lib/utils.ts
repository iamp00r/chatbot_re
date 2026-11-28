import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind 클래스를 조건부로 합치고, 충돌하는 클래스는 뒤의 것을 남긴다. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
