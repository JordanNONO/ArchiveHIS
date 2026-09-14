{{-- Liste de lignes label/valeur alignees (table 2 colonnes, pas de flexbox).
Attend : $lignes = [['label' => ..., 'valeur' => ..., 'couleur' => optionnel]] --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
@foreach($lignes as $ligne)
<tr>
<td width="45%" style="padding:11px 0;font-size:10.5px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.4px;{{ $loop->last ? '' : 'border-bottom:1px solid #e5e7eb;' }}">{{ $ligne['label'] }}</td>
<td style="padding:11px 0;font-size:13px;color:{{ $ligne['couleur'] ?? '#1B365D' }};font-weight:700;text-align:right;{{ !empty($ligne['barre']) ? 'text-decoration:line-through;font-weight:400;' : '' }}{{ $loop->last ? '' : 'border-bottom:1px solid #e5e7eb;' }}">{{ $ligne['valeur'] }}</td>
</tr>
@endforeach
</table>
