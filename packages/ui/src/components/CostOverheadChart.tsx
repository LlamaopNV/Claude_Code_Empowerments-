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
    <Panel title="Cost overhead — treatment vs baseline (tokens)">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#243049" />
            <XAxis dataKey="caseId" tick={{ fill: '#8b97ab', fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fill: '#8b97ab', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#141a26', border: '1px solid #243049', color: '#e2e8f0' }}
            />
            <Legend />
            <Bar dataKey="baselineTokens" name="Baseline" fill="#8b97ab" />
            <Bar dataKey="treatmentTokens" name="Treatment" fill="#5b9dff" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
