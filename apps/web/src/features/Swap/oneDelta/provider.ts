import { OneDeltaClient } from './client'
import type { OneDeltaSpotSwapRequest, TokosSwapExecution, TokosSwapQuote } from './types'

export interface SwapProvider {
  getQuote(input: Omit<OneDeltaSpotSwapRequest, 'account'>): Promise<TokosSwapQuote>
  buildSwap(input: OneDeltaSpotSwapRequest & { account: `0x${string}` }): Promise<TokosSwapExecution>
}

export class OneDeltaSwapProvider implements SwapProvider {
  constructor(private readonly client: OneDeltaClient) {}

  getQuote(input: Omit<OneDeltaSpotSwapRequest, 'account'>): Promise<TokosSwapQuote> {
    return this.client.getSpotQuote(input)
  }

  buildSwap(input: OneDeltaSpotSwapRequest & { account: `0x${string}` }): Promise<TokosSwapExecution> {
    return this.client.buildSpotSwap(input)
  }
}
