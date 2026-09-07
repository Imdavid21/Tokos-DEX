import type { OneDeltaTransaction, TokosSwapExecution } from './types'

export interface ExecutionPlan {
  permissions: OneDeltaTransaction[]
  swapTransactions: OneDeltaTransaction[]
}

/**
 * 1delta returns setup transactions and, for spot swaps, may also return
 * competing alternative routes. Permissions are mined first. Setup
 * transactions run in order, followed by exactly one selected alternative.
 */
export function selectExecutionPlan(execution: TokosSwapExecution, alternativeIndex = 0): ExecutionPlan {
  const selectedAlternative = execution.alternatives[alternativeIndex]

  if (selectedAlternative) {
    return {
      permissions: execution.permissions,
      swapTransactions: [...execution.transactions, selectedAlternative],
    }
  }

  if (execution.transactions.length > 0) {
    return {
      permissions: execution.permissions,
      swapTransactions: execution.transactions,
    }
  }

  throw new Error('1delta returned no executable swap transaction')
}
