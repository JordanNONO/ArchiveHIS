@extends('emails.layout')

@section('title', 'Rapport d\'activité mensuel — HIS Archivage')

@section('content')
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 24px 0;">
Bonjour,<br><br>
Voici le résumé d'activité de <strong>HIS Archivage</strong> pour <strong>{{ $libellePeriode }}</strong>.
</p>

<div style="font-size:11px;font-weight:700;color:#1B365D;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px;">Documents</div>
@include('emails.partials.rows', ['lignes' => [
    ['label' => 'Déposés ce mois-ci', 'valeur' => $documentsDeposes],
    ['label' => 'Validés et traités ce mois-ci', 'valeur' => $documentsValides, 'couleur' => '#16a34a'],
    ['label' => 'Rejetés / incomplets ce mois-ci', 'valeur' => $documentsRejetes, 'couleur' => '#dc2626'],
    ['label' => 'Actuellement en attente de traitement', 'valeur' => $documentsEnAttente, 'couleur' => $documentsEnAttente > 0 ? '#ca8a04' : '#1B365D'],
]])

<div style="font-size:11px;font-weight:700;color:#1B365D;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px;">Courriers</div>
@include('emails.partials.rows', ['lignes' => [
    ['label' => 'Entrants ce mois-ci', 'valeur' => $courriersEntrants],
    ['label' => 'Sortants ce mois-ci', 'valeur' => $courriersSortants],
]])

<div style="font-size:11px;font-weight:700;color:#1B365D;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px;">Points d'attention (à l'instant de l'envoi)</div>
@include('emails.partials.rows', ['lignes' => [
    ['label' => 'Objectifs PAI en retard', 'valeur' => $paiObjectifsEnRetard, 'couleur' => $paiObjectifsEnRetard > 0 ? '#dc2626' : '#1B365D'],
    ['label' => 'Suivis de délai au rouge', 'valeur' => $suivisDelaisRouge, 'couleur' => $suivisDelaisRouge > 0 ? '#dc2626' : '#1B365D'],
]])

<p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:2px 0 0 0;">
Ce résumé automatique est envoyé le 1er de chaque mois aux comptes Administrateur et Consultation. Pour le détail, consultez la page Statistiques dans HIS Archivage.
</p>
@endsection
