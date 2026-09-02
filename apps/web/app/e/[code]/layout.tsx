/**
 * The join link is what gets pasted into a group chat, so this layout is a
 * server component: it puts the hunt's name and description in the page
 * metadata for the unfurl, then hands the shell to the client.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { findEvent } from "@/api/events/load";
import { HuntLayout } from "@/hunt/HuntLayout";

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  try {
    const event = await findEvent(code);
    return { title: event.name, description: event.description ?? `Join the hunt with code ${event.code}` };
  } catch {
    return { title: "Join a hunt" };
  }
}

export default async function Layout({ params, children }: Params & { children: ReactNode }) {
  const { code } = await params;
  return <HuntLayout code={code.toUpperCase()}>{children}</HuntLayout>;
}
