import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TestTrustDemo from './TestTrustDemo.js';

describe('TestTrustDemo — Act 1 (grip)', () => {
  it('shows the surviving boundary mutant after running with base tests', () => {
    render(<TestTrustDemo />);
    fireEvent.click(screen.getByRole('button', { name: /run mutation testing/i }));
    expect(screen.getByText(/1 survived/i)).toBeInTheDocument();
    expect(screen.getByText(/75%/)).toBeInTheDocument();
  });

  it('kills the survivor after strengthening the test', () => {
    render(<TestTrustDemo />);
    fireEvent.click(screen.getByRole('button', { name: /strengthen the test/i }));
    fireEvent.click(screen.getByRole('button', { name: /run mutation testing/i }));
    expect(screen.getByText(/0 survived/i)).toBeInTheDocument();
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });
});

describe('TestTrustDemo — Act 2 (intent)', () => {
  it('surfaces the test name vs assertion contradiction', () => {
    render(<TestTrustDemo />);
    expect(screen.getByText(/disagrees with itself/i)).toBeInTheDocument();
  });

  it('marks a guess unsafe and confirming intent safe', () => {
    render(<TestTrustDemo />);
    fireEvent.click(screen.getByRole('button', { name: /flip the code to >= 50/i }));
    expect(screen.getByTestId('intent-verdict')).toHaveTextContent(/^Unsafe$/);

    fireEvent.click(screen.getByRole('button', { name: /stop and confirm the intended rule/i }));
    expect(screen.getByTestId('intent-verdict')).toHaveTextContent(/^Safe$/);
  });
});
