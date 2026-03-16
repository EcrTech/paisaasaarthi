import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IndianRupee, AlertTriangle, CheckCircle2, Clock, TrendingUp, Upload } from "lucide-react";
import { useEMIStats } from "@/hooks/useEMIStats";
import { useCollections, CollectionRecord } from "@/hooks/useCollections";
import { LoadingState } from "@/components/common/LoadingState";
import { CollectionsTable } from "@/components/LOS/Collections/CollectionsTable";
import { RecordPaymentDialog } from "@/components/LOS/Collections/RecordPaymentDialog";
import { CSVUploadDialog } from "@/components/LOS/Collections/CSVUploadDialog";
import DashboardLayout from "@/components/Layout/DashboardLayout";

export default function Collections() {
  const { data: stats, isLoading: statsLoading } = useEMIStats();
  const { collections, isLoading: collectionsLoading, recordPayment, isRecording, settleLoan, isSettling } = useCollections();
  const [selectedRecord, setSelectedRecord] = useState<CollectionRecord | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleRecordPayment = (record: CollectionRecord) => {
    setSelectedRecord(record);
    setPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = (data: Parameters<typeof recordPayment>[0]) => {
    recordPayment(data, {
      onSuccess: () => {
        setPaymentDialogOpen(false);
        setSelectedRecord(null);
      },
    });
  };

  if (statsLoading || collectionsLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading collections data..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Collections</h1>
          <p className="text-sm text-muted-foreground">EMI collection and repayment tracking</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCsvDialogOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          CSV Upload
        </Button>
      </div>

      {/* Compact Stats Row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Paid EMIs</p>
              <p className="text-xl font-bold text-green-600">{stats?.paidEMIs || 0}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-600/20" />
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Pending EMIs</p>
              <p className="text-xl font-bold text-yellow-600">{stats?.pendingEMIs || 0}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600/20" />
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Overdue EMIs</p>
              <p className="text-xl font-bold text-destructive">{stats?.overdueEMIs || 0}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-destructive/20" />
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Collection Rate</p>
              <p className="text-xl font-bold">{stats?.collectionRate?.toFixed(1) || 0}%</p>
              <p className="text-[10px] text-muted-foreground">
                {formatCurrency(stats?.totalCollected || 0)} / {formatCurrency(stats?.totalExpected || 0)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-primary/20" />
          </div>
        </Card>
      </div>

      {/* Collections Table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base flex items-center gap-2">
            <IndianRupee className="h-4 w-4" />
            EMI Schedule & Collections
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <CollectionsTable
            collections={collections}
            onRecordPayment={handleRecordPayment}
            onSettleLoan={settleLoan}
            isSettling={isSettling}
          />
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        record={selectedRecord}
        onSubmit={handlePaymentSubmit}
        isSubmitting={isRecording}
      />

      {/* CSV Upload Dialog */}
      <CSVUploadDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        collections={collections}
        onRecordPayment={recordPayment}
        isSubmitting={isRecording}
      />
    </DashboardLayout>
  );
}
