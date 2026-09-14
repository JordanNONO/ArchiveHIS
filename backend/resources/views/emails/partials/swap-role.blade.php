{{-- Ancien/nouveau role - Attend : $ancien (nullable), $nouveau. Si $ancien
est vide (tout premier role attribue), sa ligne est omise. Repose sur
rows-empilees.blade.php (voir ce fichier pour le pourquoi de l'empilement
vertical plutot qu'une ligne cote a cote). --}}
@include('emails.partials.rows-empilees', ['lignes' => array_filter([
    $ancien ? ['label' => 'Ancien rôle', 'valeur' => $ancien, 'couleur' => '#9ca3af', 'taille' => '14px', 'gras' => '400', 'barre' => true] : null,
    ['label' => 'Nouveau rôle', 'valeur' => $nouveau, 'taille' => '18px', 'gras' => '800'],
])])
