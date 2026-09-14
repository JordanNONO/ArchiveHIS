@extends('emails.layout')

@section('title', 'Décision sur votre demande de congés — Hetep Iaout Services')

@section('content')
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 22px 0;">
Bonjour,<br><br>
Votre demande de congés a été examinée par <strong>{{ $nomSignataire }}</strong>. Vous trouverez ci-joint le formulaire complet, décision comprise.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:{{ (!$accepte && $motif) ? '18px' : '22px' }};">
<tr>
<td style="padding:20px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
<tr>
<td style="background-color:{{ $accepte ? '#E7F6EC' : '#FDECEC' }};color:{{ $accepte ? '#16A34A' : '#DC2626' }};border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:700;">{{ $accepte ? 'Demande acceptée' : 'Demande refusée' }}</td>
</tr>
</table>
<div style="font-size:14.5px;font-weight:700;color:#1B365D;margin-bottom:4px;">{{ $document->titre_document }}</div>
@if($document->resume)
<div style="font-size:12.5px;color:#6b7280;">{{ $document->resume }}</div>
@endif
</td>
</tr>
</table>

@if(!$accepte && $motif)
@include('emails.partials.callout', ['texte' => $motif, 'couleur' => '#DC2626'])
@endif

<p style="font-size:12.5px;color:#6b7280;line-height:1.6;margin:0;">
Le formulaire complété est joint à cet e-mail au format PDF.<br><br>
Pour toute question sur cette décision, rapprochez-vous de votre responsable secteur.
</p>
@endsection
