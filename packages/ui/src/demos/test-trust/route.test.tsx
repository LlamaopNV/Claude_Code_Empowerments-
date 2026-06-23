import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../app/App.js';

describe('App routing', () => {
  it('renders the test-trust demo at /demos/test-trust', async () => {
    render(
      <MemoryRouter initialEntries={['/demos/test-trust']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('heading', { name: /tests you can.?t trust/i }),
    ).toBeInTheDocument();
  });
});
