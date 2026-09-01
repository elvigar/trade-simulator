'use client'

import { useCallback, useMemo, useState } from 'react'
import Header from './Header'
import WatchlistPanel from './WatchlistPanel'
import MainChart from './MainChart'
import PortfolioHeatmap from './PortfolioHeatmap'
import PnLChart from './PnLChart'
import PositionsTable from './PositionsTable'
import TradeBar from './TradeBar'
import ChatPanel from './ChatPanel'
import { usePriceStream } from '@/hooks/usePriceStream'
import { usePortfolio } from '@/hooks/usePortfolio'
import { useWatchlist } from '@/hooks/useWatchlist'
import { usePortfolioHistory } from '@/hooks/usePortfolioHistory'
import { useChat } from '@/hooks/useChat'
import { computePositionMetrics, computeTotalValue } from '@/lib/portfolio'

export default function TradingTerminal() {
  const { prices, status, getHistory } = usePriceStream()
  const { portfolio, refresh: refreshPortfolio } = usePortfolio()
  const { watchlist, addTicker, removeTicker, refresh: refreshWatchlist } = useWatchlist()
  const { history: portfolioHistory, refresh: refreshHistory } = usePortfolioHistory()
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useState(true)

  const refreshAfterActions = useCallback(() => {
    refreshPortfolio()
    refreshWatchlist()
    refreshHistory()
  }, [refreshPortfolio, refreshWatchlist, refreshHistory])

  const { messages, sending, sendMessage } = useChat(refreshAfterActions)

  const positionMetrics = useMemo(
    () => (portfolio?.positions ?? []).map((p) => computePositionMetrics(p, prices[p.ticker]?.price)),
    [portfolio?.positions, prices],
  )

  const totalValue = portfolio ? computeTotalValue(portfolio.cash_balance, positionMetrics) : 0
  const effectiveSelected = selectedTicker ?? watchlist[0]?.ticker ?? null

  function handleTraded() {
    refreshPortfolio()
    refreshHistory()
  }

  async function handleRemove(ticker: string) {
    await removeTicker(ticker)
    if (selectedTicker === ticker) {
      setSelectedTicker(null)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <Header totalValue={totalValue} cashBalance={portfolio?.cash_balance ?? 0} status={status} />

      <div className="flex flex-1 gap-2 overflow-hidden p-2">
        <div className="w-72 shrink-0">
          <WatchlistPanel
            watchlist={watchlist}
            prices={prices}
            getHistory={getHistory}
            selectedTicker={effectiveSelected}
            onSelect={setSelectedTicker}
            onAdd={addTicker}
            onRemove={handleRemove}
          />
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          <div className="h-72 shrink-0">
            <MainChart
              ticker={effectiveSelected}
              price={effectiveSelected ? prices[effectiveSelected] : undefined}
              history={effectiveSelected ? getHistory(effectiveSelected) : []}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 h-64 shrink-0">
            <PortfolioHeatmap positions={positionMetrics} />
            <PnLChart history={portfolioHistory} />
          </div>

          <div className="min-h-[220px] flex-1">
            <PositionsTable positions={positionMetrics} />
          </div>

          <TradeBar defaultTicker={effectiveSelected} onTraded={handleTraded} />
        </div>

        <div className={chatOpen ? 'w-80 shrink-0' : 'shrink-0'}>
          <ChatPanel
            open={chatOpen}
            onToggle={() => setChatOpen((v) => !v)}
            messages={messages}
            sending={sending}
            onSend={sendMessage}
          />
        </div>
      </div>
    </div>
  )
}
