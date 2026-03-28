import { ReportView } from "@/components/report/ReportView";

export const metadata = {
  title: "Your AI Visibility Report",
};

export default function ReportPage({ params }: { params: { id: string } }) {
  return <ReportView reportId={params.id} />;
}
