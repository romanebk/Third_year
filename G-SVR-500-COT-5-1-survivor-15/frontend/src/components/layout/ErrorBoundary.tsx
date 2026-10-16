import { Component, type ReactNode } from 'react';
import { ServerErrorPage } from '@/features/legal/ServerErrorPage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Filet de sécurité applicatif : affiche l'écran d'erreur 500 plutôt qu'une page blanche. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Erreur applicative non gérée :', error);
  }

  render() {
    if (this.state.hasError) {
      return <ServerErrorPage onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
