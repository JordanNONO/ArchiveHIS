{{-- Encart avec liseré doré à gauche, pour une explication/citation/remarque secondaire. Attend : $texte, $couleur (optionnel, defaut doré) --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid {{ $couleur ?? '#FACC15' }};margin-bottom:22px;">
<tr>
<td style="padding:11px 15px;">
<div style="font-size:12.5px;color:#6b7280;line-height:1.55;">{{ $texte }}</div>
</td>
</tr>
</table>
