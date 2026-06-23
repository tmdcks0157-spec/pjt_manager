'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

interface ChartData {
  label: string
  completed: number
}

interface TooltipPayload {
  value: number
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs shadow-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}: </span>
      <span className="font-semibold text-green-600 dark:text-green-400">{payload[0].value}개</span>
    </div>
  )
}

export default function CompletionBarChart({ data, highlightIndex }: {
  data: ChartData[]
  highlightIndex?: number
}) {
  const max = Math.max(...data.map(d => d.completed), 1)

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} barCategoryGap="30%">
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide domain={[0, max + 1]} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          content={<ChartTooltip />}
        />
        <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={i === highlightIndex ? '#22c55e' : '#bbf7d0'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
