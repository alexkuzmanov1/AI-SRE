"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIncidentClient } from "@/lib/client/provider";
import { Skeleton } from "@/components/ui/Skeleton";

/** Redirects to the first incident. Shows a light skeleton while resolving. */
export default function HomePage() {
  const client = useIncidentClient();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    client
      .listIncidents("all")
      .then((incidents) => {
        if (!active) return;
        if (incidents.length > 0) {
          router.replace(`/incidents/${incidents[0].id}`);
        }
      })
      .catch(() => {
        /* handled by the incident view's error states */
      });
    return () => {
      active = false;
    };
  }, [client, router]);

  return (
    <div className="flex h-full">
      <div className="hidden w-[316px] flex-none flex-col gap-3 border-r border-border-subtle p-4 md:flex">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-7">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-4 h-16 w-full max-w-xl" />
        <Skeleton className="h-16 w-full max-w-xl" />
      </div>
    </div>
  );
}
