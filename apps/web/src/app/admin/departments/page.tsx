"use client";

import React, { useState, useEffect } from "react";
import { ComplaintCategory } from "@civictrack/contracts";
import { AdminShell } from "../../../components/layout/admin-shell";
import { CATEGORY_COLORS } from "../../../lib/ola-maps-config";
import {
  Building2,
  PlusCircle,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
  Layers,
} from "lucide-react";

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Department Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<ComplaintCategory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadDepartments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/departments");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setDepartments(json.data);
        }
      } else {
        setError("Failed to retrieve municipal departments");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load departments");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleCategoryToggle = (cat: ComplaintCategory) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setFormError("Department name and code are required.");
      return;
    }
    if (selectedCategories.length === 0) {
      setFormError("Select at least one civic complaint category.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/v1/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          categories: selectedCategories,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setName("");
        setCode("");
        setSelectedCategories([]);
        loadDepartments();
      } else {
        const errJson = await res.json();
        setFormError(errJson.error?.message || "Failed to create department");
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to submit department");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              Municipal Departments
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage city departments, operational codes, and assigned civic issue categories.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#d95d39] hover:bg-[#c34e2c] text-white text-xs font-semibold shadow-sm transition-all shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Register Department</span>
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-7 h-7 animate-spin text-[#d95d39]" />
            <p className="text-xs">Loading department roster...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl">
            <AlertCircle className="w-7 h-7 mx-auto mb-2" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <div
                key={dept._id}
                className="p-5 rounded-2xl border border-border bg-card flex flex-col justify-between hover:border-[#d95d39]/40 transition-colors shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#d95d39] font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-secondary text-[#d95d39] border border-border">
                      {dept.code}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground mb-1">{dept.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active Service
                    </span>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-2 font-mono">
                      Covered Categories
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dept.categories?.map((cat: ComplaintCategory) => {
                        const color = CATEGORY_COLORS[cat] || "#14b8a6";
                        return (
                          <span
                            key={cat}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] bg-secondary border border-border text-foreground font-medium"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            {cat.replace(/_/g, " ")}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Department Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>Register New Department</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs mb-4">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateDepartment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Department Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Roads & Bridges Division"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Department Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ROADS"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground uppercase font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Civic Categories Handled *
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-background border border-border rounded-lg">
                    {Object.values(ComplaintCategory).map((cat) => (
                      <label
                        key={cat}
                        className="flex items-center gap-2 text-xs text-foreground cursor-pointer hover:bg-secondary/50 p-1.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat)}
                          onChange={() => handleCategoryToggle(cat)}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span>{cat.replace(/_/g, " ")}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Create Department</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
