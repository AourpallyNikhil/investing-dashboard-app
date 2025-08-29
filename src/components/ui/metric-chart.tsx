'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Area,
  AreaChart,
} from 'recharts'
import { ChartDataPoint } from '@/lib/types'

interface MetricChartProps {
  data: ChartDataPoint[]
  type?: 'line' | 'area' | 'composed'
  height?: number
  lines?: Array<{
    key: string
    name: string
    color: string
    yAxisId?: string
  }>
  yAxes?: Array<{
    id: string
    orientation: 'left' | 'right'
    domain?: [number | 'auto', number | 'auto']
  }>
  className?: string
}

export function MetricChart({
  data,
  type = 'line',
  height = 320,
  lines = [{ key: 'value', name: 'Value', color: '#8884d8' }],
  yAxes = [{ id: 'left', orientation: 'left' }],
  className,
}: MetricChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  const formatValue = (value: unknown, key: string): string => {
    if (typeof value !== 'number') return String(value)
    
    // Format based on the key
    if (key.includes('margin') || key.includes('yield') || key.includes('yoy')) {
      return `${(value * 100).toFixed(2)}%`
    }
    if (key.includes('price') || key.includes('close')) {
      return `$${value.toFixed(2)}`
    }
    if (key.includes('volume')) {
      return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)
    }
    if (key.includes('revenue') || key.includes('income')) {
      return `$${new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)}M`
    }
    
    return value.toLocaleString()
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: unknown; dataKey: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {label ? formatDate(label) : 'N/A'}
          </p>
          {payload.map((entry, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatValue(entry.value, entry.dataKey)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (type === 'composed') {
    return (
      <div className={className}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              className="text-xs"
            />
            {yAxes.map((axis) => (
              <YAxis
                key={axis.id}
                yAxisId={axis.id}
                orientation={axis.orientation}
                domain={axis.domain}
                className="text-xs"
              />
            ))}
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {lines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.color}
                strokeWidth={2}
                dot={false}
                yAxisId={line.yAxisId || 'left'}
                name={line.name}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (type === 'area') {
    return (
      <div className={className}>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              className="text-xs"
            />
            <YAxis className="text-xs" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {lines.map((line) => (
              <Area
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.color}
                fill={line.color}
                fillOpacity={0.1}
                strokeWidth={2}
                name={line.name}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate}
            className="text-xs"
          />
          <YAxis className="text-xs" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              name={line.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
