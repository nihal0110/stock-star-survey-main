import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvestmentEntry } from "@/types/investment";
import { Plus, Pencil } from "lucide-react";
import ConfirmDialog from "@/components/common/ConfirmDialog";

interface EntryFormProps {
  onAdd: (entry: Omit<InvestmentEntry, "id">) => void;
  onEdit: (entry: InvestmentEntry) => void;
  entries: InvestmentEntry[];
  onDelete: (id: string) => void;
}

const SECTORS = [
  "Technology",
  "Finance",
  "Banking",
  "Healthcare",
  "Energy",
  "FMCG",
  "Automobile",
  "Industrials",
  "Utilities",
  "Real Estate",
  "Materials",
  "Telecom",
  "Other",
  "Mutual Funds",
];

export default function EntryForm({
  onAdd,
  onEdit,
  entries,
  onDelete,
}: EntryFormProps) {
  const [form, setForm] = useState({
    stockName: "",
    sector: "Technology",
    date: new Date().toISOString().split("T")[0],
    amount: "",
    quantity: "",
    charges: "",
    code: "",
    notes: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleEdit = (entry: InvestmentEntry) => {
    setEditingId(entry.id);
    setForm({
      stockName: entry.stockName,
      sector: entry.sector,
      date: entry.date,
      amount: String(entry.amount),
      quantity: String(entry.quantity),
      charges: String(entry.charges),
      code: String(entry.code || ""),
      notes: entry.notes ?? "",
    });
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({
      stockName: "",
      sector: "Technology",
      date: new Date().toISOString().split("T")[0],
      amount: "",
      quantity: "",
      charges: "",
      code: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.stockName.trim() || !form.amount || !form.quantity) return;
    if (editingId) {
      onEdit({
        id: editingId,
        stockName: form.stockName.trim().toUpperCase(),
        sector: form.sector,
        date: form.date,
        amount: parseFloat(form.amount),
        quantity: parseFloat(form.quantity),
        charges: parseFloat(form.charges) || 0,
        code: String(form.code || ""),
        notes: form.notes.trim() || undefined,
      });
      setEditingId(null);
    } else {
      onAdd({
        stockName: form.stockName.trim().toUpperCase(),
        sector: form.sector,
        date: form.date,
        amount: parseFloat(form.amount),
        quantity: parseFloat(form.quantity),
        charges: parseFloat(form.charges) || 0,
        code: String(form.code || ""),
        notes: form.notes.trim() || undefined,
      });
    }
    setForm((prev) => ({
      ...prev,
      stockName: "",
      amount: "",
      quantity: "",
      charges: "",
      code: "",
      notes: "",
    }));
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-8">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 items-end"
      >
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Stock Name
          </Label>
          <Input
            value={form.stockName}
            onChange={(e) => update("stockName", e.target.value)}
            placeholder="e.g. RELIANCE"
            className="bg-secondary border-border font-mono"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Sector
          </Label>
          <select
            value={form.sector}
            onChange={(e) => update("sector", e.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Date
          </Label>
          <Input
            type="date"
            value={form.date}
            onChange={(e) => update("date", e.target.value)}
            className="bg-secondary border-border font-mono"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Amount (₹)
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => update("amount", e.target.value)}
            placeholder="0.00"
            className="bg-secondary border-border font-mono"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Quantity
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            placeholder="0"
            className="bg-secondary border-border font-mono"
            required
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Charges (₹)
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.charges}
            onChange={(e) => update("charges", e.target.value)}
            placeholder="0.00"
            className="bg-secondary border-border font-mono"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="gap-2 flex-1">
            {editingId ? (
              <>
                <Pencil className="h-4 w-4" /> Save
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add
              </>
            )}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}
        </div>
        <div className="space-y-2 col-span-2 md:col-span-3 lg:col-span-7">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Trade Notes <span className="normal-case text-muted-foreground/60">(why you bought — optional)</span>
          </Label>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="e.g. Strong Q3 results, management guidance positive, buying on dip…"
            rows={2}
            className="flex w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>
      </form>

      {entries.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Stock</th>
                  <th className="px-4 py-3 text-left">Sector</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Charges</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-t border-border hover:bg-secondary/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-primary">{entry.stockName}</span>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic max-w-xs truncate" title={entry.notes}>
                          {entry.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.sector}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {entry.date}
                    </td>
                    <td className="px-4 py-3 font-mono text-right">
                      ₹
                      {entry.amount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono text-right">
                      {entry.quantity}
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-muted-foreground">
                      ₹
                      {entry.charges.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleEdit(entry)}
                        className="text-primary hover:text-primary/80 text-xs font-medium transition-colors mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(entry.id)}
                        className="text-destructive hover:text-destructive/80 text-xs font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete stock entry?"
        description="This will permanently remove this purchase record."
        onConfirm={() => { onDelete(pendingDeleteId!); setPendingDeleteId(null); }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
