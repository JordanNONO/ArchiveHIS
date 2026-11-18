@extends('emails.layout')

@section('title', 'Votre bulletin de paie — Hetep Iaout Services')

@section('content')
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 22px 0;">
Bonjour {{ $prenomSalarie }},<br><br>
Veuillez trouver ci-joint votre <strong>bulletin de paie de {{ $libelleMois }}</strong>.
</p>

@include('emails.partials.fichier', [
    'extension' => $extension,
    'bg' => '#FDECEC',
    'fg' => '#DC2626',
    'titre' => $titre,
    'meta' => array_filter([
        $tailleLabel ? 'Taille : ' . $tailleLabel : null,
    ]),
])

<p style="font-size:12.5px;color:#6b7280;line-height:1.6;margin:0;">
Le document est joint à cet e-mail. Pour toute question sur ce bulletin, contactez directement le service Comptabilité.
</p>
@endsection
