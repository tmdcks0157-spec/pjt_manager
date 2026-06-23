'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

interface ChartData {
  label: string
  completed: number
  created?: number
}

interface TooltipPayload {
  value: number
  dataKey: string
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs shadow-sm space-y-0.5">
      <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey}>
          <span className={p.dataKey === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-blue-500 dark:text-blue-400'}>
            {p.dataKey === 'completed' ? '완료' : '생성'}{' '}
          </span>
          <span className="font-semibold text-gray-700 dark:text-gray-200">{p.value}개</span>
        </p>
      ))}
    </div>
  )
}

export default function CompletionBarChart({ data, highlightIndex }: {
  data: ChartData[]
  highlightIndex?: number
}) {
  const hasCreated = data.some(d => d.created !== undefined)
  const max = Math.max(
    ...data.map(d => Math.max(d.completed, d.created ?? 0)),
    1
  )

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} barCategoryGap="30%" barGap={2}>
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
        {hasCreated && (
          <Bar dataKey="created" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === highlightIndex ? '#3b82f6' : '#bfdbfe'}
              />
            ))}
          </Bar>
        )}
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
