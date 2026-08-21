"use client";

import { Plus } from "lucide-react";
import { useExtracted } from "next-intl";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { Spinner } from "@/components/ui/spinner";
import { TeamBillingCard } from "./team-billing-card";
import { TeamCreateDialog } from "./team-create-dialog";
import { TeamEmptyState } from "./team-empty-state";
import { TeamInviteDialog } from "./team-invite-dialog";
import { TeamMaxModeCard } from "./team-max-mode-card";
import { TeamMembersList } from "./team-members-list";
import { TeamOrgHeader } from "./team-org-header";
import { TeamPendingInvitations } from "./team-pending-invitations";
import { TeamRemoveMemberDialog } from "./team-remove-member-dialog";
import { useTeamSettings } from "./use-team-settings";
import { SubscriptionShredder } from "@/components/billing/subscription-shredder";
import { useBillingReceiptCopy } from "@/components/billing/billing-utils";
import type { SubscriptionReceiptData } from "@/components/billing/subscription-receipt";

function TeamSettingsContent() {
  const {
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
  } = useTeamSettings();
  const getReceiptCopy = useBillingReceiptCopy();
  const teamPlanId = teamBillingQuery.data?.planId ?? "pro_team_monthly";
  const teamPlan = teamPlanId.endsWith("yearly") ? yearlyPlan : monthlyPlan;

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (organizations.length === 0 && !activeOrg) {
    return (
      <TeamEmptyState
        isCreateDialogOpen={isCreateDialogOpen}
        onCreateDialogOpenChange={setIsCreateDialogOpen}
        newOrgName={newOrgName}
        onNewOrgNameChange={setNewOrgName}
        onCreate={handleCreateOrg}
        isCreating={isCreatingOrg}
      />
    );
  }

  return (
    <SettingsPageShell
      title={t("Team")}
      description={t("Manage your team and Pro for Teams subscription.")}
      actions={
        <>
          {organizations.length > 1 && (
            <Select
              value={activeOrg?.id ?? ""}
              onValueChange={(val) => {
                const org = organizations.find((o) => o.id === val);
                if (org) selectOrg(org);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="size-3.5" />
            {t("New Team")}
          </Button>
        </>
      }
    >
      {activeOrg && <TeamOrgHeader activeOrg={activeOrg} memberCount={members.length} />}

      {isOwner && (
        <TeamBillingCard
          isLoading={teamBillingQuery.isLoading}
          billingStatus={teamBillingQuery.data}
          monthlyPlan={monthlyPlan}
          yearlyPlan={yearlyPlan}
          monthlyPlanCopy={monthlyPlanCopy}
          yearlyPlanCopy={yearlyPlanCopy}
          teamTrialDays={teamTrialDays}
          checkoutPending={createTeamCheckout.isPending}
          checkoutPlanId={createTeamCheckout.variables?.planId}
          cancelPending={cancelSub.isPending || shredOpen}
          resumePending={resumeSub.isPending}
          onSubscribe={handleSubscribe}
          onManage={handleManage}
          onCancel={handleCancel}
          onResume={handleResume}
        />
      )}

      {isOwner && (
        <TeamMaxModeCard
          isLoading={teamMaxModeQuery.isLoading}
          settings={teamMaxModeQuery.data}
          teamTogglePending={updateTeamMaxMode.isPending}
          defaultPolicyPending={updateTeamMaxModeDefaultPolicy.isPending}
          memberPolicyPending={updateMemberMaxModePolicy.isPending}
          onTeamToggle={handleTeamMaxModeToggle}
          onDefaultPolicyChange={updateDefaultPolicy}
          onDefaultLimitChange={handleDefaultLimitChange}
          onMemberPolicyChange={updateMemberPolicy}
          onMemberLimitChange={handleMemberLimitChange}
          onExportCsv={handleExportMaxModeCsv}
        />
      )}

      <TeamMembersList
        members={members}
        isAdmin={isAdmin}
        onInviteClick={() => setIsInviteDialogOpen(true)}
        onRemoveClick={setMemberToRemove}
      />

      <TeamPendingInvitations
        invitations={pendingInvitations}
        isAdmin={isAdmin}
        onCancel={handleCancelInvitation}
      />

      <TeamCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        name={newOrgName}
        onNameChange={setNewOrgName}
        onCreate={handleCreateOrg}
        isCreating={isCreatingOrg}
      />

      <TeamInviteDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        email={inviteEmail}
        onEmailChange={setInviteEmail}
        role={inviteRole}
        onRoleChange={setInviteRole}
        onInvite={handleInvite}
        isInviting={isInviting}
      />

      <TeamRemoveMemberDialog
        member={memberToRemove}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
        onConfirm={handleRemoveMember}
        isRemoving={isRemovingMember}
      />

      <SubscriptionShredder
        data={
          {
            sessionId: activeOrg?.id ?? "team-cancel",
            ...getReceiptCopy(teamPlanId, "/settings/team", t("Home")),
            amountTotal: teamPlan?.amount ?? 0,
            amountSubtotal: teamPlan?.amount ?? null,
            amountTax: null,
            amountDiscount: null,
            currency: teamPlan?.currency ?? "usd",
            paymentMethodBrand: null,
            paymentMethodLast4: null,
            paidAt: teamBillingQuery.data?.currentPeriodEnd ?? null,
          } satisfies SubscriptionReceiptData
        }
        onClose={() => setShredOpen(false)}
        onConfirm={confirmCancel}
        open={shredOpen}
      />
    </SettingsPageShell>
  );
}

function TeamSettingsLoading() {
  const t = useExtracted();
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center text-sm text-muted-foreground">
      {t("Loading team settings…")}
    </div>
  );
}

export function TeamSettingsPage() {
  return (
    <Suspense fallback={<TeamSettingsLoading />}>
      <TeamSettingsContent />
    </Suspense>
  );
}
