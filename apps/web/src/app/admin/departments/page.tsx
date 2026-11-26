"use client";

import React, { useState, useEffect } from "react";
import { ComplaintCategory } from "@civictrack/contracts";
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
  ShieldCheck,
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
      const res = await fetch("/api/v1/departments", {
        credentials: "include",
      });
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
        credentials: "include",
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
    <div className="space-y-6">
        {/* Header inspired by PolicyOracle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Municipal Departments
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage city departments, operational codes, and assigned civic issue categories.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all shrink-0 active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Register Department</span>
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            <p className="text-xs font-medium text-slate-500">Loading department roster...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-700 bg-rose-50 border border-rose-200 rounded-3xl max-w-lg mx-auto">
            <AlertCircle className="w-7 h-7 mx-auto mb-2 text-rose-600" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        ) : departments.length === 0 ? (
          <div className="py-16 text-center bg-white border border-slate-200 rounded-3xl max-w-lg mx-auto p-8 shadow-sm">
            <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <h3 className="text-sm font-bold text-slate-800">No departments created yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              You haven&apos;t registered any municipal departments. Click &quot;Register Department&quot; above to create your first department.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Register First Department</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {departments.map((dept) => (
              <div
                key={dept._id}
                className="p-6 rounded-3xl border border-slate-200 bg-white flex flex-col justify-between hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5 transition-all shadow-sm group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold group-hover:scale-105 transition-transform">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-50 text-slate-700 border border-slate-200">
                      {dept.code}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1">{dept.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active Service
                    </span>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                      Handled Issue Categories:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dept.categories && dept.categories.length > 0 ? (
                        dept.categories.map((cat: ComplaintCategory) => {
                          const catColor = CATEGORY_COLORS[cat] || "#2563eb";
                          return (
                            <span
                              key={cat}
                              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 font-medium"
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: catColor }}
                              />
                              <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-slate-400 italic">No specific categories bound</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1 text-[11px]">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>{dept.categories?.length || 0} Domains</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Register New Department */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <span>Register Municipal Department</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateDepartment} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Department Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Roads & Bridges Division"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Department Code *
                  </label>
                  <select
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 uppercase font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  >
                    <option value="">Select department code</option>
                    {["ROADS", "WATER", "ELECTRICAL", "SWM", "GENERAL"].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Civic Categories Handled *
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {(Object.values(ComplaintCategory) as ComplaintCategory[]).map((cat) => (
                      <label
                        key={cat}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-white p-2 rounded-lg transition"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat)}
                          onChange={() => handleCategoryToggle(cat)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{cat.replace(/_/g, " ")}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition active:scale-[0.98]"
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
  );
}
