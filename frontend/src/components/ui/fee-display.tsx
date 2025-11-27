import { formatEther } from 'viem'
import { Info } from 'lucide-react'

interface FeeDisplayProps {
    feeAmount: bigint
    feeSymbol?: string
    feeUSD?: string
    type: 'submission' | 'claim'
    refundable?: boolean
    className?: string
}

export function FeeDisplay({
    feeAmount,
    feeSymbol = 'CELO',
    feeUSD = '0.02',
    type,
    refundable = false,
    className = ''
}: FeeDisplayProps) {
    const feeInEther = formatEther(feeAmount)

    return (
        <div className={`rounded-lg border border-brand-green/30 bg-brand-green/5 p-4 ${className}`}>
            <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-brand-green flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-300">
                            {type === 'submission' ? 'Submission Fee' : 'Claim Fee'}
                        </span>
                        <span className="font-bold text-brand-green">
                            {feeInEther} {feeSymbol}
                            {feeUSD && (
                                <span className="text-sm font-normal text-muted-foreground ml-2">
                                    (~${feeUSD} USD)
                                </span>
                            )}
                        </span>
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <p>+ network gas fees (varies)</p>
                        {refundable && (
                            <p className="text-brand-green">
                                ✅ Full refund if submission is rejected
                            </p>
                        )}
                        {type === 'submission' && (
                            <p className="text-gray-400">
                                Fees go to treasury: 0x173d...56b4
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
