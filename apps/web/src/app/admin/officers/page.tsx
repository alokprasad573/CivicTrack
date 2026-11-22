"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UserRole } from "@civictrack/contracts";
import { AdminShell } from "../../../components/layout/admin-shell";
import {
  Users,
  Building2,
  ShieldCheck,
  Shield,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
  Search,
} from "lucide-react";

export default function AdminOfficersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit user modal state
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>(UserRole.OFFICER);
  const [targetDeptId, setTargetDeptId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("limit", "50");
    if (roleFilter) params.set("role", roleFilter);
    if (searchTerm) params.set("search", searchTerm);

    try {
      const res = await fetch(`/api/v1/users?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setUsers(json.data);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setError(
            errJson?.error?.message ||
              "Access denied: Administrator privileges are required to view the staff directory."
          );
        } else {
          setError(errJson?.error?.message || "Failed to fetch user directory");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, searchTerm]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Load departments for assignment dropdown
  useEffect(() => {
    async function loadDepts() {
      try {
        const res = await fetch("/api/v1/departments");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setDepartments(json.data);
          }
        }
      } catch {}
    }
    loadDepts();
  }, []);

  const handleRoleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (targetRole === UserRole.OFFICER && !targetDeptId) {
      setModalError("Please select an assigned municipal department for this officer.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/v1/users/${selectedUser._id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: targetRole,
          departmentId: targetRole === UserRole.OFFICER ? targetDeptId : undefined,
        }),
      });

      if (res.ok) {
        setSelectedUser(null);
        fetchUsers();
      } else {
        const errJson = await res.json();
        setModalError(errJson.error?.message || "Failed to update role");
      }
    } catch (err: any) {
      setModalError(err.message || "Failed to submit role update");
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
              Officer Roster & Role Management
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Assign staff roles, bind field officers to municipal departments, and manage access privileges.
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 rounded-2xl border border-border bg-card flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#d95d39]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-[#d95d39]"
            >
              <option value="">All Roles</option>
              <option value={UserRole.OFFICER}>Field Officers</option>
              <option value={UserRole.ADMIN}>Administrators</option>
              <option value={UserRole.CITIZEN}>Citizens</option>
            </select>
          </div>
        </div>

        {/* User Table */}
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-xs">Loading officer directory...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-foreground bg-destructive/10 border border-destructive/20 rounded-2xl flex flex-col items-center gap-3">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm font-semibold">{error}</p>
              {error.includes("Access denied") && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await fetch("/api/v1/users/me/switch-role", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ role: "ADMIN" }),
                      });
                      fetchUsers();
                    } catch {}
                  }}
                  className="mt-2 px-4 py-2 rounded-xl bg-[#d95d39] text-white text-xs font-semibold hover:bg-[#c34e2c] transition shadow-sm"
                >
                  Restore Active Persona to Administrator
                </button>
              )}
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 stroke-1" />
              <p className="text-sm font-semibold">No users matching filter criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/50 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">Name / Email</th>
                    <th className="px-4 py-3.5">System Role</th>
                    <th className="px-4 py-3.5">Assigned Department</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => {
                    const dept = departments.find(
                      (d) => d._id === u.departmentId || d._id === u.departmentId?._id
                    );

                    return (
                      <tr key={u._id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className="font-bold text-foreground">{u.name}</p>
                          <p className="text-[11px] text-muted-foreground">{u.email}</p>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${
                              u.role === UserRole.ADMIN
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : u.role === UserRole.OFFICER
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-secondary text-muted-foreground border-border"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                          {dept ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-foreground font-medium">
                              <Building2 className="w-3.5 h-3.5 text-primary" />
                              {dept.name} ({dept.code})
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground/60">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setTargetRole(u.role || UserRole.OFFICER);
                              setTargetDeptId(u.departmentId?._id || u.departmentId || "");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 border border-border text-xs font-semibold transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Modify Role</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Role Modal */}
        {selectedUser && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">Modify User Role & Privileges</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedUser.name} ({selectedUser.email})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {modalError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs mb-4">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleRoleUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    System Role *
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as UserRole)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={UserRole.OFFICER}>Department Officer</option>
                    <option value={UserRole.ADMIN}>Municipal Administrator</option>
                    <option value={UserRole.CITIZEN}>Citizen</option>
                  </select>
                </div>

                {targetRole === UserRole.OFFICER && (
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Assigned Municipal Department *
                    </label>
                    <select
                      required
                      value={targetDeptId}
                      onChange={(e) => setTargetDeptId(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
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
                    <span>Update Privileges</span>
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
