import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function BillingAffiliates() {
  return (
    <DashboardLayout>
      <TopBar title="Billing & Affiliates" subtitle="Manage usage, markups, and affiliate commissions." />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader><CardTitle>Usage & Billing</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Connected Accounts</TableHead>
                  <TableHead>Markup Tier</TableHead>
                  <TableHead>Billed Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Example Client</TableCell>
                  <TableCell>3</TableCell>
                  <TableCell>100%</TableCell>
                  <TableCell>$150.00</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Affiliate Payouts</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Referred Orgs</TableHead>
                  <TableHead>Commission (20%)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Partner A</TableCell>
                  <TableCell>2</TableCell>
                  <TableCell>$60.00</TableCell>
                  <TableCell>Pending</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
