import type { OneDeltaTransaction, TokosSwapExecution } from './types'

export interface ExecutionPlan {
  permissions: OneDeltaTransaction[]
  swapTransactions: OneDeltaTransaction[]
}

/**
 * 1delta returns either an ordered transactions list or alternative routes.
 * Permissions must be executed first. For alternatives, Tokos executes exactly
 * one route, never every alternative.
 */
export function selectExecutionPlan(execution: TokosSwapExecution, alternativeIndex = 0): ExecutionPlan {
  if (execution.transactions.length > 0) {
    return {
      permissions: execution.permissions,
      swapTransactions: execution.transactions,
    }
  }

  const selectedAlternative = execution.alternatives[alternativeIndex]
  if (!selectedAlternative?.length) {
    throw new Error('1delta returned no executable swap transaction')
  }

  return {
    permissions: execution.permissions,
    swapTransactions: selectedAlternative,
  }
}
