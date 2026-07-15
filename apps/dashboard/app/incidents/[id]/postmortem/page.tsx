"use client";

import { useParams } from "next/navigation";
import { PostmortemView } from "@/components/postmortem/PostmortemView";

export default function PostmortemPage() {
  const params = useParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!id) return null;

  return <PostmortemView id={id} />;
}
