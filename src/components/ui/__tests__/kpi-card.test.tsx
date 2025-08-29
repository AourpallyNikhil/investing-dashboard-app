import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiCard } from '../kpi-card'

describe('KpiCard', () => {
  it('renders title and value correctly', () => {
    render(
      <KpiCard
        title="Test Metric"
        value={42}
        unit="ratio"
      />
    )

    expect(screen.getByText('Test Metric')).toBeInTheDocument()
    expect(screen.getByText('42.00')).toBeInTheDocument()
  })

  it('formats percentage values correctly', () => {
    render(
      <KpiCard
        title="Growth Rate"
        value={0.15}
        unit="%"
      />
    )

    expect(screen.getByText('15.00%')).toBeInTheDocument()
  })

  it('formats currency values correctly', () => {
    render(
      <KpiCard
        title="Revenue"
        value={1500000}
        unit="USD"
      />
    )

    expect(screen.getByText('$1.5M')).toBeInTheDocument()
  })

  it('displays change information when provided', () => {
    render(
      <KpiCard
        title="Stock Price"
        value={100}
        change={5.5}
        changeLabel="vs yesterday"
        trend="up"
      />
    )

    expect(screen.getByText('+5.50%')).toBeInTheDocument()
    expect(screen.getByText('vs yesterday')).toBeInTheDocument()
  })

  it('shows correct trend colors', () => {
    const { rerender } = render(
      <KpiCard
        title="Test"
        value={100}
        change={5}
        trend="up"
      />
    )

    let badge = screen.getByText('+5.00%')
    expect(badge).toHaveClass('text-green-600')

    rerender(
      <KpiCard
        title="Test"
        value={100}
        change={-3}
        trend="down"
      />
    )

    badge = screen.getByText('-3.00%')
    expect(badge).toHaveClass('text-red-600')
  })
})
