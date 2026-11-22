@extends('emails.layout')

@section('title', $titre . ' — Hetep Iaout Services')

@section('content')
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 22px 0;">
Bonjour,<br><br>
@if($pourLeSalarie)
Votre document <strong>« {{ $document->titre_document }} »</strong> {{ $quand }} <strong>{{ $dateFin }}</strong>.
Pensez à déposer le nouveau dès que vous l'avez : il sera classé dans votre dossier et ce rappel s'arrêtera.
@else
Le document <strong>« {{ $document->titre_document }} »</strong> de <strong>{{ $nomSalarie }}</strong> {{ $quand }} <strong>{{ $dateFin }}</strong>.
@endif
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:22px;">
<tr>
<td style="padding:20px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
<tr>
<td style="background-color:{{ $expire ? '#FDECEC' : '#FFF1DC' }};color:{{ $expire ? '#B42318' : '#8A4B00' }};border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:700;">{{ $expire ? 'Expiré' : 'À renouveler' }}</td>
</tr>
</table>
<div style="font-size:14.5px;font-weight:700;color:#1B365D;margin-bottom:4px;">{{ $document->titre_document }}</div>
<div style="font-size:12.5px;color:#6b7280;">Fin de validité : {{ $dateFin }}</div>
</td>
</tr>
</table>

@include('emails.partials.cta', ['texte' => $pourLeSalarie ? 'Voir mes documents' : 'Ouvrir le document', 'lien' => $lien])
@endsection
