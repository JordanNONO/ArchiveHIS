@extends('emails.layout')

@section('title', 'Bulletin de salaire — Hetep Iaout Services')

@section('content')
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 22px 0;">
Bonjour{{ $prenomSalarie !== '' ? ' ' . $prenomSalarie : '' }},<br><br>
Vous trouverez ci-joint votre bulletin de salaire du mois de {{ $libelleMoisMinuscule }}.<br><br>
Je vous en souhaite bonne réception.<br><br>
Bien cordialement,
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
@endsection
