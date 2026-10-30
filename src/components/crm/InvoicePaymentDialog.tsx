import { useEffect, useRef, useState } from "react";
import { CheckCircle } from "lucide-react";
import { crm, fmtMoney, type CrmInvoice } from "@/lib/crm";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/paymentMethods";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function todayInputValue() {
  return new Date().toLocaleDateString("en-CA");
}

function inputDateToIso(value: string) {
  if (!value) return null;
  // Noon local avoids the date shifting a day across time zones when stored as ISO.
  return new Date(`${value}T12:00:00`).toISOString();
}

interface MarkPaidDialogProps {
  invoice: CrmInvoice | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function MarkPaidDialog({ invoice, onClose, onSuccess }: MarkPaidDialogProps) {
  const [method, setMethod] = useState("e_transfer");
  const [paidDate, setPaidDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track whether Select is open so we can prevent dialog close during selection
  const selectOpenRef = useRef(false);

  // Reset state when a new invoice is opened
  const invoiceId = invoice?.id;
  useEffect(() => {
    if (invoiceId) {
      setMethod("e_transfer");
      setPaidDate(todayInputValue());
      setNotes("");
      setError(null);
    }
  }, [invoiceId]);

  const handleSubmit = async () => {
    if (!invoice) return;
    setSaving(true);
    setError(null);
    try {
      await crm("invoices.markPaid", {
        id: invoice.id,
        payment_method: method,
        paid_at: inputDateToIso(paidDate),
        notes: notes.trim() || null,
      });
      onSuccess();
    } catch (e) {
      setError((e as Error).message ?? "Failed to mark as paid");
    } finally {
      setSaving(false);
    }
  };

  const methodLabel = paymentMethodLabel(method);

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => { if (!open && !selectOpenRef.current) onClose(); }}>
      <DialogContent
        className="sm:max-w-md"
        // Prevent the dialog from closing when the Select portal (or any radix portal) fires pointer-down outside
        onPointerDownOutside={(e) => {
          const target = e.target as Element | null;
          if (target?.closest("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          const target = e.target as Element | null;
          if (target?.closest("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        {invoice && (
          <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
            {/* Invoice summary */}
            <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Invoice</span>
                <span className="text-sm font-mono font-semibold text-foreground">
                  {invoice.number ?? invoice.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Client</span>
                <span className="text-sm text-foreground">{invoice.client_name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Amount</span>
                <span className="text-sm font-bold text-foreground">
                  {fmtMoney(invoice.total_cents, invoice.currency)}
                </span>
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select
                value={method}
                onValueChange={(v) => { setMethod(v); }}
                onOpenChange={(open) => { selectOpenRef.current = open; }}
              >
                <SelectTrigger id="payment-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment date */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-date">Payment Date</Label>
              <Input
                id="payment-date"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>

            {/* Deposit notes — rendered as native textarea to avoid portal issues */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-notes">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                ref={textareaRef}
                id="payment-notes"
                placeholder={`e.g. Received via ${methodLabel} — ref #C1A7ghRnhsdV`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onClick={() => textareaRef.current?.focus()}
                rows={3}
                className="resize-none"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            <CheckCircle className="w-4 h-4" />
            {saving ? "Saving…" : "Mark as Paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditPaymentDialogProps {
  invoice: CrmInvoice | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditPaymentDialog({ invoice, onClose, onSuccess }: EditPaymentDialogProps) {
  const [method, setMethod] = useState("e_transfer");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectOpenRef = useRef(false);

  const invoiceId = invoice?.id;
  useEffect(() => {
    if (invoice) {
      setMethod(invoice.payment_method ?? "e_transfer");
      setNotes(invoice.payment_notes ?? "");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const handleSubmit = async () => {
    if (!invoice) return;
    setSaving(true);
    setError(null);
    try {
      await crm("invoices.updatePaymentDetails", {
        id: invoice.id,
        payment_method: method,
        notes: notes.trim() || null,
      });
      onSuccess();
    } catch (e) {
      setError((e as Error).message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => { if (!open && !selectOpenRef.current) onClose(); }}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          const t = e.target as Element | null;
          if (t?.closest("[data-radix-popper-content-wrapper]")) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          const t = e.target as Element | null;
          if (t?.closest("[data-radix-popper-content-wrapper]")) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit Payment Details</DialogTitle>
        </DialogHeader>
        {invoice && (
          <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
            <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Invoice</span>
                <span className="text-sm font-mono font-semibold">{invoice.number ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Client</span>
                <span className="text-sm">{invoice.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Amount</span>
                <span className="text-sm font-bold">{fmtMoney(invoice.total_cents, invoice.currency)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={method} onValueChange={setMethod} onOpenChange={(o) => { selectOpenRef.current = o; }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-pay-notes">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="edit-pay-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. e-Transfer received Jul 3, ref #12345"
                rows={3}
                className="resize-none"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            <CheckCircle className="w-4 h-4" />
            {saving ? "Saving…" : "Save Details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
