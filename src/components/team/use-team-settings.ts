"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useBillingPlanCopy } from "@/lib/billing-plan-copy";
import { trpc } from "@/lib/trpc/react";
import { isInvitation, isMember, type Member, type Organization } from "./team-types";
import { createTeamSlug, escapeCsvCell, parseTokenLimit } from "./team-utils";

export function useTeamSettings() {
  const t = useExtracted();
  const { push } = useRouter();
  const session = authClient.useSession();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [isInviting, setIsInviting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [shredOpen, setShredOpen] = useState(false);
  const currentUserId = session.data?.user?.id ?? null;

  const { data: organizationsData, isLoading: organizationsLoading } = useQuery({
    queryKey: ["team", "organizations", currentUserId],
    enabled: !session.isPending,
    queryFn: async () => {
      const result = await authClient.organization.list({});
      return (result.data ?? []) as Organization[];
    },
  });
  const activeOrganizationId = session.data?.session?.activeOrganizationId ?? null;
  const organizations = organizationsData ?? [];
  const activeOrg =
    (selectedOrgId ? organizations.find((org) => org.id === selectedOrgId) : undefined) ??
    organizations.find((org) => org.id === activeOrganizationId) ??
    organizations[0] ??
    null;
  const { data: orgDetailsData } = useQuery({
    queryKey: ["team", "organization", currentUserId, activeOrg?.id],
    enabled: Boolean(activeOrg?.id),
    queryFn: async () => {
      const result = await authClient.organization.getFullOrganization({
        query: { organizationId: activeOrg?.id ?? "" },
      });
      return result.data ?? null;
    },
  });
  const monthlyPlanCopy = useBillingPlanCopy("pro_team_monthly");
  const yearlyPlanCopy = useBillingPlanCopy("pro_team_yearly");

  const createPortal = trpc.organization.createTeamPortalSession.useMutation();
  const createTeamCheckout = trpc.organization.createTeamCheckoutSession.useMutation();
  const cancelSub = trpc.organization.cancelTeamSubscription.useMutation();
  const resumeSub = trpc.organization.resumeTeamSubscription.useMutation();
  const updateTeamMaxMode = trpc.organization.updateTeamMaxModeEnabled.useMutation();
  const updateTeamMaxModeDefaultPolicy =
    trpc.organization.updateTeamMaxModeDefaultPolicy.useMutation();
  const updateMemberMaxModePolicy = trpc.organization.updateTeamMemberMaxModePolicy.useMutation();
  const utils = trpc.useUtils();
  const members = (orgDetailsData?.members ?? []).filter(isMember);
  const invitations = (orgDetailsData?.invitations ?? []).filter(isInvitation);
  const pendingInvitations = invitations.filter((inv) => inv.status === "pending");
  const currentUserRole = members.find((member) => member.userId === currentUserId)?.role ?? null;
  const teamBillingQuery = trpc.organization.teamBillingStatus.useQuery(
    { organizationId: activeOrg?.id ?? "" },
    { enabled: Boolean(activeOrg?.id) && currentUserRole === "owner" },
  );
  const teamMaxModeQuery = trpc.organization.teamMaxModeSettings.useQuery(
    { organizationId: activeOrg?.id ?? "" },
    { enabled: Boolean(activeOrg?.id) && currentUserRole === "owner" },
  );
  const teamPlansQuery = trpc.organization.teamPlans.useQuery(undefined, {
    enabled: Boolean(activeOrg?.id) && currentUserRole === "owner",
  });

  const isOwner = currentUserRole === "owner";
  const isAdmin = currentUserRole === "admin" || isOwner;

  async function selectOrg(org: Organization, options?: { persistActive?: boolean }) {
    setSelectedOrgId(org.id);
    if (options?.persistActive !== false && org.id !== activeOrganizationId) {
      await authClient.organization.setActive({ organizationId: org.id });
      await session.refetch();
    }
  }

  useEffect(() => {
    if (session.isPending) {
      return;
    }

    async function init() {
      const invitationId = searchParams.get("invitationId");
      if (invitationId) {
        window.history.replaceState({}, "", window.location.pathname);
        const result = await authClient.organization.acceptInvitation({ invitationId });
        if (result.error) {
          console.error("Failed to accept invitation", result.error);
          toast.error(t("Failed to accept invitation"));
        } else {
          toast.success(t("Invitation accepted"));
          await queryClient.invalidateQueries({
            queryKey: ["team", "organizations", currentUserId],
          });
          await session.refetch();
        }
      }
    }
    init();
  }, [currentUserId, searchParams, queryClient, session, t]);

  async function handleCreateOrg() {
    if (!newOrgName.trim()) return;
    setIsCreatingOrg(true);
    try {
      const result = await authClient.organization.create({
        name: newOrgName.trim(),
        slug: createTeamSlug(newOrgName),
      });
      if (result.error) {
        toast.error(result.error.message || t("Failed to create organization"));
        return;
      }
      if (result.data) {
        const created = result.data as Organization;
        queryClient.setQueryData<Organization[]>(
          ["team", "organizations", currentUserId],
          (current) => {
            const list = current ?? [];
            if (list.some((org) => org.id === created.id)) {
              return list;
            }
            return [...list, created];
          },
        );
        await selectOrg(created);
        await queryClient.invalidateQueries({
          queryKey: ["team", "organizations", currentUserId],
        });
        toast.success(t("Organization created"));
        setIsCreateDialogOpen(false);
        setNewOrgName("");
      }
    } catch (error) {
      console.error("Failed to create org", error);
      toast.error(t("Failed to create organization"));
    } finally {
      setIsCreatingOrg(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !activeOrg) return;
    setIsInviting(true);
    try {
      await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole as "member" | "admin",
        organizationId: activeOrg.id,
      });
      toast.success(t("Invitation sent"));
      await queryClient.invalidateQueries({
        queryKey: ["team", "organization", currentUserId, activeOrg.id],
      });
    } catch (error) {
      console.error("Failed to invite", error);
      toast.error(t("Failed to send invitation"));
    }
    setIsInviting(false);
    setIsInviteDialogOpen(false);
    setInviteEmail("");
    setInviteRole("member");
  }

  async function handleRemoveMember(memberId: string) {
    if (!activeOrg) return;
    setIsRemovingMember(true);
    try {
      await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId: activeOrg.id,
      });
      toast.success(t("Member removed"));
      await queryClient.invalidateQueries({
        queryKey: ["team", "organization", currentUserId, activeOrg.id],
      });
      setMemberToRemove(null);
    } catch (error) {
      console.error("Failed to remove member", error);
      toast.error(t("Failed to remove member"));
    }
    setIsRemovingMember(false);
  }

  async function handleCancelInvitation(invitationId: string) {
    try {
      await authClient.organization.cancelInvitation({ invitationId });
      toast.success(t("Invitation cancelled"));
      if (activeOrg) {
        await queryClient.invalidateQueries({
          queryKey: ["team", "organization", currentUserId, activeOrg.id],
        });
      }
    } catch (error) {
      console.error("Failed to cancel invitation", error);
      toast.error(t("Failed to cancel invitation"));
    }
  }

  async function handleSubscribe(planId: "pro_team_monthly" | "pro_team_yearly") {
    if (!activeOrg) return;
    try {
      const result = await createTeamCheckout.mutateAsync({
        organizationId: activeOrg.id,
        planId,
      });
      startTransition(() => {
        push(`/settings/team/checkout/${result.sessionId}?organizationId=${activeOrg.id}`);
      });
    } catch (error) {
      console.error("Failed to create checkout session", error);
      toast.error(error instanceof Error ? error.message : t("Unable to load checkout."));
    }
  }

  async function handleManage() {
    if (!activeOrg) return;
    try {
      const result = await createPortal.mutateAsync({
        organizationId: activeOrg.id,
      });
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error(t("Stripe did not return a billing portal URL."));
      }
    } catch (error) {
      console.error("Failed to open portal", error);
      toast.error(t("Failed to open billing portal"));
    }
  }

  async function handleCancel() {
    setShredOpen(true);
  }

  async function confirmCancel() {
    if (!activeOrg) {
      throw new Error(t("Failed to cancel subscription"));
    }
    const result = await cancelSub.mutateAsync({ organizationId: activeOrg.id });
    utils.organization.teamBillingStatus.setData({ organizationId: activeOrg.id }, (current) =>
      current
        ? {
            ...current,
            status: result.status ?? "canceled",
            cancelAt: result.cancelAt ?? current.cancelAt,
            currentPeriodEnd: result.currentPeriodEnd ?? current.currentPeriodEnd,
          }
        : current,
    );
    await Promise.all([
      utils.organization.teamBillingStatus.invalidate({ organizationId: activeOrg.id }),
      utils.billing.status.invalidate(),
    ]);
  }

  async function handleResume() {
    if (!activeOrg) return;
    try {
      await resumeSub.mutateAsync({ organizationId: activeOrg.id });
      toast.success(t("Subscription resumed."));
      utils.organization.teamBillingStatus.invalidate();
    } catch (error) {
      console.error("Failed to resume", error);
      toast.error(t("Failed to resume subscription"));
    }
  }

  async function handleTeamMaxModeToggle(enabled: boolean) {
    if (!activeOrg) return;
    try {
      await updateTeamMaxMode.mutateAsync({ organizationId: activeOrg.id, enabled });
      toast.success(enabled ? t("Max Mode enabled.") : t("Max Mode disabled."));
      await Promise.all([
        utils.organization.teamMaxModeSettings.invalidate({ organizationId: activeOrg.id }),
        utils.billing.maxModeStatus.invalidate(),
        utils.billing.usage.invalidate(),
      ]);
    } catch (error) {
      console.error("Failed to update team Max Mode", error);
      toast.error(error instanceof Error ? error.message : t("Failed to update Max Mode."));
    }
  }

  async function updateMemberPolicy(input: {
    userId: string;
    maxModeEnabled: boolean;
    maxModeLimitBasic: number | null;
    maxModeLimitPremium: number | null;
  }) {
    if (!activeOrg) return;
    try {
      await updateMemberMaxModePolicy.mutateAsync({
        organizationId: activeOrg.id,
        ...input,
      });
      await Promise.all([
        utils.organization.teamMaxModeSettings.invalidate({ organizationId: activeOrg.id }),
        utils.billing.maxModeStatus.invalidate(),
        utils.billing.usage.invalidate(),
      ]);
      toast.success(t("Member Max Mode policy updated."));
    } catch (error) {
      console.error("Failed to update member Max Mode policy", error);
      toast.error(error instanceof Error ? error.message : t("Failed to update Max Mode."));
    }
  }

  async function updateDefaultPolicy(input: {
    maxModeEnabled: boolean;
    maxModeLimitBasic: number | null;
    maxModeLimitPremium: number | null;
  }) {
    if (!activeOrg) return;
    try {
      await updateTeamMaxModeDefaultPolicy.mutateAsync({
        organizationId: activeOrg.id,
        ...input,
      });
      await utils.organization.teamMaxModeSettings.invalidate({ organizationId: activeOrg.id });
      toast.success(t("Default Max Mode policy updated."));
    } catch (error) {
      console.error("Failed to update default Max Mode policy", error);
      toast.error(error instanceof Error ? error.message : t("Failed to update Max Mode."));
    }
  }

  async function handleDefaultLimitChange({
    maxModeEnabled,
    maxModeLimitBasic,
    maxModeLimitPremium,
    category,
    value,
  }: {
    maxModeEnabled: boolean;
    maxModeLimitBasic: number | null;
    maxModeLimitPremium: number | null;
    category: "basic" | "premium";
    value: string;
  }) {
    const parsedLimit = parseTokenLimit(value);
    if (parsedLimit === undefined) {
      toast.error(t("Enter a whole number or leave the field blank."));
      return;
    }

    await updateDefaultPolicy({
      maxModeEnabled,
      maxModeLimitBasic: category === "basic" ? parsedLimit : maxModeLimitBasic,
      maxModeLimitPremium: category === "premium" ? parsedLimit : maxModeLimitPremium,
    });
  }

  async function handleMemberLimitChange({
    userId,
    maxModeEnabled,
    maxModeLimitBasic,
    maxModeLimitPremium,
    category,
    value,
  }: {
    userId: string;
    maxModeEnabled: boolean;
    maxModeLimitBasic: number | null;
    maxModeLimitPremium: number | null;
    category: "basic" | "premium";
    value: string;
  }) {
    const parsedLimit = parseTokenLimit(value);
    if (parsedLimit === undefined) {
      toast.error(t("Enter a whole number or leave the field blank."));
      return;
    }

    await updateMemberPolicy({
      userId,
      maxModeEnabled,
      maxModeLimitBasic: category === "basic" ? parsedLimit : maxModeLimitBasic,
      maxModeLimitPremium: category === "premium" ? parsedLimit : maxModeLimitPremium,
    });
  }

  function handleExportMaxModeCsv() {
    const settings = teamMaxModeQuery.data;
    if (!settings || !activeOrg) return;

    const headers = [
      "name",
      "email",
      "role",
      "max_mode_enabled",
      "basic_token_limit",
      "premium_token_limit",
      "basic_tokens_used",
      "premium_tokens_used",
    ];
    const rows = settings.members.map((memberPolicy) => [
      memberPolicy.name ?? "",
      memberPolicy.email,
      memberPolicy.role,
      memberPolicy.maxModeEnabled ? "enabled" : "disabled",
      memberPolicy.maxModeLimitBasic ?? "",
      memberPolicy.maxModeLimitPremium ?? "",
      memberPolicy.maxModeUsageBasic,
      memberPolicy.maxModeUsagePremium,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeOrg.slug ?? activeOrg.id}-max-mode.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const isLoading = session.isPending || (organizationsLoading && organizations.length === 0);
  const teamPlans = teamPlansQuery.data?.plans ?? [];
  const monthlyPlan = teamPlans.find((p) => p.id === "pro_team_monthly");
  const yearlyPlan = teamPlans.find((p) => p.id === "pro_team_yearly");
  const teamTrialDays = monthlyPlan?.trialDays ?? yearlyPlan?.trialDays ?? null;

  return {
    t,
    isLoading,
    organizations,
    activeOrg,
    members,
    pendingInvitations,
    isOwner,
    isAdmin,
    monthlyPlanCopy,
    yearlyPlanCopy,
    teamBillingQuery,
    teamMaxModeQuery,
    monthlyPlan,
    yearlyPlan,
    teamTrialDays,
    createTeamCheckout,
    cancelSub,
    resumeSub,
    updateTeamMaxMode,
    updateTeamMaxModeDefaultPolicy,
    updateMemberMaxModePolicy,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    newOrgName,
    setNewOrgName,
    isCreatingOrg,
    isInviteDialogOpen,
    setIsInviteDialogOpen,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    isInviting,
    memberToRemove,
    setMemberToRemove,
    isRemovingMember,
    selectOrg,
    handleCreateOrg,
    handleInvite,
    handleRemoveMember,
    handleCancelInvitation,
    handleSubscribe,
    handleManage,
    handleCancel,
    confirmCancel,
    shredOpen,
    setShredOpen,
    handleResume,
    handleTeamMaxModeToggle,
    updateMemberPolicy,
    updateDefaultPolicy,
    handleDefaultLimitChange,
    handleMemberLimitChange,
    handleExportMaxModeCsv,
  };
}
