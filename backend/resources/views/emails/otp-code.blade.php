@extends('emails.layout')

@section('title', 'Votre code d\'accès')

@section('content')
<p style="font-size:13.5px;color:#1f2937;line-height:1.6;margin:0 0 20px 0;text-align:center;">
Voici votre code d'accès à usage unique :
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1.5px dashed #92650a;border-radius:14px;margin-bottom:20px;">
<tr>
<td style="padding:22px;text-align:center;">
<div style="font-size:34px;font-weight:800;letter-spacing:9px;color:#1B365D;font-family:Consolas,monospace;">{{ $code }}</div>
</td>
</tr>
</table>

<p style="font-size:12.5px;color:#9ca3af;line-height:1.55;margin:0;text-align:center;">
Ce code est valable {{ $dureeValiditeMinutes }} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.
</p>
@endsection
