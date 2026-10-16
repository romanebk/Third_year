import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useSessionStore } from '@/store/session';

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useSessionStore.setState({ user: null, accessToken: null });
  });

  it('redirige vers /connexion avec redirect', () => {
    render(
      <MemoryRouter
        initialEntries={['/app/carte']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/app/carte"
            element={
              <ProtectedRoute roles={['candidate']}>
                <p>secret</p>
              </ProtectedRoute>
            }
          />
          <Route path="/connexion" element={<p>login</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('login')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});
