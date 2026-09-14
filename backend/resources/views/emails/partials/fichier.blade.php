{{-- Carte fichier : pastille couleur avec l'extension + titre + lignes de meta.
Attend : $extension, $bg, $fg, $titre, $meta (tableau de chaines, optionnel) --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:22px;">
<tr>
<td width="56" style="padding:18px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0">
<tr>
<td width="48" height="48" align="center" valign="middle" style="background-color:{{ $bg }};color:{{ $fg }};border-radius:10px;font-size:11px;font-weight:700;letter-spacing:0.3px;">{{ $extension }}</td>
</tr>
</table>
</td>
<td style="padding:18px 20px 18px 0;">
<div style="font-size:15px;font-weight:700;color:#1B365D;margin-bottom:4px;">{{ $titre }}</div>
@foreach($meta ?? [] as $ligneMeta)
<div style="font-size:12.5px;color:#6b7280;">{{ $ligneMeta }}</div>
@endforeach
</td>
</tr>
</table>
