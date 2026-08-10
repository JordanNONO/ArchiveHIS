<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Décision sur votre demande de congés — Hetep Iaout Services</title>
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
Bonjour,<br><br>
Votre demande de congés a été examinée par <strong>{{ $nomSignataire }}</strong>. Vous trouverez ci-joint le formulaire complet, décision comprise.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:20px;">
<tr>
<td style="padding:20px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
<tr>
<td style="background-color:{{ $accepte ? '#E7F6EC' : '#FDECEC' }};color:{{ $accepte ? '#16A34A' : '#DC2626' }};border-radius:999px;padding:6px 14px;font-size:13px;font-weight:700;">
{{ $accepte ? 'Demande acceptée' : 'Demande refusée' }}
</td>
</tr>
</table>
<div style="font-size:15px;font-weight:600;color:#1B365D;margin-bottom:4px;">{{ $document->titre_document }}</div>
@if($document->resume)
<div style="font-size:13px;color:#6b7280;">{{ $document->resume }}</div>
@endif
</td>
</tr>
</table>

@if(!$accepte && $motif)
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #DC2626;margin-bottom:20px;">
<tr>
<td style="padding:12px 16px;">
<div style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">Motif du refus</div>
<div style="font-size:14px;color:#1f2937;line-height:1.5;">{{ $motif }}</div>
</td>
</tr>
</table>
@endif

<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0;">
Le formulaire complété est joint à cet e-mail au format PDF.<br><br>
Pour toute question sur cette décision, rapprochez-vous de votre responsable secteur.
</p>
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
