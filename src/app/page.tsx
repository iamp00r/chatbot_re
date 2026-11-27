import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center gap-6 px-6 py-24">
      <p className="text-sm text-muted-foreground">가칭 · 개발 중</p>
      <h1 className="text-4xl font-semibold tracking-tight">Loom</h1>
      <p className="text-lg leading-8 text-muted-foreground">
        기억이 보이고, 고칠 수 있는 AI 캐릭터 채팅.
      </p>
      <Button disabled>곧 시작합니다</Button>
    </main>
  );
}
