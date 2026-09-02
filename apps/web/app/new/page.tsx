import type { Metadata } from "next";
import { NewEvent } from "@/home/NewEvent";

export const metadata: Metadata = { title: "New hunt" };

export default function Page() {
  return <NewEvent />;
}
