import { useEffect } from "react";
import { api } from "@/utils/trpc/api";

export function useSnapshotSync() {
  // grab the mutation
  const takeSnapshots = api.snapshot.takeHourlySnapshots.useMutation({
    onError(err) {
      console.warn("Snapshot update failed:", err);
    },
  });

  useEffect(() => {
    // run immediately
    takeSnapshots.mutate(undefined);

    // run every minute
    const interval = setInterval(() => takeSnapshots.mutate(), 60_000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
