import type { SwapRedirectFn } from 'uniswap/src/features/transactions/components/TransactionModal/TransactionModalContext'
import type { SwapFormState } from 'uniswap/src/features/transactions/swap/stores/swapFormStore/types'
import type { CurrencyState } from '~/features/Swap/state/types'
import { TokosSwap } from '~/features/TokosSwap/TokosSwap'

export interface SwapFormProps {
  hideHeader?: boolean
  hideFooter?: boolean
  prefilledState?: SwapFormState
  onCurrencyChange?: (selected: CurrencyState, isBridgePair?: boolean) => void
  swapRedirectCallback?: SwapRedirectFn
  tokenColor?: string
  onCurrencyPanelsLayout?: (height: number) => void
}

export function SwapFormSettingsButton(): JSX.Element {
  return <></>
}

export function SwapForm(_props: SwapFormProps): JSX.Element {
  return <TokosSwap />
}
