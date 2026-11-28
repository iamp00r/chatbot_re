import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getProfile, requireUser } from "@/lib/auth/dal";
import { suggestNickname } from "@/lib/auth/nickname";

import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "시작하기 · Loom" };

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">처음 오셨네요</h1>
        <p className="text-muted-foreground">
          대화에서 쓸 닉네임을 정해 주세요. 나중에 바꿀 수 있어요.
        </p>
      </div>
      <Suspense>
        <Onboarding />
      </Suspense>
    </main>
  );
}

async function Onboarding() {
  const user = await requireUser();
  if (await getProfile(user.id)) redirect("/");
  return <OnboardingForm defaultNickname={suggestNickname(user.metadata)} />;
}
