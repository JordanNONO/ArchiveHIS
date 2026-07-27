<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{ $isExternal ? 'Document transmis par Hetep Iaout Services' : 'Document partagé sur HIS Archivage' }}</title>
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
@if($isExternal)
<p style="font-size:15px;color:#1f2937;line-height:1.6;margin:0 0 20px 0;">
Bonjour,<br><br>
<strong>Hetep Iaout Services</strong> vous transmet, de la part de <strong>{{ $expediteurNom }}</strong>, le document suivant.
</p>
@elseif($serviceNom)
<p style="font-size:15px;color:#1f2937;line-height:1.6;margin:0 0 20px 0;">
Bonjour,<br><br>
<strong>{{ $expediteurNom }}</strong> a transmis un document au <strong>service {{ $serviceNom }}</strong>, dont vous faites partie.
</p>
@else
<p style="font-size:15px;color:#1f2937;line-height:1.6;margin:0 0 20px 0;">
Bonjour,<br><br>
<strong>{{ $expediteurNom }}</strong> vous a partagé un document via HIS Archivage.
</p>
@endif

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:20px;">
<tr>
<td style="padding:18px 20px;" width="56">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td width="48" height="48" align="center" valign="middle" style="background-color:{{ $typeCouleur['bg'] }};color:{{ $typeCouleur['fg'] }};border-radius:10px;font-size:11px;font-weight:700;letter-spacing:0.3px;">
{{ $extension }}
</td>
</tr>
</table>
</td>
<td style="padding:18px 20px 18px 0;">
<div style="font-size:16px;font-weight:600;color:#1B365D;margin-bottom:4px;">{{ $document->titre_document }}</div>
<div style="font-size:13px;color:#6b7280;">Référence : {{ $document->code_reference }}</div>
@if($document->categorieDocument)
<div style="font-size:13px;color:#6b7280;">Catégorie : {{ $document->categorieDocument->libelle_cat }}</div>
@endif
@if($tailleLabel)
<div style="font-size:13px;color:#6b7280;">Taille : {{ $tailleLabel }}</div>
@endif
</td>
</tr>
</table>

@if($messagePersonnel)
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #FACC15;margin-bottom:24px;">
<tr>
<td style="padding:12px 16px;">
<div style="font-size:13px;color:#6b7280;font-style:italic;">"{{ $messagePersonnel }}"</div>
</td>
</tr>
</table>
@endif

<p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0;">
Le document est joint à cet e-mail.
@if($isExternal)
<br><br>Ce message vous a été envoyé par l'intermédiaire de la plateforme d'archivage interne de Hetep Iaout Services. Pour toute question, veuillez contacter directement {{ $expediteurNom }}.
@endif
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
