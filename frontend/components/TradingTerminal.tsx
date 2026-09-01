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
import { useCurrency } from '@/hooks/useCurrency'
import { computePositionMetrics, computeTotalValue } from '@/lib/portfolio'

export default function TradingTerminal() {
  const { prices, status, getHistory } = usePriceStream()
  const { portfolio, refresh: refreshPortfolio } = usePortfolio()
  const { watchlist, addTicker, removeTicker, refresh: refreshWatchlist } = useWatchlist()
  const { history: portfolioHistory, refresh: refreshHistory } = usePortfolioHistory()
  const { currencies, displayCurrency, setDisplayCurrency, rates } = useCurrency()
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
  const investedValue = positionMetrics.reduce((sum, p) => sum + p.marketValue, 0)
  const effectiveSelected = selectedTicker ?? watchlist[0]?.ticker ?? null
  const selectedPosition = effectiveSelected
    ? positionMetrics.find((position) => position.ticker === effectiveSelected)
    : undefined

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
      <Header
        totalValue={totalValue}
        cashBalance={portfolio?.cash_balance ?? 0}
        investedValue={investedValue}
        totalUnrealizedPnl={portfolio?.total_unrealized_pnl ?? 0}
        status={status}
        displayCurrency={displayCurrency}
        currencies={currencies}
        rates={rates}
        onCurrencyChange={setDisplayCurrency}
      />

      <div className="flex flex-1 gap-2 overflow-hidden p-2.5">
        <div className="w-72 shrink-0">
          <WatchlistPanel
            watchlist={watchlist}
            prices={prices}
            getHistory={getHistory}
            selectedTicker={effectiveSelected}
            displayCurrency={displayCurrency}
            rates={rates}
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
              displayCurrency={displayCurrency}
              rates={rates}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 h-64 shrink-0">
            <PortfolioHeatmap positions={positionMetrics} displayCurrency={displayCurrency} rates={rates} />
            <PnLChart history={portfolioHistory} displayCurrency={displayCurrency} rates={rates} />
          </div>

          <div className="min-h-[220px] flex-1">
            <PositionsTable positions={positionMetrics} displayCurrency={displayCurrency} rates={rates} />
          </div>

          <TradeBar
            defaultTicker={effectiveSelected}
            currentPrice={effectiveSelected ? prices[effectiveSelected]?.price : undefined}
            cashBalance={portfolio?.cash_balance ?? 0}
            heldQuantity={selectedPosition?.quantity ?? 0}
            displayCurrency={displayCurrency}
            rates={rates}
            onTraded={handleTraded}
          />
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
