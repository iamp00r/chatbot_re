"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_CALLBACK_PATH, safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  callback:
    "로그인을 끝내지 못했습니다. 링크가 만료됐거나 다른 브라우저에서 열었을 수 있어요. 다시 시도하세요.",
  denied: "로그인이 취소됐습니다.",
};

type Status =
  | { kind: "idle" }
  | { kind: "pending"; via: "google" | "email" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const errorCode = searchParams.get("error");
  const [status, setStatus] = useState<Status>(
    errorCode
      ? { kind: "error", message: ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.callback }
      : { kind: "idle" },
  );
  const pending = status.kind === "pending";

  function callbackUrl() {
    const url = new URL(AUTH_CALLBACK_PATH, window.location.origin);
    if (next !== "/") url.searchParams.set("next", next);
    return url.toString();
  }

  async function signInWithGoogle() {
    setStatus({ kind: "pending", via: "google" });
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    // 성공하면 Google 화면으로 이동하므로 여기에 오지 않는다
    if (error) setStatus({ kind: "error", message: "Google 로그인을 시작하지 못했습니다." });
  }

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setStatus({ kind: "pending", via: "email" });
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) {
      setStatus({
        kind: "error",
        message:
          error.status === 429
            ? "메일을 너무 자주 요청했습니다. 잠시 뒤 다시 시도하세요."
            : "메일을 보내지 못했습니다. 주소를 확인하세요.",
      });
      return;
    }
    setStatus({ kind: "sent", email });
  }

  if (status.kind === "sent") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-4" role="status">
        <p className="font-medium">메일을 보냈습니다</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{status.email}</span>로 보낸 로그인 링크를
          <strong> 이 브라우저에서</strong> 열어 주세요.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setStatus({ kind: "idle" })}>
          다른 주소로 받기
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {status.kind === "error" && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status.message}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={signInWithGoogle}
        disabled={pending}
      >
        {pending && status.via === "google" ? "Google로 이동 중…" : "Google로 계속하기"}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        또는
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={signInWithEmail} className="flex flex-col gap-3">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={pending}
        />
        <Button type="submit" disabled={pending}>
          {pending && status.via === "email" ? "보내는 중…" : "로그인 링크 받기"}
        </Button>
      </form>
    </div>
  );
}
