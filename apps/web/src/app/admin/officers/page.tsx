"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UserRole } from "@civictrack/contracts";
import {
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  UserPlus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
} from "lucide-react";

export default function AdminOfficersPage() {
  const [officers, setOfficers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptCode, setSelectedDeptCode] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete officer modal state
  const [officerToDelete, setOfficerToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole.OFFICER | UserRole.ADMIN>(UserRole.OFFICER);
  const [inviteDeptId, setInviteDeptId] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccessData, setInviteSuccessData] = useState<{ inviteLink: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    if (inviteRole === UserRole.OFFICER && !inviteDeptId) {
      setInviteError("Please select an assigned department for the field officer.");
      return;
    }

    setIsInviting(true);
    try {
      const res = await fetch("/api/v1/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          departmentId: inviteRole === UserRole.OFFICER ? inviteDeptId : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setInviteSuccessData({
          inviteLink: json.data.inviteLink,
          token: json.data.token,
        });
      } else {
        setInviteError(json.error?.message || "Failed to create staff invitation.");
      }
    } catch {
      setInviteError("Network error sending invitation. Please try again.");
    } finally {
      setIsInviting(false);
    }
  };

  const fetchOfficers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("limit", "100");
    // Strictly query for officers on the backend
    params.set("role", UserRole.OFFICER);
    if (selectedDeptCode) params.set("departmentCode", selectedDeptCode);
    if (searchTerm) params.set("search", searchTerm);

    try {
      const res = await fetch(`/api/v1/users?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Additional safety: frontend strictly filters out any non-officer accounts
          const officerList = json.data.filter((u: any) => u.role === UserRole.OFFICER);
          setOfficers(officerList);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setError(
            errJson?.error?.message ||
              "Access denied: Administrator privileges are required to view the staff directory."
          );
        } else {
          setError(errJson?.error?.message || "Failed to fetch officer directory");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load officers");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeptCode, searchTerm]);

  useEffect(() => {
    fetchOfficers();
  }, [fetchOfficers]);

  // Load departments for assignment dropdown and code filter
  useEffect(() => {
    async function loadDepts() {
      try {
        const res = await fetch("/api/v1/departments", {
          credentials: "include",
        });
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

  const handleConfirmDelete = async () => {
    if (!officerToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/v1/users/officers/${officerToDelete._id}`, {
        method: "DELETE",
        credentials: "include",
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // Non-JSON response (e.g. proxy HTML 404/502)
        json = null;
      }

      if (res.ok && json?.success) {
        setDeleteSuccess(
          `Officer "${officerToDelete.name}" was successfully removed. Related active assignments have been safely unassigned.`
        );
        setOfficerToDelete(null);
        await fetchOfficers();
        setTimeout(() => setDeleteSuccess(null), 5000);
      } else {
        const errorMsg =
          json?.error?.message ||
          (res.status === 404
            ? "Officer deletion endpoint could not be found on server."
            : `Failed to delete officer account (${res.status} ${res.statusText || "Error"}).`);
        setDeleteError(errorMsg);
      }
    } catch (err: any) {
      setDeleteError(err.message || "Network error deleting officer.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Field Officer Directory & Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor municipal field officers, filter by department code, and manage officer roster.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsInviteModalOpen(true);
              setInviteSuccessData(null);
              setInviteError(null);
              setInviteEmail("");
              setInviteDeptId("");
              setInviteRole(UserRole.OFFICER);
              setCopied(false);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition active:scale-[0.98]"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Officer</span>
          </button>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-xs shadow-sm">
            <Users className="w-3.5 h-3.5" />
            <span>{officers.length} Active Officers</span>
          </span>
        </div>
      </div>

      {deleteSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{deleteSuccess}</span>
        </div>
      )}

      {/* Filter Toolbar: Department Code Filter & Search */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-sm">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search officers by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          <select
            value={selectedDeptCode}
            onChange={(e) => setSelectedDeptCode(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d.code}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Officers Table */}
      <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            <p className="text-xs font-medium text-slate-500">Loading officer directory...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-slate-800 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col items-center gap-3 max-w-lg mx-auto my-6">
            <AlertCircle className="w-8 h-8 text-rose-600" />
            <p className="text-sm font-semibold text-rose-800">{error}</p>
            <button
              type="button"
              onClick={() => fetchOfficers()}
              className="mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-md shadow-blue-500/20"
            >
              Retry Loading Directory
            </button>
          </div>
        ) : officers.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 stroke-1 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">
              {departments.length === 0
                ? "No departments registered yet"
                : "No field officers matching filter criteria"}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {departments.length === 0
                ? "You must register a municipal department before inviting or assigning officers to your administration."
                : selectedDeptCode
                ? `No officers found in department ${selectedDeptCode}`
                : "Invite field officers to see them listed in your departmental directory."}
            </p>
            {departments.length === 0 ? (
              <a
                href="/admin/departments"
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Go to Municipal Departments</span>
              </a>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Officer Name / Email</th>
                  <th className="px-5 py-3.5">Department Code & Name</th>
                  <th className="px-5 py-3.5">System Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {officers.map((u) => {
                  const dept = departments.find(
                    (d) => d._id === u.departmentId || d._id === u.departmentId?._id
                  );

                  return (
                    <tr key={u._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="font-bold text-slate-900">{u.name}</p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">
                        {dept ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold text-[11px]">
                              {dept.code}
                            </span>
                            <span className="text-xs text-slate-800 font-semibold">{dept.name}</span>
                          </div>
                        ) : (
                          <span className="italic text-slate-400">Unassigned</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-full font-bold text-[10px] border bg-blue-50 text-blue-700 border-blue-200">
                          {u.role}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                        </span>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setOfficerToDelete(u);
                            setDeleteError(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition shadow-sm active:scale-[0.98]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Officer</span>
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

      {/* Delete Confirmation Modal */}
      {officerToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Officer Account</h3>
                <p className="text-xs text-slate-500">This action requires administrator authorization.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
              <p>
                Are you sure you want to permanently delete the officer account for{" "}
                <span className="font-bold text-slate-900">{officerToDelete.name}</span> (
                <span className="font-mono text-blue-600">{officerToDelete.email}</span>)?
              </p>
              <div className="pt-2 text-[11px] text-slate-500 space-y-1 border-t border-slate-200">
                <p>&bull; Active login sessions and sockets will be revoked immediately.</p>
                <p>&bull; Any complaints assigned to this officer will be unassigned and preserved for reassignment.</p>
                <p>&bull; Complaint history and audit trails remain intact.</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setOfficerToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 disabled:opacity-50 transition active:scale-[0.98]"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Deletion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Staff Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Invite Staff Member</h2>
                  <p className="text-xs text-slate-500">Send an onboarding invite to an officer or admin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {inviteError && (
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700 flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            {inviteSuccessData ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Invitation Created Successfully</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Share the secure onboarding link below with the staff member. This single-use link expires in 7 days.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Onboarding Link</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteSuccessData.inviteLink}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteSuccessData.inviteLink);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition flex items-center gap-1.5"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      fetchOfficers();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Role *</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  >
                    <option value={UserRole.OFFICER}>Field Officer</option>
                    <option value={UserRole.ADMIN}>Administrator</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Staff Email Address *</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="e.g. officer.ward12@civictrack.gov.in"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>

                {inviteRole === UserRole.OFFICER && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Assigned Municipal Department *
                    </label>
                    <select
                      required
                      value={inviteDeptId}
                      onChange={(e) => setInviteDeptId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    >
                      <option value="">Select Department...</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting || !inviteEmail.trim() || (inviteRole === UserRole.OFFICER && !inviteDeptId)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition active:scale-[0.98]"
                  >
                    {isInviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Generate Invitation</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}