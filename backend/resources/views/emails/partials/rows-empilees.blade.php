{{-- Lignes label/valeur empilees verticalement (label au-dessus, valeur en
dessous) - contrairement a partials/rows.blade.php (cote a cote, reserve aux
valeurs courtes comme des nombres), celle-ci reste lisible avec un contenu
qui peut etre long (nom de role, adresse email...) sans jamais desaligner
label et valeur sur un petit ecran.
Attend : $lignes = [['label', 'valeur', 'couleur' => optionnel,
'taille' => optionnel, 'gras' => optionnel, 'barre' => optionnel bool]] --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
@foreach($lignes as $ligne)
<tr>
<td style="{{ $loop->last ? '' : 'padding-bottom:14px;' }}">
<div style="font-size:10.5px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px;">{{ $ligne['label'] }}</div>
<div style="font-size:{{ $ligne['taille'] ?? '14px' }};color:{{ $ligne['couleur'] ?? '#1B365D' }};font-weight:{{ $ligne['gras'] ?? '700' }};{{ !empty($ligne['barre']) ? 'text-decoration:line-through;' : '' }}line-height:1.4;">{{ $ligne['valeur'] }}</div>
</td>
</tr>
@endforeach
</table>
