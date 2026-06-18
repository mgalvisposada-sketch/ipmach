'use client';

import { useState, useEffect } from 'react';
import { useApiCall } from '@/lib/api-client';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';

interface DayData {
    date: string;
    count: number;
    label: string;
}

export function SearchesByDayChart() {
    const [data, setData] = useState<DayData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const apiCall = useApiCall();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiCall('/api/dashboard/searches-by-day');
                if (res.ok) {
                    const json = await res.json();
                    const raw = (json.data || []) as { date: string; count: number }[];
                    setData(
                        raw.map(({ date, count }) => ({
                            date,
                            count,
                            label: formatDayShort(date),
                        }))
                    );
                }
            } catch {
                setData([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [apiCall]);

    const total = data.reduce((s, d) => s + d.count, 0);
    const maxEntry = data.reduce(
        (best, d) => (d.count > (best?.count ?? 0) ? d : best),
        null as DayData | null
    );

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-sm font-medium text-gray-700">
                    Aún no hay consultas en los últimos 7 días
                </p>
                <p className="text-xs text-gray-500 mt-1">
                    Cuando busques referencias, aquí verás tu actividad.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold text-gray-900">
                    {total} {total === 1 ? 'consulta' : 'consultas'} esta semana
                </span>
                {maxEntry && maxEntry.count > 0 && (
                    <span className="text-gray-500">
                        Día más activo: {maxEntry.label} ({maxEntry.count}{' '}
                        {maxEntry.count === 1 ? 'consulta' : 'consultas'})
                    </span>
                )}
            </div>
            <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                    >
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                            tickLine={false}
                            axisLine={false}
                            width={24}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const p = payload[0].payload;
                                return (
                                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
                                        <p className="text-sm font-medium text-gray-900">
                                            {formatDayFull(p.date)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {p.count}{' '}
                                            {p.count === 1 ? 'consulta' : 'consultas'}
                                        </p>
                                    </div>
                                );
                            }}
                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                        />
                        <Bar
                            dataKey="count"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                        >
                            {data.map((entry) => (
                                <Cell
                                    key={entry.date}
                                    fill={
                                        entry.count === 0 ? '#f3f4f6' : '#eab308'
                                    }
                                    opacity={entry.count > 0 ? 0.95 : 1}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function formatDayShort(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
    });
}

function formatDayFull(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
    });
}
