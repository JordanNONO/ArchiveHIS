<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Convertit un document Office (Word/Excel/PowerPoint...) en PDF via le
 * serveur OnlyOffice déjà déployé pour l'édition en ligne (voir
 * DocumentController::ouvrirEditionWord()) — réutilisé ici uniquement pour sa
 * fonction de CONVERSION (endpoint /converter), pas l'édition.
 *
 * Raison d'être : Claude (voir DocumentAnalysisIAService) ne sait lire que du
 * PDF ou une image, jamais un .docx/.pptx/.xlsx directement — sans cette
 * étape, l'analyse IA à l'archivage (extraction de texte, suggestions de
 * titre/résumé/objet) ne fonctionnait que pour les PDF/images déposés, pas
 * pour le reste des formats bureautiques pourtant acceptés à l'archivage.
 */
class OnlyOfficeConversionService
{
    // Mêmes familles de formats que l'éditeur (texte, tableur, présentation) —
    // tout ce qu'OnlyOffice sait ouvrir, il sait aussi le convertir en PDF.
    public const EXTENSIONS_CONVERTIBLES = [
        'doc', 'docx', 'odt', 'rtf', 'txt',
        'xls', 'xlsx', 'ods', 'csv',
        'ppt', 'pptx', 'odp',
    ];

    public static function estConvertible(string $extension): bool
    {
        return in_array(strtolower($extension), self::EXTENSIONS_CONVERTIBLES, true);
    }

    /**
     * @param string $urlSourceSignee URL signée (voir URL::temporarySignedRoute) par laquelle
     *                                 OnlyOffice va lui-même télécharger le fichier source.
     * @param string $extension Extension du fichier source (sans le point), ex: "pptx".
     * @param string $cle Identifiant unique pour cette conversion (voir DOIT changer si le
     *                     fichier change, même principe que document.key de l'éditeur).
     * @return string|null Octets du PDF obtenu, ou null au moindre souci (jamais d'exception).
     */
    public function convertirEnPdf(string $urlSourceSignee, string $extension, string $cle): ?string
    {
        $baseUrl = config('services.onlyoffice.url');
        $secret = config('services.onlyoffice.jwt_secret');
        if (!$baseUrl || !$secret) {
            return null;
        }

        $payload = [
            'async' => false,
            'filetype' => strtolower($extension),
            'outputtype' => 'pdf',
            'key' => $cle,
            'url' => $urlSourceSignee,
        ];
        $payload['token'] = JWT::encode($payload, $secret, 'HS256');

        try {
            $reponse = Http::timeout(90)->post(rtrim($baseUrl, '/') . '/converter', $payload);

            if (!$reponse->successful()) {
                Log::warning('OnlyOfficeConversionService::convertirEnPdf — appel /converter échoué', ['status' => $reponse->status()]);
                return null;
            }

            $json = $reponse->json();
            if (empty($json['endConvert']) || empty($json['fileUrl'])) {
                Log::warning('OnlyOfficeConversionService::convertirEnPdf — conversion incomplète', ['reponse' => $json]);
                return null;
            }

            $pdf = Http::timeout(60)->get($json['fileUrl']);
            if (!$pdf->successful()) {
                return null;
            }

            return $pdf->body();
        } catch (\Throwable $e) {
            Log::warning('OnlyOfficeConversionService::convertirEnPdf — exception', ['message' => $e->getMessage()]);
            return null;
        }
    }
}
