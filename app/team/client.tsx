"use client";

import { useState } from "react";
import {
  UsersIcon,
  EnvelopeIcon,
  TrashIcon,
  PlusIcon,
  CheckIcon,
  XIcon,
  DotsThreeVerticalIcon,
  WarningIcon,
} from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";

type TeamRole = "owner" | "admin" | "editor" | "viewer";
type MemberStatus = "active" | "invited" | "inactive";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: MemberStatus;
  avatar?: string;
  joinedAt: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: TeamRole;
  invitedAt: string;
  invitedBy: string;
}

interface ActivityLogEntry {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  details?: string;
}

interface TeamData {
  plan: {
    name: string;
    seatsUsed: number;
    seatsTotal: number;
  };
  members: TeamMember[];
  pendingInvitations: PendingInvitation[];
  activityLog: ActivityLogEntry[];
}

interface TeamPageClientProps {
  initialData: TeamData;
}

export function TeamPageClient({ initialData }: TeamPageClientProps) {
  const [teamData, setTeamData] = useState<TeamData>(initialData);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("viewer");
  const [isInviting, setIsInviting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);

  const roleOptions = [
    { value: "owner", label: "Owner" },
    { value: "admin", label: "Admin" },
    { value: "editor", label: "Editor" },
    { value: "viewer", label: "Viewer" },
  ];

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Check if at seat limit
    if (teamData.plan.seatsUsed >= teamData.plan.seatsTotal) {
      toast.error("You've reached your seat limit. Upgrade your plan to add more members.");
      return;
    }

    setIsInviting(true);

    try {
      // In real implementation, call PostPeer API here
      // await postpeerClient.get().inviteMember({ email: inviteEmail, role: inviteRole });

      // Mock success - add to pending invitations
      const newInvitation: PendingInvitation = {
        id: `inv-${Date.now()}`,
        email: inviteEmail,
        role: inviteRole,
        invitedAt: new Date().toISOString(),
        invitedBy: "Current User", // In real app, get from session
      };

      setTeamData({
        ...teamData,
        pendingInvitations: [...teamData.pendingInvitations, newInvitation],
      });

      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("viewer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      // In real implementation, call PostPeer API
      // await postpeerClient.get().cancelInvitation(invitationId);

      setTeamData({
        ...teamData,
        pendingInvitations: teamData.pendingInvitations.filter(inv => inv.id !== invitationId),
      });

      toast.success("Invitation cancelled");
    } catch (error) {
      toast.error("Failed to cancel invitation");
    }
  };

  const handleResendInvitation = async (invitation: PendingInvitation) => {
    try {
      // In real implementation, call PostPeer API
      // await postpeerClient.get().resendInvitation(invitation.id);

      toast.success(`Invitation resent to ${invitation.email}`);
    } catch (error) {
      toast.error("Failed to resend invitation");
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    setIsRemoving(true);

    try {
      // In real implementation, call PostPeer API
      // await postpeerClient.get().removeMember(memberToRemove.id);

      setTeamData({
        ...teamData,
        members: teamData.members.filter(m => m.id !== memberToRemove.id),
        plan: {
          ...teamData.plan,
          seatsUsed: teamData.plan.seatsUsed - 1,
        },
      });

      toast.success(`${memberToRemove.name} removed from team`);
      setMemberToRemove(null);
    } catch (error) {
      toast.error("Failed to remove member");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: TeamRole) => {
    setChangingRoleFor(memberId);

    try {
      // In real implementation, call PostPeer API
      // await postpeerClient.get().updateMemberRole(memberId, newRole);

      setTeamData({
        ...teamData,
        members: teamData.members.map(m =>
          m.id === memberId ? { ...m, role: newRole } : m
        ),
      });

      toast.success("Role updated successfully");
    } catch (error) {
      toast.error("Failed to update role");
    } finally {
      setChangingRoleFor(null);
    }
  };

  const getRoleBadgeColor = (role: TeamRole) => {
    switch (role) {
      case "owner":
        return "primary";
      case "admin":
        return "info";
      case "editor":
        return "success";
      case "viewer":
        return "neutral";
      default:
        return "neutral";
    }
  };

  const getStatusBadgeColor = (status: MemberStatus) => {
    switch (status) {
      case "active":
        return "success";
      case "invited":
        return "warning";
      case "inactive":
        return "neutral";
      default:
        return "neutral";
    }
  };

  const atSeatLimit = teamData.plan.seatsUsed >= teamData.plan.seatsTotal;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your team members and their access
          </p>
        </div>
      </div>

      {/* Plan Overview */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              {teamData.plan.name} Plan
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {teamData.plan.seatsUsed} of {teamData.plan.seatsTotal} seats used
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-semibold text-indigo-600">
                {teamData.plan.seatsUsed}/{teamData.plan.seatsTotal}
              </div>
              <div className="text-xs text-gray-500">Team seats</div>
            </div>
            {atSeatLimit && (
              <Button variant="primary" size="sm">
                Upgrade Plan
              </Button>
            )}
          </div>
        </div>
        {atSeatLimit && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <WarningIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900">
                You&apos;ve reached your seat limit
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Upgrade your plan to add more team members
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Invite Member Form */}
      <Card>
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Invite Team Member
        </h2>
        <form onSubmit={handleInviteMember} className="flex gap-3">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={isInviting || atSeatLimit}
              leftIcon={<EnvelopeIcon className="w-5 h-5" />}
              aria-label="Email address"
            />
          </div>
          <div className="w-40">
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TeamRole)}
              disabled={isInviting || atSeatLimit}
              aria-label="Select role"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={isInviting || atSeatLimit}
            leftIcon={isInviting ? <Spinner className="w-4 h-4" /> : <PlusIcon className="w-5 h-5" />}
            aria-label="Send invitation"
          >
            {isInviting ? "Inviting..." : "Invite"}
          </Button>
        </form>
      </Card>

      {/* Team Members */}
      <Card>
        <h2 className="text-lg font-medium text-gray-900 mb-4">Team Members</h2>
        {teamData.members.length === 0 ? (
          <div className="text-center py-12">
            <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900">No team members yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Invite colleagues to collaborate on your workspace
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {teamData.members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={member.name}
                          src={member.avatar}
                          size="sm"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {member.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="w-32">
                        <Select
                          value={member.role}
                          onChange={(e) =>
                            handleChangeRole(member.id, e.target.value as TeamRole)
                          }
                          disabled={
                            member.role === "owner" ||
                            changingRoleFor === member.id
                          }
                          aria-label={`Change role for ${member.name}`}
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge
                        variant={getStatusBadgeColor(member.status)}
                        size="sm"
                      >
                        {member.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      {member.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMemberToRemove(member)}
                          leftIcon={<TrashIcon className="w-4 h-4" />}
                          aria-label={`Remove ${member.name}`}
                        >
                          Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pending Invitations */}
      {teamData.pendingInvitations.length > 0 && (
        <Card>
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Pending Invitations
          </h2>
          <div className="space-y-3">
            {teamData.pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <EnvelopeIcon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {invitation.email}
                    </div>
                    <div className="text-xs text-gray-500">
                      Invited {new Date(invitation.invitedAt).toLocaleDateString()} by{" "}
                      {invitation.invitedBy}
                    </div>
                  </div>
                  <Badge
                    variant={getRoleBadgeColor(invitation.role)}
                    size="sm"
                  >
                    {invitation.role}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResendInvitation(invitation)}
                  >
                    Resend
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelInvitation(invitation.id)}
                    leftIcon={<XIcon className="w-4 h-4" />}
                    aria-label={`Cancel invitation to ${invitation.email}`}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Activity Log */}
      {teamData.activityLog.length > 0 && (
        <Card>
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Recent Activity
          </h2>
          <div className="space-y-4">
            {teamData.activityLog.map((entry) => (
              <div key={entry.id} className="flex gap-4">
                <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-indigo-600" />
                <div className="flex-1">
                  <div className="text-sm text-gray-900">
                    <span className="font-medium">{entry.user}</span>{" "}
                    {entry.action}
                  </div>
                  {entry.details && (
                    <div className="text-sm text-gray-500">{entry.details}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Remove Member Confirmation Dialog */}
      <ConfirmDialog
        open={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
        title="Remove Team Member"
        message={
          memberToRemove
            ? `Are you sure you want to remove ${memberToRemove.name} from your team? They will lose access to all shared resources.`
            : ""
        }
        confirmLabel="Remove Member"
        cancelLabel="Cancel"
        variant="danger"
        loading={isRemoving}
      />
    </div>
  );
}
