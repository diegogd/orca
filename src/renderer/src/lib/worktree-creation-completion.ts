import { useAppStore } from '@/store'
import { ensureAgentStartupInTerminal } from '@/lib/new-workspace'
import { queueWorkspaceActivationTerminalFocus } from '@/lib/workspace-activation-terminal-focus'
import { seedAgentTabStateAfterWorktreeCreate } from '@/lib/worktree-creation-agent-seeds'
import type { ActivateAndRevealResult } from '@/lib/worktree-activation'
import { getCreationWorktreeMeta } from './worktree-creation-meta'
import type { WorktreeCreationRequest } from '@/lib/pending-worktree-creation'

export async function completeWorktreeCreation(args: {
  creationId: string
  request: WorktreeCreationRequest
  worktreeId: string
  structuredLaunchAccepted: boolean
  activation: ActivateAndRevealResult | false
  primaryTabId: string | null
  startupTerminalTabId?: string
  backendSpawned: boolean
  focusOnCompletion: boolean
}): Promise<void> {
  const { request } = args
  // Why: clearing synchronously after activation lets React commit the panel-to-terminal swap in one frame.
  useAppStore.getState().removePendingWorktreeCreation(args.creationId, { cleanupVm: false })
  if (!args.structuredLaunchAccepted) {
    seedAgentTabStateAfterWorktreeCreate({
      request,
      worktreeId: args.worktreeId,
      primaryTabId: args.primaryTabId,
      startupTerminalTabId: args.startupTerminalTabId,
      backendSpawned: args.backendSpawned
    })
  }
  if (!args.structuredLaunchAccepted && request.startupPlan && !args.backendSpawned) {
    void ensureAgentStartupInTerminal({
      worktreeId: args.worktreeId,
      primaryTabId: args.primaryTabId,
      startup: request.startupPlan
    })
  }
  if (
    !args.structuredLaunchAccepted &&
    !request.suppressTerminalFocusOnCompletion &&
    args.focusOnCompletion
  ) {
    queueWorkspaceActivationTerminalFocus(args.worktreeId, args.activation)
  }

  // Why: note and tag persistence are cosmetic and should not delay the visible workspace handoff.
  const creationMeta = getCreationWorktreeMeta(request.note, request.tags)
  if (Object.keys(creationMeta).length > 0) {
    try {
      await useAppStore.getState().updateWorktreeMeta(args.worktreeId, creationMeta)
    } catch {
      console.error('Failed to update worktree meta after creation')
    }
  }
}
