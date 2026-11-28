import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인 · Loom" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Loom</h1>
        <p className="text-muted-foreground">기억이 보이고, 고칠 수 있는 AI 캐릭터 채팅.</p>
      </div>
      {/* 주소의 ?next·?error를 읽으므로 요청 시점에 그린다 */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
