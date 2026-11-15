import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { CompanyEditor } from "@/components/recorder/CompanyEditor";
import { ErrorNote } from "@/components/recorder/RecorderBits";

export function ContentStudioCompanyPage() {
  const { companyId } = useParams<{ companyId: string }>();

  return (
    <DashboardLayout>
      <TopBar title="Content Studio" subtitle="Company brand, locations and campaigns sent to the recorder" />
      {companyId ? <CompanyEditor companyId={companyId} /> : <div className="p-6"><ErrorNote message="Company not found." /></div>}
    </DashboardLayout>
  );
}
