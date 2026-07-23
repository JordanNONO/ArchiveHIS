<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('document_archives')->where('status_doc', 'disponible')->update(['status_doc' => 'ARCHIVE']);
    }

    public function down(): void
    {
        DB::table('document_archives')->where('status_doc', 'ARCHIVE')->update(['status_doc' => 'disponible']);
    }
};
