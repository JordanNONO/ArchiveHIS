@extends('emails.layout')

@section('title', 'Document transmis par Hetep Iaout Services')

@section('content')
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 22px 0;">
Bonjour,<br><br>
<strong>{{ $expediteurNom }}</strong> vous a transmis un document de façon sécurisée via Hetep Iaout Services.
</p>

@include('emails.partials.fichier', [
    'extension' => $extension,
    'bg' => '#E8EEF7',
    'fg' => '#1B365D',
    'titre' => $document->titre_document,
    'meta' => ['Référence : ' . $document->code_reference],
])

@if($messagePersonnel)
@include('emails.partials.callout', ['texte' => '"' . $messagePersonnel . '"'])
@endif

@include('emails.partials.cta', ['texte' => 'Accéder au document en sécurité', 'lien' => $lien])

<p style="font-size:12px;color:#6b7280;line-height:1.6;margin:18px 0 0 0;">
Pour votre sécurité, le fichier n'est pas joint à cet e-mail. En cliquant sur le lien ci-dessus, un code d'accès à usage unique vous sera envoyé à cette même adresse pour confirmer votre identité avant de pouvoir consulter le document.
<br><br>Ce lien est valable 7 jours. Pour toute question, veuillez contacter directement {{ $expediteurNom }}.
</p>
@endsection
