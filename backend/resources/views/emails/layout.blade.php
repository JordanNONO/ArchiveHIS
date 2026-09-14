<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>@yield('title', 'HIS Archivage')</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 0;">
<tr>
<td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;max-width:560px;">

{{-- En-tête façon lettre à en-tête, sur 2 lignes (pas 3 colonnes sur une
seule ligne) : logo + nom d'abord, référence + date juste en dessous. Un tag
un peu long ("NOTIF-SÉCURITÉ") ou un écran étroit ne font donc jamais
collision avec le nom, chaque ligne ayant toute la largeur pour elle. --}}
<tr>
<td style="padding:24px 34px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td width="58" valign="middle">
<img src="{{ $message->embed(public_path('images/his-logo.png')) }}" width="46" alt="HIS" style="display:block;">
</td>
<td valign="middle">
<div style="font-size:12px;font-weight:700;color:#1B365D;line-height:1.3;">Hetep Iaout Services</div>
<div style="font-size:9.5px;color:#9ca3af;margin-top:1px;">HIS Archivage</div>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:10px 34px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
<tr>
<td style="padding-top:10px;font-size:10px;font-weight:700;color:#92650a;letter-spacing:0.4px;">{{ $tag ?? 'NOTIF' }}</td>
<td style="padding-top:10px;font-size:10px;color:#9ca3af;text-align:right;">{{ now()->locale('fr')->translatedFormat('d F Y') }}</td>
</tr>
</table>
</td>
</tr>

{{-- Titre + trait doré, comme un objet de courrier --}}
<tr>
<td style="padding:24px 34px 0;">
<div style="font-size:23px;font-weight:800;color:#1B365D;letter-spacing:-0.3px;margin-bottom:10px;">{{ $titre }}</div>
<div style="width:40px;height:4px;background-color:#FACC15;border-radius:2px;margin-bottom:22px;line-height:4px;font-size:0;">&nbsp;</div>
</td>
</tr>

{{-- Contenu propre à chaque e-mail --}}
<tr>
<td style="padding:0 34px 4px;">
@yield('content')
</td>
</tr>

{{-- Bloc signature --}}
<tr>
<td style="padding:16px 34px 30px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
<tr>
<td style="padding-top:16px;text-align:right;">
<div style="font-size:11px;font-weight:700;color:#1f2937;">{{ $signataire ?? 'Le service Administration' }}</div>
<div style="font-size:9.5px;color:#9ca3af;">HIS Archivage — Plateforme d'archivage documentaire</div>
</td>
</tr>
</table>
</td>
</tr>

{{-- Pied de page légal --}}
<tr>
<td style="background-color:#f9fafb;padding:16px 34px;text-align:center;border-top:1px solid #e5e7eb;">
<div style="font-size:10px;color:#9ca3af;">Hetep Iaout Services — Aide à domicile, garde d'enfants, accompagnement du handicap et transport PMR en Île-de-France.</div>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
