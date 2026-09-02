import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OrganizerLayout } from "@/organizer/OrganizerLayout";

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  return { title: `Organize ${code.toUpperCase()}` };
}

export default async function Layout({ params, children }: Params & { children: ReactNode }) {
  const { code } = await params;
  return <OrganizerLayout code={code.toUpperCase()}>{children}</OrganizerLayout>;
}
