@extends('emails.layout')

@section('title', $isExternal ? 'Document transmis par Hetep Iaout Services' : 'Document partagé sur HIS Archivage')

@section('content')
@if($isExternal)
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 22px 0;">
Bonjour,<br><br>
<strong>Hetep Iaout Services</strong> vous transmet, de la part de <strong>{{ $expediteurNom }}</strong>, le document suivant.
</p>
@elseif($serviceNom)
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 22px 0;">
Bonjour,<br><br>
<strong>{{ $expediteurNom }}</strong> a transmis un document au <strong>service {{ $serviceNom }}</strong>, dont vous faites partie.
</p>
@else
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 22px 0;">
Bonjour,<br><br>
<strong>{{ $expediteurNom }}</strong> vous a partagé un document via HIS Archivage.
</p>
@endif

@include('emails.partials.fichier', [
    'extension' => $extension,
    'bg' => $typeCouleur['bg'],
    'fg' => $typeCouleur['fg'],
    'titre' => $document->titre_document,
    'meta' => array_filter([
        'Référence : ' . $document->code_reference,
        $document->categorieDocument ? 'Catégorie : ' . $document->categorieDocument->libelle_cat : null,
        $tailleLabel ? 'Taille : ' . $tailleLabel : null,
    ]),
])

@if($messagePersonnel)
@include('emails.partials.callout', ['texte' => '"' . $messagePersonnel . '"'])
@endif

<p style="font-size:12.5px;color:#6b7280;line-height:1.6;margin:0;">
Le document est joint à cet e-mail.
@if($isExternal)
<br><br>Ce message vous a été envoyé par l'intermédiaire de la plateforme d'archivage interne de Hetep Iaout Services. Pour toute question, veuillez contacter directement {{ $expediteurNom }}.
@endif
</p>
@endsection
