<?php

namespace App\Enums;

enum NiveauConfidentialite: string
{
    case PUBLIC = 'PUBLIC';
    case INTERNE = 'INTERNE';
    case CONFIDENTIEL = 'CONFIDENTIEL';
    case STRICTEMENT_CONFIDENTIEL = 'STRICTEMENT_CONFIDENTIEL';
}
