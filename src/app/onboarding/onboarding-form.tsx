"use client";

import { useActionState } from "react";

import { createProfile, type OnboardingState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NICKNAME_MAX } from "@/lib/auth/nickname";

const initialState: OnboardingState = { error: null };

export function OnboardingForm({ defaultNickname }: { defaultNickname: string }) {
  const [state, formAction, pending] = useActionState(createProfile, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Label htmlFor="nickname">닉네임</Label>
      <Input
        id="nickname"
        name="nickname"
        defaultValue={defaultNickname}
        maxLength={NICKNAME_MAX}
        autoComplete="nickname"
        required
        autoFocus
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "nickname-error" : undefined}
      />
      {state.error && (
        <p id="nickname-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "저장 중…" : "시작하기"}
      </Button>
    </form>
  );
}
