function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#F4F5F3;font-family:Inter,Arial,sans-serif;color:#141715;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <tr><td style="padding-bottom:24px;">
      <span style="display:inline-flex;align-items:center;gap:8px;font-weight:800;font-size:16px;color:#1B4332;">
        <span style="display:inline-block;width:14px;height:14px;background:#1B4332;border-radius:50% 50% 50% 12%;"></span>
        GéoEmploi
      </span>
    </td></tr>
    <tr><td style="background:#FFFFFF;border:1px solid #E4E6E3;border-radius:16px;padding:28px;">
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding-top:20px;font-size:11.5px;color:#6B726E;line-height:1.5;">
      Démonstrateur technique, ne constitue pas un service public en exploitation.<br>
      © 2026 GéoEmploi
    </td></tr>
  </table>
</body>
</html>`;
}

export function registrationEmail(firstName: string | undefined): string {
  return layout(
    'Bienvenue sur GéoEmploi',
    `
    <h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em;margin:0 0 12px;">
      Bienvenue${firstName ? ` ${firstName}` : ''}
    </h1>
    <p style="font-size:14.5px;line-height:1.6;color:#4A4F4B;margin:0 0 16px;">
      Votre compte GéoEmploi est créé. Vous pouvez dès maintenant ouvrir la carte pour repérer
      les offres autour de vous.
    </p>
    <a href="#" style="display:inline-block;background:#C8E6C0;color:#141715;font-weight:700;
      font-size:13.5px;padding:11px 20px;border-radius:12px;text-decoration:none;">
      Ouvrir la carte
    </a>
    `,
  );
}

export function resetPasswordEmail(resetLink: string): string {
  return layout(
    'Réinitialisation de mot de passe',
    `
    <h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em;margin:0 0 12px;">
      Réinitialisez votre mot de passe
    </h1>
    <p style="font-size:14.5px;line-height:1.6;color:#4A4F4B;margin:0 0 16px;">
      Une demande de réinitialisation a été faite pour ce compte. Le lien expire rapidement.
      Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.
    </p>
    <a href="${resetLink}" style="display:inline-block;background:#1B4332;color:#FFFFFF;font-weight:700;
      font-size:13.5px;padding:11px 20px;border-radius:12px;text-decoration:none;">
      Choisir un nouveau mot de passe
    </a>
    `,
  );
}

export function applicationReceivedEmail(offerTitle: string, candidateName: string): string {
  return layout(
    'Nouvelle candidature',
    `
    <h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em;margin:0 0 12px;">
      Nouvelle candidature reçue
    </h1>
    <p style="font-size:14.5px;line-height:1.6;color:#4A4F4B;margin:0 0 16px;">
      ${candidateName} a postulé à votre offre « ${offerTitle} ». Retrouvez le détail de sa
      candidature dans votre tableau de bord.
    </p>
    <a href="#" style="display:inline-block;background:#1B4332;color:#FFFFFF;font-weight:700;
      font-size:13.5px;padding:11px 20px;border-radius:12px;text-decoration:none;">
      Voir la candidature
    </a>
    `,
  );
}
