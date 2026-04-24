"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createPayrollComponent,
  createTaxProfile,
  deletePayrollComponent,
  deleteTaxProfile,
  getPayrollComponents,
  getTaxProfiles,
  updatePayrollComponent,
  updateTaxProfile,
  type PayrollComponentRecord,
  type TaxProfileRecord
} from "@/lib/api";

type ComponentForm = {
  id?: string;
  code: string;
  name: string;
  type: "earning" | "deduction";
  calculationType: "fixed" | "percentage";
  amount: string;
  percentage: string;
  taxable: boolean;
  active: boolean;
  description: string;
};

type TaxForm = {
  id?: string;
  name: string;
  rate: string;
  active: boolean;
  description: string;
};

function money(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

function emptyComponentForm(): ComponentForm {
  return { code: "", name: "", type: "earning", calculationType: "fixed", amount: "0", percentage: "0", taxable: true, active: true, description: "" };
}

function emptyTaxForm(): TaxForm {
  return { name: "", rate: "5", active: true, description: "" };
}

export function CompensationProfileWorkspace() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [componentForm, setComponentForm] = useState<ComponentForm>(emptyComponentForm());
  const [taxForm, setTaxForm] = useState<TaxForm>(emptyTaxForm());

  const componentQuery = useQuery({ queryKey: ["payroll-components"], queryFn: getPayrollComponents });
  const taxQuery = useQuery({ queryKey: ["tax-profiles"], queryFn: getTaxProfiles });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["payroll-components"] });
    await qc.invalidateQueries({ queryKey: ["tax-profiles"] });
    await qc.invalidateQueries({ queryKey: ["employees"] });
  };

  const saveComponent = useMutation({
    mutationFn: () => componentForm.id
      ? updatePayrollComponent(componentForm.id, {
          code: componentForm.code,
          name: componentForm.name,
          type: componentForm.type,
          calculationType: componentForm.calculationType,
          amount: Number(componentForm.amount),
          percentage: componentForm.calculationType === "percentage" ? Number(componentForm.percentage) : null,
          taxable: componentForm.taxable,
          active: componentForm.active,
          appliesToAll: false,
          description: componentForm.description,
          employeeIds: []
        })
      : createPayrollComponent({
          code: componentForm.code,
          name: componentForm.name,
          type: componentForm.type,
          calculationType: componentForm.calculationType,
          amount: Number(componentForm.amount),
          percentage: componentForm.calculationType === "percentage" ? Number(componentForm.percentage) : null,
          taxable: componentForm.taxable,
          active: componentForm.active,
          appliesToAll: false,
          description: componentForm.description,
          employeeIds: []
        }),
    onSuccess: async () => {
      setMessage(componentForm.id ? "Allowance / deduction rule updated successfully." : "Allowance / deduction rule added successfully.");
      setComponentForm(emptyComponentForm());
      await refresh();
    }
  });

  const saveTax = useMutation({
    mutationFn: () => taxForm.id
      ? updateTaxProfile(taxForm.id, { name: taxForm.name, rate: Number(taxForm.rate), active: taxForm.active, description: taxForm.description })
      : createTaxProfile({ name: taxForm.name, rate: Number(taxForm.rate), active: taxForm.active, description: taxForm.description }),
    onSuccess: async () => {
      setMessage("Tax profile saved successfully.");
      setTaxForm(emptyTaxForm());
      await refresh();
    }
  });

  const deleteComponent = useMutation({
    mutationFn: (id: string) => deletePayrollComponent(id),
    onSuccess: async () => {
      setMessage("Allowance / deduction rule deleted successfully.");
      setComponentForm(emptyComponentForm());
      await refresh();
    }
  });

  const deleteTax = useMutation({
    mutationFn: (id: string) => deleteTaxProfile(id),
    onSuccess: async () => {
      setMessage("Tax profile deleted successfully.");
      setTaxForm(emptyTaxForm());
      await refresh();
    }
  });

  const components = componentQuery.data ?? [];
  const taxProfiles = taxQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-start">
        <Link href="/employees" className="secondary-button">Back to Employee List</Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="page-card p-6">
          <p className="section-title text-[22px] font-semibold text-[var(--primary)]">Allowance & Deduction Master</p>
          <div className="mt-4 space-y-4">
            <Field label="Code" value={componentForm.code} onChange={(value) => setComponentForm((prev) => ({ ...prev, code: value }))} />
            <Field label="Name" value={componentForm.name} onChange={(value) => setComponentForm((prev) => ({ ...prev, name: value }))} />
            <Pick label="Type" value={componentForm.type} onChange={(value) => setComponentForm((prev) => ({ ...prev, type: value as ComponentForm["type"] }))} options={[["earning", "Allowance"], ["deduction", "Deduction"]]} />
            <Pick label="Calculation" value={componentForm.calculationType} onChange={(value) => setComponentForm((prev) => ({ ...prev, calculationType: value as ComponentForm["calculationType"] }))} options={[["fixed", "Fixed"], ["percentage", "Percentage"]]} />
            <Field label={componentForm.calculationType === "percentage" ? "Percentage" : "Amount"} type="number" value={componentForm.calculationType === "percentage" ? componentForm.percentage : componentForm.amount} onChange={(value) => componentForm.calculationType === "percentage" ? setComponentForm((prev) => ({ ...prev, percentage: value })) : setComponentForm((prev) => ({ ...prev, amount: value }))} />
            <Area label="Description" value={componentForm.description} onChange={(value) => setComponentForm((prev) => ({ ...prev, description: value }))} />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-[14px] text-[var(--text-muted)]"><input type="checkbox" checked={componentForm.taxable} onChange={(event) => setComponentForm((prev) => ({ ...prev, taxable: event.target.checked }))} /> Taxable</label>
                <label className="inline-flex items-center gap-2 text-[14px] text-[var(--text-muted)]"><input type="checkbox" checked={componentForm.active} onChange={(event) => setComponentForm((prev) => ({ ...prev, active: event.target.checked }))} /> Active</label>
              </div>
              <button className="primary-button" onClick={() => saveComponent.mutate()} disabled={saveComponent.isPending}>
                {saveComponent.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {componentForm.id ? "Update Item" : "Add Item"}
              </button>
            </div>
          </div>
        </section>

        <section className="page-card p-6">
          <p className="section-title text-[22px] font-semibold text-[var(--primary)]">Tax Profile Master</p>
          <div className="mt-4 space-y-4">
            <Field label="Name" value={taxForm.name} onChange={(value) => setTaxForm((prev) => ({ ...prev, name: value }))} />
            <Field label="Rate (%)" type="number" value={taxForm.rate} onChange={(value) => setTaxForm((prev) => ({ ...prev, rate: value }))} />
            <Area label="Description" value={taxForm.description} onChange={(value) => setTaxForm((prev) => ({ ...prev, description: value }))} />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <label className="inline-flex items-center gap-2 text-[14px] text-[var(--text-muted)]"><input type="checkbox" checked={taxForm.active} onChange={(event) => setTaxForm((prev) => ({ ...prev, active: event.target.checked }))} /> Active</label>
              <button className="primary-button" onClick={() => saveTax.mutate()} disabled={saveTax.isPending}>
                {saveTax.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {taxForm.id ? "Update Tax Profile" : "Add Tax Profile"}
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CatalogCard title="Allowance / Deduction Library" items={components.map((item) => ({ id: item.id, title: item.name, subtitle: item.type === "earning" ? "Allowance" : "Deduction", description: describeComponent(item), active: item.active, onEdit: () => setComponentForm({ id: item.id, code: item.code, name: item.name, type: item.type, calculationType: item.calculationType, amount: String(item.amount), percentage: String(item.percentage ?? 0), taxable: item.taxable, active: item.active, description: item.description }), onDelete: () => deleteComponent.mutate(item.id) }))} />
        <CatalogCard title="Tax Profile Library" items={taxProfiles.map((item) => ({ id: item.id, title: item.name, subtitle: `${item.rate}%`, description: item.description, active: item.active, onEdit: () => setTaxForm({ id: item.id, name: item.name, rate: String(item.rate), active: item.active, description: item.description }), onDelete: () => deleteTax.mutate(item.id) }))} />
      </div>

      {message ? <div className="page-card p-4 text-[14px] text-[var(--text-muted)]">{message}</div> : null}
    </div>
  );
}

function describeComponent(item: PayrollComponentRecord) {
  const value = item.calculationType === "percentage" ? `${item.percentage ?? 0}%` : money(item.amount);
  return `${value} • ${item.taxable ? "Taxable" : "Non-taxable"} • ${item.code}`;
}

function CatalogCard({ title, items }: { title: string; items: { id: string; title: string; subtitle: string; description: string; active: boolean; onEdit?: () => void; onDelete?: () => void }[] }) {
  return (
    <section className="page-card p-6">
      <p className="section-title text-[22px] font-semibold text-[var(--primary)]">{title}</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="panel-muted p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold text-[var(--text)]">{item.title}</p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.subtitle}</p>
                <p className="mt-2 text-[13px] text-[var(--text-muted)]">{item.description}</p>
                <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{item.active ? "Active" : "Inactive"}</p>
              </div>
              <div className="flex gap-2">
                {item.onEdit ? <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={item.onEdit}><Pencil className="h-4 w-4" /></button> : null}
                {item.onDelete ? <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={item.onDelete}><Trash2 className="h-4 w-4" /></button> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="filter-control w-full" /></label>;
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]"><span>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="filter-control min-h-[120px] w-full resize-y" /></label>;
}

function Pick({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <label className="block space-y-2 text-[14px] font-medium text-[var(--text)]"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="filter-control w-full">{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>;
}
