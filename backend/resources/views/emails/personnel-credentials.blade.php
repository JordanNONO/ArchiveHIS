<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Votre compte HIS Archivage</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 0;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;max-width:600px;">

<tr>
<td style="background-color:#1B365D;padding:36px 40px;text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px auto;">
<tr>
<td style="background-color:#ffffff;border-radius:14px;padding:10px 14px;">
<img src="{{ $message->embed(public_path('images/his-logo.png')) }}" width="48" alt="HIS" style="display:block;">
</td>
</tr>
</table>
<div style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:0.6px;">HETEP IAOUT SERVICES</div>
<div style="color:#FACC15;font-size:12px;margin-top:3px;letter-spacing:0.2px;">L'utilité sur le chemin de la sérénité</div>
</td>
</tr>

<tr>
<td style="padding:40px;">
<p style="font-size:15px;color:#1f2937;line-height:1.6;margin:0 0 20px 0;">
Bonjour <strong>{{ $prenom }}</strong>,<br><br>
Votre compte sur <strong>HIS Archivage</strong>, la plateforme d'archivage documentaire de Hetep Iaout Services, vient d'être créé. Voici vos identifiants de connexion.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:20px;">
<tr>
<td style="padding:22px 24px;">
<div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px;">Identifiant</div>
<div style="font-size:15px;color:#1B365D;font-weight:600;margin-bottom:16px;">{{ $email }}</div>
<div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px;">Mot de passe temporaire</div>
<div style="font-size:16px;color:#1B365D;font-weight:700;font-family:Consolas,monospace;letter-spacing:0.5px;">{{ $motDePasse }}</div>
</td>
</tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #FACC15;margin-bottom:24px;">
<tr>
<td style="padding:12px 16px;">
<div style="font-size:13px;color:#6b7280;">Pour votre sécurité, changez ce mot de passe dès votre première connexion, depuis votre profil.</div>
</td>
</tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
<tr>
<td style="background-color:#1B365D;border-radius:10px;">
<a href="{{ config('app.frontend_url') }}/login" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Se connecter à HIS Archivage</a>
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td style="background-color:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
<div style="font-size:12px;color:#9ca3af;">Hetep Iaout Services — Aide à domicile, garde d'enfants, accompagnement du handicap et transport PMR en Île-de-France.</div>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
