import { Board } from "@/hunt/Board";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Board code={code.toUpperCase()} role="participant" />;
}
