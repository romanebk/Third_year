import { Link } from 'react-router-dom';
import { Button } from './Button';

export function AuthWall({
  title = 'Créez un compte pour continuer',
  body = 'Les filtres, la candidature et le suivi sont réservés aux inscrits. La carte reste consultable, mais les fiches se floutent après trois lectures.',
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-paper/55 backdrop-blur-md" />
      <div className="relative max-w-md rounded-block bg-paper p-7 text-center shadow-card">
        <h2 className="text-[24px]">{title}</h2>
        <p className="mx-auto mt-3 max-w-[42ch] text-[14.5px] text-muted">{body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/inscription">
            <Button variant="lime">Créer un compte</Button>
          </Link>
          <Link to="/connexion">
            <Button variant="outline">Se connecter</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
