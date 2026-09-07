import { describe, expect, it } from 'vitest'
import { selectExecutionPlan } from './execution'
import type { TokosSwapExecution } from './types'

const tx = (suffix: string) => ({
  to: `0x${suffix.padStart(40, '0')}` as `0x${string}`,
  data: '0x01' as `0x${string}`,
  value: '0',
})

function execution(overrides: Partial<TokosSwapExecution>): TokosSwapExecution {
  return {
    provider: '1delta',
    permissions: [],
    transactions: [],
    alternatives: [],
    raw: { success: true, actions: null },
    ...overrides,
  }
}

describe('selectExecutionPlan', () => {
  it('runs permissions, setup transactions, and exactly one selected alternative', () => {
    const permission = tx('1')
    const setup = tx('2')
    const firstRoute = tx('3')
    const secondRoute = tx('4')

    const plan = selectExecutionPlan(
      execution({
        permissions: [permission],
        transactions: [setup],
        alternatives: [firstRoute, secondRoute],
      }),
      1,
    )

    expect(plan.permissions).toEqual([permission])
    expect(plan.swapTransactions).toEqual([setup, secondRoute])
  })

  it('uses ordered transactions when no alternatives exist', () => {
    const first = tx('5')
    const second = tx('6')
    expect(selectExecutionPlan(execution({ transactions: [first, second] })).swapTransactions).toEqual([first, second])
  })

  it('fails closed when 1delta returns no executable action', () => {
    expect(() => selectExecutionPlan(execution({}))).toThrow('1delta returned no executable swap transaction')
  })
})
