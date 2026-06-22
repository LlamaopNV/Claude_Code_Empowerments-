import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OverheadPoint } from '../dataLayer.js';
import { Panel, EmptyState } from './primitives.js';

/**
 * Per-case treatment vs baseline token cost (Recharts). The overhead is the
 * extra cost the artifact adds; an empty state explains when traces are absent.
 */
export function CostOverheadChart({ points }: { points: OverheadPoint[] }): JSX.Element {
  if (points.length === 0) {
    return (
      <Panel title="Cost / latency overhead">
        <EmptyState title="No per-case cost data">
          Cost overhead needs both a treatment and a baseline trace per case. None were resolvable
          for this run (the live server exposes traces via <code>/api/traces/:id</code>).
        </EmptyState>
      </Panel>
    );
  }
  return (
    <Panel title="Cost overhead: treatment vs baseline (tokens)">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e222b" vertical={false} />
            <XAxis
              dataKey="caseId"
              tick={{ fill: '#8b919e', fontSize: 11 }}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={60}
              stroke="#2b313d"
            />
            <YAxis tick={{ fill: '#8b919e', fontSize: 11 }} stroke="#2b313d" />
            <Tooltip
              cursor={{ fill: 'rgba(91,157,255,0.06)' }}
              contentStyle={{
                background: '#101218',
                border: '1px solid #2b313d',
                borderRadius: 10,
                color: '#e7e9ee',
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#8b919e' }} />
            <Bar dataKey="baselineTokens" name="Baseline" fill="#5b616e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="treatmentTokens" name="Treatment" fill="#5b9dff" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
