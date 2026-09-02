import { Feed } from "@/hunt/Feed";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Feed code={code.toUpperCase()} role="organizer" />;
}
