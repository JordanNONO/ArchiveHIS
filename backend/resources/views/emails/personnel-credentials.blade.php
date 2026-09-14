@extends('emails.layout')

@section('title', 'Votre compte HIS Archivage')

@section('content')
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 24px 0;">
Bonjour {{ $prenom }}, votre compte sur <strong>HIS Archivage</strong>, la plateforme d'archivage documentaire de Hetep Iaout Services, vient d'être créé. Voici vos identifiants de connexion.
</p>

@include('emails.partials.chip-identifiants', ['email' => $email, 'motDePasse' => $motDePasse])

<p style="font-size:11.5px;color:#9ca3af;text-align:center;margin:0 0 24px 0;">
Mot de passe temporaire — à changer dès votre première connexion, depuis votre profil.
</p>

@include('emails.partials.cta', ['texte' => 'Se connecter à HIS Archivage', 'lien' => config('app.frontend_url') . '/login'])
@endsection
