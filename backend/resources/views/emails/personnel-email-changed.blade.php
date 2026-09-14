@extends('emails.layout')

@section('title', 'Votre adresse de connexion a changé')

@section('content')
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 24px 0;">
Bonjour {{ $prenom }}, l'adresse de connexion de votre compte <strong>HIS Archivage</strong> vient d'être modifiée par un administrateur.
</p>

@include('emails.partials.rows', ['lignes' => [
    ['label' => 'Ancienne adresse', 'valeur' => $ancienEmail, 'couleur' => '#9ca3af', 'barre' => true],
    ['label' => 'Nouvelle adresse', 'valeur' => $nouvelEmail],
]])

@include('emails.partials.callout', ['texte' => 'Votre mot de passe n\'a pas changé — connectez-vous avec cette nouvelle adresse et votre mot de passe habituel. Si vous ne le retrouvez plus, utilisez "Mot de passe oublié" sur l\'écran de connexion.'])

@include('emails.partials.cta', ['texte' => 'Se connecter à HIS Archivage', 'lien' => config('app.frontend_url') . '/login'])

<p style="font-size:11px;color:#9ca3af;line-height:1.5;margin:18px 0 0 0;text-align:center;">
Si vous n'êtes pas à l'origine de cette demande, contactez immédiatement un administrateur.
</p>
@endsection
