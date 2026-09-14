{{-- Ancien/nouveau role, empiles verticalement (pas cote a cote) : un nom de
role long ("Editeur Ressources Humaines") casse sur plusieurs lignes sur
mobile, et une mise en page horizontale avec fleche desaligne tout des que
ca arrive. Attend : $ancien (nullable), $nouveau. Si $ancien est vide (tout
premier role attribue), sa ligne est omise. --}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
@if($ancien)
<tr>
<td style="padding-bottom:14px;">
<div style="font-size:10.5px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px;">Ancien rôle</div>
<div style="font-size:14px;color:#9ca3af;text-decoration:line-through;line-height:1.4;">{{ $ancien }}</div>
</td>
</tr>
@endif
<tr>
<td>
<div style="font-size:10.5px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px;">Nouveau rôle</div>
<div style="font-size:18px;color:#1B365D;font-weight:800;line-height:1.3;">{{ $nouveau }}</div>
</td>
</tr>
</table>
