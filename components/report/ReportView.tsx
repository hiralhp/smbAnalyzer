"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Report } from "@/lib/types";
import { ReportLoading } from "./ReportLoading";
import { ReportError } from "./ReportError";
import { ReportComplete } from "./ReportComplete";

interface ReportViewProps {
  reportId: string;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40; // 2 minutes max

export function ReportView({ reportId }: ReportViewProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports/${reportId}`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Report not found");
      }
      const data = (await res.json()) as Report;
      setReport(data);
      return data.status;
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to load report"
      );
      return "failed";
    }
  }, [reportId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    fetchReport().then((status) => {
      if (status === "complete" || status === "failed") return;

      // Poll while pending/running
      let pollCount = 0;
      interval = setInterval(async () => {
        pollCount++;
        setPolls(pollCount);

        if (pollCount >= MAX_POLLS) {
          clearInterval(interval!);
          interval = null;
          setFetchError("Analysis timed out. Please try again.");
          return;
        }

        const s = await fetchReport();
        if (s === "complete" || s === "failed") {
          clearInterval(interval!);
          interval = null;
        }
      }, POLL_INTERVAL_MS);
    });

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  if (fetchError) {
    return <ReportError message={fetchError} />;
  }

  if (!report || report.status === "pending" || report.status === "running") {
    return (
      <ReportLoading
        businessName={report?.business.name}
        status={report?.status ?? "pending"}
        pollCount={polls}
      />
    );
  }

  if (report.status === "failed") {
    return (
      <ReportError
        message={report.errorMessage ?? "Analysis failed. Please try again."}
      />
    );
  }

  return <ReportComplete report={report} />;
}
