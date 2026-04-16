import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoldEntry } from "@/types/investment";
import { Plus, Pencil } from "lucide-react";

interface Props {
  onAdd: (entry: Omit<GoldEntry, "id">) => void;
  onEdit: (entry: GoldEntry) => void;
  entries: GoldEntry[];
  onDelete: (id: string) => void;
}

export default function GoldEntryForm({ onAdd, onEdit, entries, onDelete }: Props) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    quantity: "",
    charges: "",
    amount: "",
    tax: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleEdit = (entry: GoldEntry) => {
    setEditingId(entry.id);
    setForm({
      date: entry.date,
      quantity: String(entry.quantity),
      charges: String(entry.charges),
      amount: String(entry.amount),
      tax: String(entry.tax),
    });
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({
      date: new Date().toISOString().split("T")[0],
      quantity: "",
      charges: "",
      amount: "",
      tax: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.quantity) return;
    if (editingId) {
      onEdit({
        id: editingId,
        date: form.date,
        quantity: parseFloat(form.quantity),
        charges: parseFloat(form.charges) || 0,
        amount: parseFloat(form.amount),
        tax: parseFloat(form.tax) || 0,
      });
      setEditingId(null);
    } else {
      onAdd({
        date: form.date,
        quantity: parseFloat(form.quantity),
        charges: parseFloat(form.charges) || 0,
        amount: parseFloat(form.amount),
        tax: parseFloat(form.tax),
      });
    }
    setForm((prev) => ({ ...prev, quantity: "", charges: "", amount: "" }));
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-8">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end"
      >
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Date of Purchase
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
            Quantity (grams)
          </Label>
          <Input
            type="number"
            step="0.001"
            min="0"
            value={form.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            placeholder="0.000"
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
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Tax (₹)
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.tax}
            onChange={(e) => update("tax", e.target.value)}
            placeholder="0.00"
            className="bg-secondary border-border font-mono"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="gap-2 flex-1">
            {editingId ? (
              <><Pencil className="h-4 w-4" /> Save</>
            ) : (
              <><Plus className="h-4 w-4" /> Add</>
            )}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {entries?.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Quantity (g)</th>
                  <th className="px-4 py-3 text-right">Amount</th>
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
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {entry.date}
                    </td>
                    <td className="px-4 py-3 font-mono text-right">
                      {entry.quantity}
                    </td>
                    <td className="px-4 py-3 font-mono text-right">
                      ₹
                      {entry.amount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
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
                        onClick={() => onDelete(entry.id)}
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
    </div>
  );
}
