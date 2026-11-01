import { SOURCE_LABELS, type AnalyticsDTO } from '@recruitflow/shared';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ErrorState, PageHeader } from '@/components/ui/feedback';
import { NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RANGES, type Range } from '@/features/dashboard/DashboardPage';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useState } from 'react';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

export function AnalyticsPage() {
  useDocumentTitle('Analytics');
  const [range, setRange] = useState<Range>('30d');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['analytics', range],
    queryFn: () => api.get<AnalyticsDTO>('/analytics', { range }),
  });

  const kpis = data
    ? [
        { label: 'Time to hire', value: `${data.kpis.timeToHireDays} days` },
        { label: 'Cost per hire', value: formatCurrency(data.kpis.costPerHire) },
        { label: 'Offer acceptance', value: `${data.kpis.offerAcceptance}%` },
        { label: 'Application → Interview', value: `${data.kpis.applicationToInterview}%` },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Recruitment analytics"
        description="Funnel conversion, source quality and time-to-hire for this workspace."
        actions={
          <NativeSelect value={range} onChange={(e) => setRange(e.target.value as Range)} className="w-40">
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </NativeSelect>
        }
      />
      {isError ? (
        <ErrorState message="We couldn't load analytics." onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading
              ? kpisPlaceholder()
              : kpis.map((k) => (
                  <Card key={k.label} className="p-5">
                    <p className="text-sm text-muted-foreground">{k.label}</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums">{k.value}</p>
                  </Card>
                ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader title="Applications over time" />
              <CardContent className="h-72">
                {data ? (
                  <ResponsiveContainer>
                    <LineChart data={data.applicationsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="applications" stroke="#6366f1" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="interviews" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="hires" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Skeleton className="h-full" />
                )}
              </CardContent>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader title="Source mix" />
              <CardContent className="h-72">
                {data ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={data.sources} dataKey="share" nameKey="label" innerRadius={50} outerRadius={80}>
                        {data.sources.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Skeleton className="h-full" />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader title="Hiring funnel" />
            <CardContent className="h-72">
              {data ? (
                <ResponsiveContainer>
                  <BarChart data={data.funnel} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Skeleton className="h-full" />
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Source performance" description="Where hires actually come from — not just applications." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Source</th>
                    <th className="px-3 py-3 font-medium">Applications</th>
                    <th className="px-3 py-3 font-medium">Interviews</th>
                    <th className="px-3 py-3 font-medium">Offers</th>
                    <th className="px-3 py-3 font-medium">Hires</th>
                    <th className="px-3 py-3 font-medium">Conversion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.sources ?? []).map((s) => (
                    <tr key={s.source}>
                      <td className="px-5 py-3 font-medium">{SOURCE_LABELS[s.source] ?? s.label}</td>
                      <td className="px-3 py-3 tabular-nums">{formatNumber(s.applications)}</td>
                      <td className="px-3 py-3 tabular-nums">{formatNumber(s.interviews)}</td>
                      <td className="px-3 py-3 tabular-nums">{formatNumber(s.offers)}</td>
                      <td className="px-3 py-3 tabular-nums">{formatNumber(s.hires)}</td>
                      <td className="px-3 py-3 tabular-nums">{s.conversion}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function kpisPlaceholder() {
  return Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />);
}
