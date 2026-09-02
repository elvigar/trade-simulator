'use client'

import { useCallback, useMemo, useState } from 'react'
import Header from './Header'
import WatchlistPanel from './WatchlistPanel'
import MainChart from './MainChart'
import PortfolioPanel from './PortfolioPanel'
import PnLChart from './PnLChart'
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-2.5 md:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_20rem] xl:overflow-hidden">
        <div className="min-w-0 md:w-72 md:shrink-0">
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

        <div className="min-w-0 flex flex-col gap-2 xl:overflow-y-auto">
          <div className="min-h-[18rem] shrink-0">
            <MainChart
              ticker={effectiveSelected}
              price={effectiveSelected ? prices[effectiveSelected] : undefined}
              history={effectiveSelected ? getHistory(effectiveSelected) : []}
              displayCurrency={displayCurrency}
              rates={rates}
            />
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

          <div className="grid min-h-[18rem] flex-1 grid-cols-1 gap-2 lg:grid-cols-[2fr_1fr]">
            <PortfolioPanel positions={positionMetrics} displayCurrency={displayCurrency} rates={rates} />
            <PnLChart history={portfolioHistory} displayCurrency={displayCurrency} rates={rates} />
          </div>
        </div>

        <div className="min-w-0 md:col-span-2 xl:col-span-1 xl:w-80 xl:shrink-0">
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
