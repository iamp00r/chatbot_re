import { Suspense } from "react";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth/dal";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center gap-6 px-6 py-24">
      <p className="text-sm text-muted-foreground">가칭 · 개발 중</p>
      <h1 className="text-4xl font-semibold tracking-tight">Loom</h1>
      <p className="text-lg leading-8 text-muted-foreground">
        기억이 보이고, 고칠 수 있는 AI 캐릭터 채팅.
      </p>
      {/* 세션을 읽는 부분만 요청 시점에 스트리밍한다 */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">불러오는 중…</p>}>
        <Greeting />
      </Suspense>
    </main>
  );
}

async function Greeting() {
  const { profile } = await requireProfile();
  return (
    <div className="flex items-center gap-4">
      <p>
        <span className="font-medium">{profile.nickname}</span>님, 반가워요.
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">
          로그아웃
        </Button>
      </form>
    </div>
  );
}
