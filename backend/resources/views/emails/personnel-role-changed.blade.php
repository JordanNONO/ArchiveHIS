@extends('emails.layout')

@section('title', 'Votre rôle a changé')

@section('content')
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 24px 0;">
Bonjour {{ $prenom }}, un administrateur vient de modifier votre rôle sur <strong>HIS Archivage</strong>.
</p>

@include('emails.partials.swap-role', ['ancien' => count($anciensRoles) ? implode(', ', $anciensRoles) : null, 'nouveau' => implode(', ', $nouveauxRoles)])

@if($explication)
@include('emails.partials.callout', ['texte' => $explication])
@endif

@include('emails.partials.chip-identifiants', ['email' => $email, 'motDePasse' => $motDePasse])

<p style="font-size:11.5px;color:#9ca3af;text-align:center;margin:0 0 24px 0;">
Nouveau mot de passe généré pour l'occasion — à changer dès votre prochaine connexion, depuis votre profil.
</p>

@include('emails.partials.cta', ['texte' => 'Se connecter à HIS Archivage', 'lien' => config('app.frontend_url') . '/login'])

<p style="font-size:11px;color:#9ca3af;line-height:1.5;margin:18px 0 0 0;text-align:center;">
Si ce changement ne vous semble pas normal, contactez un administrateur avant de vous connecter.
</p>
@endsection
