import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { loginSchema } from './schemas';
import { LoginPage } from './LoginPage';

describe('loginSchema', () => {
  it('refuse un email invalide', () => {
    const r = loginSchema.safeParse({ email: 'pas-un-email', password: 'x' });
    expect(r.success).toBe(false);
  });

  it('accepte un email et un mot de passe', () => {
    const r = loginSchema.safeParse({ email: 'yasmine@demo.fr', password: 'Demo1234567' });
    expect(r.success).toBe(true);
  });
});

describe('LoginPage', () => {
  it('associe les labels aux champs', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mot de passe/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
  });
});
