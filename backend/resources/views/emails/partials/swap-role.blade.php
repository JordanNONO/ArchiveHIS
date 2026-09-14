{{-- Ligne "ancien -> nouveau", centree, table 3 colonnes pour rester compatible
Outlook (pas de flexbox). Attend : $ancien (nullable), $nouveau. Si $ancien est
vide (tout premier role attribue), la fleche et l'ancien role sont omis. --}}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
<tr>
@if($ancien)
<td style="font-size:12px;color:#9ca3af;text-decoration:line-through;padding-right:12px;">{{ $ancien }}</td>
<td style="font-size:18px;color:#92650a;font-weight:700;padding-right:12px;">&rarr;</td>
@endif
<td style="font-size:19px;color:#1B365D;font-weight:800;">{{ $nouveau }}</td>
</tr>
</table>
