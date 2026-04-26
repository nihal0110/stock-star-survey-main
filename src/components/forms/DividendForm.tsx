import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DividendEntry, InvestmentEntry } from "@/types/investment";
import { Plus, Pencil, Gift } from "lucide-react";
import ConfirmDialog from "@/components/common/ConfirmDialog";

interface Props {
  entries: InvestmentEntry[];
  dividendEntries: DividendEntry[];
  onAdd: (entry: Omit<DividendEntry, "id">) => void;
  onEdit: (entry: DividendEntry) => void;
  onDelete: (id: string) => void;
}

export default function DividendForm({
  entries,
  dividendEntries,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const stockNames = Array.from(new Set(entries.map((e) => e.stockName))).sort();

  const [form, setForm] = useState({
    stockName: stockNames[0] ?? "",
    date: new Date().toISOString().split("T")[0],
    amount: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleEdit = (entry: DividendEntry) => {
    setEditingId(entry.id);
    setForm({
      stockName: entry.stockName,
      date: entry.date,
      amount: String(entry.amount),
    });
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({
      stockName: stockNames[0] ?? "",
      date: new Date().toISOString().split("T")[0],
      amount: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.stockName || !form.amount) return;
    if (editingId) {
      onEdit({
        id: editingId,
        stockName: form.stockName,
        date: form.date,
        amount: parseFloat(form.amount),
      });
      setEditingId(null);
    } else {
      onAdd({
        stockName: form.stockName,
        date: form.date,
        amount: parseFloat(form.amount),
      });
    }
    setForm((prev) => ({ ...prev, amount: "" }));
  };

  const totalByStock = dividendEntries.reduce<Record<string, number>>((acc, d) => {
    acc[d.stockName] = (acc[d.stockName] ?? 0) + d.amount;
    return acc;
  }, {});

  if (stockNames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Gift className="h-12 w-12 mb-4 opacity-30" />
        <p>No stocks found. Add stock entries first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary per stock */}
      {Object.keys(totalByStock).length > 0 && (
        <div>
          <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Dividend Summary by Stock
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(totalByStock)
              .sort((a, b) => b[1] - a[1])
              .map(([stock, total]) => (
                <div key={stock} className="rounded-lg border border-border bg-card p-4">
                  <p className="font-mono font-semibold text-primary text-sm">{stock}</p>
                  <p className="text-xl font-mono font-bold text-green-500 mt-1">
                    ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dividendEntries.filter((d) => d.stockName === stock).length} payment(s)
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Add / Edit Form */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end"
      >
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Stock
          </Label>
          <select
            value={form.stockName}
            onChange={(e) => update("stockName", e.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          >
            {stockNames.map((s) => (
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
            Total Amount Received (₹)
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
      </form>

      {/* Dividend Entries Table */}
      {dividendEntries.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Stock</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Amount Received</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {[...dividendEntries]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-t border-border hover:bg-secondary/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-primary">
                        {entry.stockName}
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {entry.date}
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-green-500 font-semibold">
                        ₹{entry.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/50">
                  <td className="px-4 py-3 font-semibold text-xs uppercase tracking-wider" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-3 font-mono text-right font-bold text-green-500">
                    ₹
                    {dividendEntries
                      .reduce((s, d) => s + d.amount, 0)
                      .toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete dividend entry?"
        description="This will permanently remove this dividend record."
        onConfirm={() => { onDelete(pendingDeleteId!); setPendingDeleteId(null); }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
