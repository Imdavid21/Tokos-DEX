import type { OneDeltaTransaction, TokosSwapExecution } from './types'

export interface ExecutionPlan {
  permissions: OneDeltaTransaction[]
  swapTransactions: OneDeltaTransaction[]
}

/**
 * Permissions are mined first. Setup transactions run in order, followed by
 * exactly one selected alternative route when alternatives are available.
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

  throw new Error('No executable swap transaction was returned')
}
